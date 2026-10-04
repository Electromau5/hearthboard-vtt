import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import { isRain, isTimeOfDay, WEATHER_LEVELS, type WeatherState } from "@/lib/weather";

const statePath = (level: string) => `weather/${level}.json`;
const known = (level: string | null): level is string => !!level && WEATHER_LEVELS.some(l => l.id === level);

/** GET /api/weather?level=vessel — the time of day and rain the GM has set there, or null (night, dry). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(null, { status: 401 });
  const level = req.nextUrl.searchParams.get("level");
  if (!known(level)) return NextResponse.json({ error: "Unknown level" }, { status: 400 });
  return NextResponse.json(await readJSON<WeatherState | null>(statePath(level), null));
}

/** POST { level, time?, rain? } — GM only. Whatever is left out keeps its current setting. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { level, time, rain } = await req.json();
  if (!known(level) || (time !== undefined && !isTimeOfDay(time)) || (rain !== undefined && !isRain(rain)) || (time === undefined && rain === undefined)) {
    return NextResponse.json({ error: "Expected a known level, and a time (dawn/day/evening/night) and/or rain (none/light/heavy/storm)" }, { status: 400 });
  }
  const prev = await readJSON<WeatherState | null>(statePath(level), null);
  const state: WeatherState = {
    time: time ?? prev?.time ?? "night",
    rain: rain ?? prev?.rain ?? "none",
    setAt: Date.now(),
    setBy: session.user.id,
  };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}
