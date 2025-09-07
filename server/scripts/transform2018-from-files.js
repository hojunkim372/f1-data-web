// server/scripts/transform2018-from-files.js
// 네트워크 없이, 저장해둔 Ergast 원본 JSON 2개를 읽어
// MongoDB Compass Import용 배열로 변환합니다.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEASON = 2018;
const SCHEDULE = path.join(__dirname, "raw-2018-schedule.json");
const RESULTS  = path.join(__dirname, "raw-2018-results.json");
const OUT_DIR  = path.join(__dirname, "../exports");
const OUT_FILE = path.join(OUT_DIR, `${SEASON}-races-full.json`);

function ymd(dateStr) {
  // YYYY-MM-DDT00:00:00.000Z 형태로 고정 (Compass Import 호환)
  return new Date(dateStr).toISOString().slice(0, 10) + "T00:00:00.000Z";
}

function pickWinner(results) {
  const w = results?.find(r => r.position === "1");
  if (!w) return null;
  const { Driver, Constructor } = w;
  return {
    code: Driver?.code || (Driver?.familyName || "").slice(0, 3).toUpperCase(),
    name: `${Driver?.givenName ?? ""} ${Driver?.familyName ?? ""}`.trim(),
    team: Constructor?.name ?? "",
  };
}

function toResult(r) {
  const d = r.Driver || {};
  const c = r.Constructor || {};
  const fl = r.FastestLap || {};
  const flTime = fl?.Time?.time || null;
  const flAvg  = fl?.AverageSpeed?.speed ? Number(fl.AverageSpeed.speed) : undefined;

  return {
    position: Number(r.position),
    driver: {
      code: d.code || (d.familyName || "").slice(0, 3).toUpperCase(),
      name: `${d.givenName ?? ""} ${d.familyName ?? ""}`.trim(),
      team: c.name || "",
    },
    grid: r.grid ? Number(r.grid) : undefined,
    laps: r.laps ? Number(r.laps) : undefined,
    time: r.Time?.time || null,      // "1:29:33.283" 또는 null
    status: r.status || null,        // "Finished", "+1 Lap", "DNF" 등
    points: r.points ? Number(r.points) : 0,
    fastestLap: flTime
      ? { lap: fl?.lap ? Number(fl.lap) : undefined, time: flTime, averageSpeed: flAvg }
      : undefined,
  };
}

async function main() {
  const scheduleRaw = JSON.parse(await fs.readFile(SCHEDULE, "utf-8"));
  const resultsRaw  = JSON.parse(await fs.readFile(RESULTS, "utf-8"));

  const races = scheduleRaw?.MRData?.RaceTable?.Races ?? [];
  const resultRaces = resultsRaw?.MRData?.RaceTable?.Races ?? [];

  // round → results 배열 맵
  const byRound = new Map();
  for (const rr of resultRaces) {
    byRound.set(String(rr.round), rr.Results ?? []);
  }

  const payload = races.map(r => {
    const round = Number(r.round);
    const circuitName = r.Circuit?.circuitName ?? "";
    const loc = r.Circuit?.Location;
    const location = [loc?.locality, loc?.country].filter(Boolean).join(", ");

    const resArr = (byRound.get(String(round)) || []).map(toResult);
    const winner = pickWinner(byRound.get(String(round)) || []);

    return {
      season: Number(r.season),
      round,
      name: r.raceName,
      circuit: circuitName,
      date: { $date: ymd(r.date) },   // Compass 호환
      location,
      winner,
      results: resArr,
    };
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`✅ Wrote ${payload.length} races → ${OUT_FILE}`);
}

main().catch(err => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
