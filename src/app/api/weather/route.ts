import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import { isTimeOfDay, WEATHER_LEVELS, type WeatherState } from "@/lib/weather";

const statePath = (level: string) => `weather/${level}.json`;
const known = (level: string | null): level is string => !!level && WEATHER_LEVELS.some(l => l.id === level);

/** GET /api/weather?level=vessel — the time of day the GM has set there, or null (the level's own, night). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(null, { status: 401 });
  const level = req.nextUrl.searchParams.get("level");
  if (!known(level)) return NextResponse.json({ error: "Unknown level" }, { status: 400 });
  return NextResponse.json(await readJSON<WeatherState | null>(statePath(level), null));
}

/** POST { level, time } — GM only. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { level, time } = await req.json();
  if (!known(level) || !isTimeOfDay(time)) {
    return NextResponse.json({ error: "Expected a known level and dawn, day, evening or night" }, { status: 400 });
  }
  const state: WeatherState = { time, setAt: Date.now(), setBy: session.user.id };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}
