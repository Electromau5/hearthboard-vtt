import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import { CHARACTERS } from "@/lib/characters";
import { mergeCharacter } from "@/lib/character-merge";
import { readCharacterOverrides } from "@/lib/character-storage";
import { NPC_PERSONAS, type NpcPersona } from "@/lib/npc-personas";

/**
 * Talking to a walkthrough NPC. Each NPC keeps a separate memory of every
 * investigator — notes in their own words, how warmly they regard them, how
 * often they have met, and the recent conversation — so a relationship builds
 * across visits and sessions, and differs from one investigator to the next.
 *
 * POST { opening: true }   — the investigator walks up; returns a greeting
 * POST { message: "…" }    — the investigator says something; returns the reply
 *
 * A stranger's first greeting is the persona's scripted introduction (no model
 * call). Everything else is one model call through Vercel AI Gateway, which
 * returns the reply and the NPC's rewritten notes together.
 */

// Any model ID from https://ai-gateway.vercel.sh/v1/models; NPC_MODEL overrides it.
const MODEL = process.env.NPC_MODEL ?? "anthropic/claude-sonnet-5.5";
const MAX_MESSAGE = 600;
/** Turns kept in memory, and how many of them the model sees each time. */
const KEEP_TURNS = 40;
const CONTEXT_TURNS = 16;
/** A gap this long between words counts as a new meeting. */
const NEW_MEETING_MS = 30 * 60 * 1000;

type Turn = { from: "them" | "npc"; text: string; at: number };
type Memory = {
  name: string;
  meetings: number;
  /** -5 (hostile) .. 5 (devoted). */
  disposition: number;
  /** The NPC's private notes about this investigator, first person. */
  notes: string;
  turns: Turn[];
  lastSeen: number;
};
/** One line per investigator the NPC knows, so they can mention the others. */
type Acquaintances = Record<string, { name: string; regard: string; gist: string }>;

const memoryPath = (npc: string, who: string) => `npc/${npc}/${who}.json`;
const indexPath = (npc: string) => `npc/${npc}/index.json`;

function regard(d: number): string {
  if (d >= 4) return "trusting";
  if (d >= 2) return "warm";
  if (d >= -1) return "cordial";
  if (d >= -3) return "wary";
  return "hostile";
}

const Reply = z.object({
  reply: z.string().describe("What you say aloud, in character. At most one short stage direction, in *asterisks*."),
  notes: z.string().describe("Your private notes about this person, rewritten to include anything new. First person, at most 120 words."),
  disposition_change: z.number().describe("How this exchange changed your regard for them: an integer from -2 to 2. Usually 0."),
});

function systemPrompt(p: NpcPersona, them: { name: string; profile: string }, mem: Memory, others: string[]) {
  return [
    p.character,
    `SETTING\n${p.setting}`,
    `WHAT YOU KNOW\n${p.knowledge.map(k => `- ${k}`).join("\n")}`,
    `WHAT YOU HIDE\nNever state these plainly. Hint at one, obliquely, only if this person has earned real trust (regard "trusting") or has genuinely frightened you — and even then make them work for it.\n${p.secrets.map(k => `- ${k}`).join("\n")}`,
    `WHO IS IN FRONT OF YOU\n${them.name}. ${them.profile}`,
    mem.notes
      ? `YOUR NOTES ON THEM (you have met ${mem.meetings} time${mem.meetings === 1 ? "" : "s"}; your regard: ${regard(mem.disposition)})\n${mem.notes}`
      : `You have never met this person before. Your regard: ${regard(mem.disposition)}.`,
    others.length ? `OTHERS OF THEIR GROUP YOU KNOW\n${others.join("\n")}` : "",
    [
      "HOW TO SPEAK",
      "- Stay in character always. Never mention being an AI, a game, dice, rules, or the Keeper.",
      "- Reply with one to four short sentences of speech. Let your regard colour how open you are.",
      "- Remember and use what they have told you before, and what you know of their friends.",
      "- Do not narrate their actions or feelings, and do not decide whether their persuasion, lies or threats succeed: react to the attempt, refuse, bargain or stall. The table rolls the dice.",
      "- If you do not know something, say so in character. Never invent major facts about the campaign — names of conspirators, the location of the tomb, who the benefactor is.",
      "- Then rewrite your private notes about this person, keeping what matters from before.",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const persona = NPC_PERSONAS[id];
  if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { opening?: boolean; message?: string };
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";
  if (!body.opening && !message) return NextResponse.json({ error: "Say something" }, { status: 400 });

  // Whom the NPC is talking to: the player's investigator, or the Keeper as a visitor.
  const slug = session.user.assignedSlug ?? null;
  const base = slug ? CHARACTERS.find(c => c.slug === slug) : undefined;
  const character = base ? mergeCharacter(base, await readCharacterOverrides(base.slug)) : null;
  const who = character?.slug ?? "keeper";
  const them = character
    ? { name: character.name, profile: `${character.gender}, ${character.age}. Presents as: ${character.cover}.` }
    : { name: "A visitor", profile: "A stranger in a good coat who has not given a name." };

  const prior = persona.priorMeetings[who];
  const [stored, index] = await Promise.all([
    readJSON<Memory | null>(memoryPath(id, who), null),
    readJSON<Acquaintances>(indexPath(id), {}),
  ]);
  const mem: Memory = stored ?? {
    name: them.name,
    meetings: prior ? 1 : 0,
    disposition: prior?.disposition ?? 0,
    notes: prior?.notes ?? "",
    turns: [],
    lastSeen: 0,
  };
  const now = Date.now();
  const recent = mem.turns.slice(-6);

  // Walking up counts as a new meeting unless they were here a moment ago.
  if (body.opening && now - mem.lastSeen > NEW_MEETING_MS) mem.meetings += 1;

  let reply: string;
  let audio: string | undefined;
  if (body.opening && mem.meetings === 1 && !mem.notes && mem.turns.length === 0) {
    // A stranger: the scripted introduction, word for word.
    reply = persona.firstMeeting.lines.join(" ");
    audio = persona.firstMeeting.audio;
    mem.notes = `Met ${character ? them.name : "a visitor who gave no name"} for the first time at the admissions cage. Gave them the usual welcome.`;
  } else {
    const others = Object.entries(index)
      .filter(([k]) => k !== who)
      .map(([, o]) => `- ${o.name} (${o.regard}): ${o.gist}`);
    const history = mem.turns.slice(-CONTEXT_TURNS).map(t => ({
      role: t.from === "them" ? ("user" as const) : ("assistant" as const),
      content: t.text,
    }));
    const said = message || `(${them.name} comes up to the admissions cage${mem.meetings > 1 ? ", back again" : ""}.)`;
    try {
      const { output } = await generateText({
        model: MODEL,
        system: systemPrompt(persona, them, mem, others),
        messages: [...history, { role: "user", content: said }],
        output: Output.object({ schema: Reply }),
        maxOutputTokens: 900,
      });
      reply = output.reply.trim();
      mem.notes = output.notes.trim().slice(0, 1200);
      const delta = Math.max(-2, Math.min(2, Math.round(output.disposition_change || 0)));
      mem.disposition = Math.max(-5, Math.min(5, mem.disposition + delta));
    } catch (err) {
      console.error(`NPC ${id} could not answer:`, err);
      return NextResponse.json(
        { error: "He looks at you, and says nothing.", detail: err instanceof Error ? err.message : String(err) },
        { status: 502 },
      );
    }
  }

  if (message) mem.turns.push({ from: "them", text: message, at: now });
  mem.turns.push({ from: "npc", text: reply, at: now });
  mem.turns = mem.turns.slice(-KEEP_TURNS);
  mem.lastSeen = now;
  mem.name = them.name;
  index[who] = { name: them.name, regard: regard(mem.disposition), gist: mem.notes.slice(0, 220) };
  await Promise.all([writeJSON(memoryPath(id, who), mem), writeJSON(indexPath(id), index)]);

  return NextResponse.json({
    reply,
    audio,
    meetings: mem.meetings,
    regard: regard(mem.disposition),
    // What was said last time, so the pane can show the thread they are picking up.
    recent: body.opening ? recent : undefined,
  });
}
