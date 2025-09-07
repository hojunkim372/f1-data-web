// server/scripts/export2018.js
// Node v18+ (v24 OK)에서 동작. 전역 fetch 사용.
// 2018 시즌 전 경기 결과를 Ergast API에서 가져와 MongoDB용 JSON 배열로 변환.

const SEASON = 2018;
const OUT_PATH = new URL(`../exports/${SEASON}-races-full.json`, import.meta.url);

// YYYY-MM-DD (UTC)로 고정
function ymd(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10) + "T00:00:00.000Z";
}

function pickWinner(results) {
  const w = results?.find((r) => r.position === "1");
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
  const flAvg = fl?.AverageSpeed?.speed ? Number(fl.AverageSpeed.speed) : undefined;

  return {
    position: Number(r.position),
    driver: {
      code: d.code || (d.familyName || "").slice(0, 3).toUpperCase(),
      name: `${d.givenName ?? ""} ${d.familyName ?? ""}`.trim(),
      team: c.name || "",
    },
    grid: r.grid ? Number(r.grid) : undefined,
    laps: r.laps ? Number(r.laps) : undefined,
    time: r.Time?.time || null,           // ex) "1:29:33.283" 또는 null
    status: r.status || null,             // ex) "Finished", "+1 Lap", "DNF"
    points: r.points ? Number(r.points) : 0,
    fastestLap: flTime
      ? { lap: fl?.lap ? Number(fl.lap) : undefined, time: flTime, averageSpeed: flAvg }
      : undefined,
  };
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return r.json();
}

async function main() {
  // 1) 스케줄 + 결과 한 번에(리미트 크게)
  const base = `https://ergast.com/api/f1/${SEASON}`;
  const scheduleUrl = `${base}.json?limit=100`;          // 경기 기본 정보
  const resultsUrl  = `${base}/results.json?limit=1000`; // 전체 결과(전 경기)

  const [schedule, resultsAll] = await Promise.all([
    fetchJSON(scheduleUrl),
    fetchJSON(resultsUrl),
  ]);

  const races = schedule?.MRData?.RaceTable?.Races ?? [];
  const resultRaces = resultsAll?.MRData?.RaceTable?.Races ?? [];

  // 결과를 round 기준으로 빠르게 찾을 수 있게 맵 구성
  const byRound = new Map();
  for (const rr of resultRaces) {
    const key = String(rr.round);
    byRound.set(key, rr.Results ?? []);
  }

  // 2) 스키마 변환
  const payload = races.map((r) => {
    const round = Number(r.round);
    const circuitName = r.Circuit?.circuitName ?? "";
    const loc = r.Circuit?.Location;
    const location = [loc?.locality, loc?.country].filter(Boolean).join(", ");

    // 해당 라운드 결과
    const resArr = (byRound.get(String(round)) || []).map(toResult);
    const winner = pickWinner(byRound.get(String(round)) || []);

    return {
      season: Number(r.season),
      round,
      name: r.raceName,
      circuit: circuitName,
      date: { $date: ymd(r.date) },     // Compass Import 호환
      location,
      winner,
      results: resArr,
    };
  });

  // 3) 파일로 저장
  // server/exports/ 폴더에 기록
  const fs = await import("node:fs/promises");
  await fs.mkdir(new URL("../exports/", import.meta.url), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`✅ Wrote ${payload.length} races → ${OUT_PATH.pathname}`);
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
