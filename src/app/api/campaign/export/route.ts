import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { CHARACTERS, type Character } from "@/lib/characters";
import { readCharacterOverrides } from "@/lib/character-storage";
import { getAssignments } from "@/app/api/characters/assignments/route";
import { getStoredLocations } from "@/app/api/admin/locations/route";
import { CAMPAIGN_LOCATIONS } from "@/lib/campaign-defaults";
import type { Location } from "@/lib/vtt-types";

function mergeChar(base: Character, overrides: Partial<Character>): Character {
  return {
    ...base,
    ...overrides,
    vitals: { ...base.vitals, ...(overrides.vitals ?? {}) },
    characteristics: { ...base.characteristics, ...(overrides.characteristics ?? {}) },
    skills: overrides.skills ?? base.skills,
    abilities: overrides.abilities ?? base.abilities,
    hooks: overrides.hooks ?? base.hooks,
    equipment: overrides.equipment ?? base.equipment,
  };
}

function mergeLocations(stored: Location[]): Location[] {
  const storedMap = new Map(stored.map((l) => [l.id, l]));
  return CAMPAIGN_LOCATIONS.map((def) => ({
    ...def,
    ...(storedMap.get(def.id) ?? {}),
    attachments: storedMap.get(def.id)?.attachments ?? def.attachments,
  }));
}

function charSection(char: Character, claimedBy?: string): string {
  const lines: string[] = [];

  const badge = claimedBy ? `*(claimed by **${claimedBy}**)* ` : "*(unclaimed)*";
  lines.push(`### ${char.name} ${badge}`);
  lines.push(`**Class:** ${char.className}  `);
  lines.push(`**Age:** ${char.age} | **Gender:** ${char.gender}  `);
  lines.push(`**Cover:** ${char.cover}  `);
  lines.push(`**Former Status:** ${char.formerStatus}  `);
  lines.push("");

  lines.push("#### Vitals");
  lines.push("| Stat | Value |");
  lines.push("|---|---|");
  lines.push(`| HP | ${char.vitals.hp} |`);
  lines.push(`| Willpower (MP) | ${char.vitals.willpower} |`);
  lines.push(`| Sanity (SAN) | ${char.vitals.sanity} / ${char.vitals.maxSanity} |`);
  lines.push(`| Buffered Sanity | ${char.vitals.bufferedSanity} / ${char.vitals.bufferedSanityMax} |`);
  lines.push(`| Ancestral Resonance | ${char.vitals.ancestralResonance}% |`);
  lines.push(`| Luck | ${char.vitals.luck} |`);
  lines.push("");

  lines.push("#### Characteristics");
  lines.push("| STR | CON | SIZ | DEX | APP | INT | POW | EDU |");
  lines.push("|---|---|---|---|---|---|---|---|");
  const ch = char.characteristics;
  lines.push(`| ${ch.STR} | ${ch.CON} | ${ch.SIZ} | ${ch.DEX} | ${ch.APP} | ${ch.INT} | ${ch.POW} | ${ch.EDU} |`);
  lines.push("");

  if (char.skills.length > 0) {
    lines.push("#### Skills");
    lines.push("| Skill | % | Notes |");
    lines.push("|---|---|---|");
    for (const s of char.skills) {
      lines.push(`| ${s.name} | ${s.value}% | ${s.notes} |`);
    }
    lines.push("");
  }

  if (char.abilities.length > 0) {
    lines.push("#### Class Abilities");
    for (const a of char.abilities) {
      lines.push(`**${a.name}** *(${a.type})*  `);
      lines.push(a.description);
      lines.push("");
    }
  }

  if (char.hooks.length > 0) {
    lines.push("#### Narrative Hooks & Flaws");
    for (const h of char.hooks) {
      lines.push(`**${h.title}:** ${h.description}  `);
    }
    lines.push("");
  }

  if (char.equipment.length > 0) {
    lines.push("#### Equipment");
    for (const e of char.equipment) {
      lines.push(`- ${e}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

const BRIEFINGS_TEXT = [
  {
    title: "Arthur Butler — Mission Briefing",
    badge: "CONFIDENTIAL",
    subtitle: "Legal Representative of an unnamed benefactor",
    parts: [
      [
        "My name is Arthur Butler and I am the legal representative of a benefactor who shall be unnamed.",
        "You have all been summoned here to continue an excavation that was started 17 years ago. My benefactor has spent a substantial amount of resources to find a subterranean chamber that for better or for worse — contains an object that is of importance to them. Alas, we have not made enough progress to even locate this chamber.",
        "You will all be given one year to locate this chamber. You will be provided with adequate resources to help you on your quest, but please be warned. This is an operation that is not allowed to have any eyes apart from yours. If this gains unnecessary visibility, we will pull all of our support and resources.",
        "You all have agreed to join this mission for your individual motives and my benefactor will fulfill all of them on completion.",
      ],
      [
        "We operate under the code name Project Deep Bedrock. You will find that my benefactors' resources are extensive, but they are not infinite, nor are they without rigorous control.",
        "To facilitate your progress, we have established a sophisticated logistical framework. Depending on the complexity of your requirements, we can provide anything from standard heavy excavation equipment to sensitive, black budget military hardware.",
        "However, understand this. Every item requisitioned increases the noise this mission creates. We monitor this exposure with clinical precision.",
        "Should your activities draw the attention of federal task forces or local authorities, do not expect bail or legal intervention. We will trigger our standard severance protocol — liquidating all assets, dissolving your contacts and removing any trace of your existence. You are on your own the moment you become a liability.",
      ],
      [
        "For your research, you will be granted access to the Black Archive, located within a decommissioned municipal cold storage warehouse in Boston Harbour.",
        "It contains a collection of artefacts curated over decades. Use them to decode the pre-human glyphs and structural enigmas you will undoubtedly face.",
        "I must warn you, these items are not merely academic curiosities. They exact a toll — psychological, physiological and perhaps existential. We provide the tools, but we do not guarantee your sanity in their handling.",
      ],
      [
        "You have one year. The astronomical alignments are shifting and our window of opportunity is narrow. We have provided you with the necessary data to begin your sifting process in Boston.",
        "Do not look for us. Do not seek to identify my benefactor. Focus on the tomb and ensure that when it is unsealed, the primary objective is delivered to our couriers without incident.",
        "Everything else you find within — the relics, the gold, the artefacts — is yours to claim. That is the agreement.",
        "Good day. We will be in touch when the first drop is ready.",
      ],
    ],
  },
  {
    title: "A Warning from the Docks",
    badge: "WITNESS ACCOUNT",
    subtitle: "Anonymous · Innsmouth Harbour",
    parts: [
      [
        "I used to live in this fishing town called Innsmouth near Newburyport. I never thought that the town could get any weirder till this guy showed up asking questions about the town's history. Apparently he had access to information that wasn't made public and he wanted to learn more.",
        "That poor bastard. He was asking too many questions and in this town, everyone knows that'll get ya in deep trouble. The last I heard of him was that he went insane and drowned himself in the waters of Innsmouth, but I know that's complete horseshit. There's something down there. Something that was calling him and he answered the call.",
        "I'm probably not going to be here tomorrow when I tell you what I'm about to tell you, but if that means bringing some peace to that poor soul, so be it. The name 'Obed Marsh' would probably ring a bell. He's the primary reason why this town survived a 100 years longer than it should've have. You need to find the last remaining family member of the Marsh family. That will get you closer to what you were asking about — a lot closer. All I know is that the Marshes abandoned Innsmouth a long time back. God knows where they live now.",
      ],
    ],
  },
  {
    title: "A Business Arrangement",
    badge: "INTERCEPTED",
    subtitle: "Unknown Subject · Surveillance Recording",
    parts: [
      [
        "The guy you're looking for goes by the name 'Amazo the Amazing'. I know. Stupid name right? Anyway, he's built a reputation as the primary magic act in these parts, but the guy — he's really ambitious. So he asks my old man for a loan. However, in return the old man doesn't ask him for the money back. He instead gets him to give away his secrets. Shrewd bastard. Now he knows everything about this guy's secrets and is blackmailing him for a larger cut of the profits.",
        "Yeah. My father has been behind that guy for a couple of years now. He knows he's a fraud, but he's also quite useful. He's not stupid, that one. He knows things — things that could very well be helpful for both of us. So we made a deal — I take the old man out of the equation and he and I form… a business partnership. Whatever he finds in that tomb is gonna make him very famous and me very rich.",
      ],
    ],
  },
  {
    title: "The Chief Attendant",
    badge: "FACILITY CONTACT",
    subtitle: "Bellevue Psychiatric Isolation Ward",
    parts: [
      [
        "Hello. I'm the chief attendant at this......magical place. I was told about your arrival. I would be happy to help, but please keep in mind that our patient records are strictly confidential unless they have been approved to be released by the patient themselves or a family member. I think you will like it here.",
      ],
    ],
  },
];

const SCENES = [
  { short: "Miskatonic", name: "Miskatonic University & Orne Library", mapX: 47, mapY: 22 },
  { short: "Bellevue", name: "Bellevue Psychiatric Isolation Ward", mapX: 14, mapY: 67 },
  { short: "Abattoir", name: "Underworld Abattoir & Speakeasy", mapX: 49, mapY: 52 },
  { short: "Black Archives", name: "Black Archives", mapX: 65, mapY: 47 },
  { short: "Fed. Docks", name: "Federal Quarantine Docks", mapX: 70, mapY: 18 },
];

function buildMarkdown(
  allChars: Character[],
  assignments: Record<string, string>,
  locations: Location[],
  journal: string,
  generatedAt: string
): string {
  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────
  lines.push("# Echoes of Darkness — Campaign Export");
  lines.push("");
  lines.push(`**System:** Call of Cthulhu | **Generated:** ${generatedAt} | **Status:** Ongoing`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── Campaign Overview ───────────────────────────────────────────────
  lines.push("## Campaign Overview");
  lines.push("");
  lines.push("> Seven investigators descend into a 17-year subterranean excavation — and something ancient stirs below.");
  lines.push("");
  lines.push("**Code Name:** Project Deep Bedrock  ");
  lines.push("**Patron:** Anonymous benefactor via Arthur Butler (Legal Representative)  ");
  lines.push("**Objective:** Locate and unseal a pre-human subterranean chamber. Deliver the primary objective to the patron's couriers.  ");
  lines.push("**Timeline:** One year — astronomical alignments are shifting.  ");
  lines.push("**Exposure Protocol:** All support withdrawn and identities dissolved if federal attention is drawn.  ");
  lines.push("**Resources:** Black Archive (Boston Harbour) — pre-human artefacts and forbidden texts.  ");
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── Campaign Mechanics ──────────────────────────────────────────────
  lines.push("## Campaign Mechanics");
  lines.push("");
  lines.push("| Mechanic | Range | Description |");
  lines.push("|---|---|---|");
  lines.push("| Sanity (SAN) | 0–99 (current/max) | Loss of 5+ in one turn induces temporary insanity |");
  lines.push("| Buffered Sanity | 0–N stored pts | Horror deferred through professional instruments; triggers on session end |");
  lines.push("| Ancestral Resonance | 0–100% | Genetic alignment with the tomb; failure triggers involuntary ritual actions |");
  lines.push("| Willpower (MP) | 1–20 | Fuel for psychological resistance and class abilities |");
  lines.push("| Luck Pool | 0–99 | Expendable to adjust rolls; high expenditure increases Resonance risks |");
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── Investigator Roster ─────────────────────────────────────────────
  const claimedSlugs = new Set(Object.keys(assignments));
  const active = allChars.filter((c) => claimedSlugs.has(c.slug));
  const bench = allChars.filter((c) => !claimedSlugs.has(c.slug));

  lines.push(`## Investigator Roster`);
  lines.push("");
  lines.push(`**${active.length} of ${allChars.length} investigators claimed.**`);
  lines.push("");

  if (active.length > 0) {
    lines.push("### Active Investigators");
    lines.push("");
    for (const char of active) {
      lines.push(charSection(char, assignments[char.slug]));
      lines.push("---");
      lines.push("");
    }
  }

  if (bench.length > 0) {
    lines.push("### Unclaimed Investigators");
    lines.push("");
    for (const char of bench) {
      lines.push(charSection(char));
      lines.push("---");
      lines.push("");
    }
  }

  // ── Locations ───────────────────────────────────────────────────────
  lines.push("## Campaign Locations");
  lines.push("");
  for (const loc of locations) {
    lines.push(`### ${loc.name}`);
    if (loc.description) lines.push(loc.description);
    lines.push("");
  }
  lines.push("---");
  lines.push("");

  // ── Scenes ─────────────────────────────────────────────────────────
  lines.push("## Campaign Scenes");
  lines.push("");
  lines.push("| Scene | Full Location Name | Map Position |");
  lines.push("|---|---|---|");
  for (const s of SCENES) {
    lines.push(`| ${s.short} | ${s.name} | ${s.mapX}%, ${s.mapY}% |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── Mission Intelligence ────────────────────────────────────────────
  lines.push("## Mission Intelligence");
  lines.push("");
  for (const briefing of BRIEFINGS_TEXT) {
    lines.push(`### ${briefing.title}`);
    lines.push(`*${briefing.badge} — ${briefing.subtitle}*`);
    lines.push("");
    for (let i = 0; i < briefing.parts.length; i++) {
      if (briefing.parts.length > 1) {
        lines.push(`**Part ${i + 1}**`);
        lines.push("");
      }
      for (const para of briefing.parts[i]) {
        lines.push(`> ${para}`);
        lines.push(">");
      }
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("");

  // ── Session Journal ─────────────────────────────────────────────────
  lines.push("## Session Journal");
  lines.push("");
  if (journal.trim()) {
    lines.push(journal.trim());
  } else {
    lines.push("*No journal entries recorded for this session.*");
  }
  lines.push("");

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const journal: string = (body as { journal?: string }).journal ?? "";

  const [assignments, storedLocs, allChars] = await Promise.all([
    getAssignments(),
    getStoredLocations(),
    Promise.all(
      CHARACTERS.map(async (base) => {
        const overrides = await readCharacterOverrides(base.slug);
        return mergeChar(base, overrides);
      })
    ),
  ]);

  const locations = mergeLocations(storedLocs);

  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const markdown = buildMarkdown(allChars, assignments, locations, journal, generatedAt);
  const dateStr = new Date().toISOString().split("T")[0];

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="echoes-of-darkness-${dateStr}.md"`,
    },
  });
}
