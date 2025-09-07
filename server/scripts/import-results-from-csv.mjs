// server/scripts/import-results-from-csv.mjs
// Usage: node scripts/import-results-from-csv.mjs 2018
// Reads all r*.csv in server/data/<season>/ and updates races collection.

import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/f1db";
const season = Number(process.argv[2]);

if (!season) {
  console.error("Usage: node scripts/import-results-from-csv.mjs <season>");
  process.exit(1);
}

// server 폴더에서 실행한다고 가정 (…/f1-data-site/server)
const dataDir = path.join(process.cwd(), "data", String(season));
console.log("DATA DIR:", dataDir);

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// 숫자만 뽑아 파싱 (문자 섞여도 복구)
function toNumberOrUndef(v) {
  if (v === undefined || v === null) return undefined;
  const num = String(v).replace(/[^\d.-]/g, "").trim();
  if (!num) return undefined;
  const n = Number(num);
  return Number.isFinite(n) ? n : undefined;
}

const ResultSchema = new mongoose.Schema({
  position: Number, // 숫자 아닌 경우 undefined로 저장 (정렬 때 뒤로 감)
  driver: { code: String, name: String, team: String },
  grid: Number,
  laps: Number,
  time: String,
  status: String,   // "Retired", "DNF", "DNS", "DSQ", "+1 Lap", "Finished" 등
  points: Number,
  fastestLap: { lap: Number, time: String, averageSpeed: Number },
}, { _id: false });

const Race = mongoose.model("Race", new mongoose.Schema({
  season: Number,
  round: Number,
  name: String,
  circuit: String,
  date: Date,
  location: String,
  winner: { code: String, name: String, team: String },
  results: [ResultSchema],
}, { versionKey: false }));

async function loadCSV(filePath) {
  const text = await fs.readFile(filePath, "utf-8");
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length <= 1) return [];

  // 헤더: BOM 제거 + 트림
  let header = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, "").trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]).map(c => (c ?? "").trim());
    const row = Object.fromEntries(header.map((h, idx) => [h, cols[idx] ?? ""]));

    // 위키 복사 시 국적이 driverName 앞에 붙는 케이스 정리 ("Germany Sebastian Vettel" 등)
    if (row.driverName) {
      row.driverName = row.driverName.replace(/^[A-Za-z .-]+?\s+(?=[A-Z][a-z]+)/, "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function deriveStatusFromPositionText(posText) {
  const s = (posText || "").toLowerCase();
  if (!s) return null;
  if (s.startsWith("ret")) return "Retired";
  if (s === "dnf") return "DNF";
  if (s === "dns") return "DNS";
  if (s === "dsq" || s === "dq") return "DSQ";
  return null;
}

function rowToResult(row) {
  // position: 숫자 or undefined
  const posNum = toNumberOrUndef(row.position);
  const posText = String(row.position || "").trim();

  // status: 우선 CSV의 status 사용, 없으면 position 텍스트로부터 유추
  let status = (row.status && row.status.trim()) || deriveStatusFromPositionText(posText);

  // "+1 Lap" 같은 것도 status로 들어오면 그대로 유지
  if (!status && row.time && /^\+\d+\s*Lap/i.test(row.time)) {
    status = row.time.trim();
  }

  const grid = toNumberOrUndef(row.grid);
  const laps = toNumberOrUndef(row.laps);
  const points = toNumberOrUndef(row.points);
  const flLap = toNumberOrUndef(row.flLap);
  const flAvg = toNumberOrUndef(row.flAvg);

  const fastestLap = (row.flTime && row.flTime.trim())
    ? { lap: flLap, time: row.flTime.trim(), averageSpeed: flAvg }
    : undefined;

  return {
    position: posNum, // 숫자 아니면 undefined
    driver: {
      code: String(row.code || "").trim(),
      name: String(row.driverName || "").trim(),
      team: String(row.team || "").trim(),
    },
    grid,
    laps,
    time: row.time?.trim() || null,
    status: status || (row.time ? "Finished" : null), // time 있으면 기본 Finished
    points: points ?? 0,
    fastestLap,
  };
}

async function updateOneCSV(file) {
  const m = file.match(/^r(\d+)\.csv$/i);
  if (!m) return;
  const round = Number(m[1]);

  const csvPath = path.join(dataDir, file);
  const rows = await loadCSV(csvPath);

  // ▶︎ 드라이버 이름이 있는 행은 모두 결과에 포함 (position이 숫자가 아니어도 OK)
  const results = rows.map(rowToResult).filter(r => !!(r.driver && r.driver.name));

  // 정렬: 숫자 position 먼저, 그 다음 undefined(비숫자/Ret 등)
  results.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));

  console.log(`ROUND ${round} parsed rows:`, results.length);

  const race = await Race.findOne({ season, round });
  if (!race) {
    console.log(`! no race doc for season=${season} round=${round}`);
    return;
  }

  await Race.updateOne({ _id: race._id }, { $set: { results } });
  console.log(`✓ updated round ${round} (${results.length} results)`);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Mongo connected:", MONGODB_URI);

  const exists = await fs.access(dataDir).then(() => true).catch(() => false);
  if (!exists) {
    console.error(`No data dir: ${dataDir}`);
    process.exit(1);
  }

  const files = (await fs.readdir(dataDir))
    .filter(f => /^r\d+\.csv$/i.test(f))
    .sort((a,b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  console.log("FILES:", files);

  if (!files.length) {
    console.log("No r*.csv files found.");
  } else {
    for (const f of files) {
      await updateOneCSV(f);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
