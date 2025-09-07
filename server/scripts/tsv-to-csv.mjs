// Usage:
// node scripts/tsv-to-csv.mjs <season> <round>
// Ex) node scripts/tsv-to-csv.mjs 2019 1
//
// Reads:  server/data/<season>/paste.tsv
// Writes: server/data/<season>/r<round>.csv (with header)

import fs from "node:fs/promises";
import path from "node:path";

const season = Number(process.argv[2] || 2018);
const round  = Number(process.argv[3] || 1);

const dataDir = path.join(process.cwd(), "data", String(season));
console.log("DATA DIR:", dataDir);
const inFile  = path.join(dataDir, "paste.tsv");
const outFile = path.join(dataDir, `r${round}.csv`);
const customCodesFile = path.join(dataDir, "driver-codes.json");

// Basic code map (common names). Extend as needed.
const baseCodeMap = new Map([
  // 2018~2024 자주 등장
  ["lewis hamilton","HAM"],["valtteri bottas","BOT"],["george russell","RUS"],
  ["sebastian vettel","VET"],["charles leclerc","LEC"],["kimi raikkonen","RAI"],["kimi räikkönen","RAI"],
  ["max verstappen","VER"],["sergio perez","PER"],["sergio pérez","PER"],["daniel ricciardo","RIC"],
  ["lando norris","NOR"],["oscar piastri","PIA"],["carlos sainz jr.","SAI"],["carlos sainz","SAI"],
  ["fernando alonso","ALO"],["esteban ocon","OCO"],["pierre gasly","GAS"],["yuki tsunoda","TSU"],
  ["kevin magnussen","MAG"],["nico hulkenberg","HUL"],["nico hülkenberg","HUL"],["alexander albon","ALB"],["alex albon","ALB"],
  ["lance stroll","STR"],["logan sargeant","SAR"],["zhou guanyu","ZHO"],["guanyu zhou","ZHO"],
  ["daniel kvyat","KVY"],["daniil kvyat","KVY"],["brendon hartley","HAR"],["roman grosjean","GRO"],["romain grosjean","GRO"],
  ["marcus ericsson","ERI"],["sergey sirotkin","SIR"],["stoffel vandoorne","VAN"],
]);

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function loadCustomCodes() {
  try {
    const t = await fs.readFile(customCodesFile, "utf-8");
    const obj = JSON.parse(t);
    const m = new Map();
    for (const [k, v] of Object.entries(obj)) {
      m.set(normalizeName(k), String(v).trim().toUpperCase());
    }
    return m;
  } catch {
    return new Map();
  }
}

function codeFor(driverName, customMap) {
  const key = normalizeName(driverName);
  return customMap.get(key) || baseCodeMap.get(key) ||
         driverName.split(" ").slice(-1)[0].slice(0,3).toUpperCase(); // fallback
}

function toCSVCell(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\t")) {
    return '"' + s.replaceAll('"','""') + '"';
  }
  return s;
}

function guessStatus(timeOrRetired) {
  const s = (timeOrRetired || "").toLowerCase();
  if (!s) return null;
  if (s.includes("dnf") || s.includes("retired") || s.includes("disqualified") || s.includes("dns")) return timeOrRetired;
  if (s.includes("lap")) return timeOrRetired; // "+1 Lap", etc
  // looks like a time string → treat as Finished
  return "Finished";
}

async function main() {
  const customMap = await loadCustomCodes();

  const raw = await fs.readFile(inFile, "utf-8");
  const lines = raw.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) {
    console.error("No content in paste.tsv. Copy rows (without header) from Wikipedia and paste into this file.");
    process.exit(1);
  }

  // Wikipedia "Race result" typical copy columns:
  // Pos | No | Driver | Constructor | Laps | Time/Retired | Grid | Pts
  const rows = [];
  for (const line of lines) {
    const cols = line.split("\t").map(s => s.trim());
    if (cols.length < 8) continue;
    const position = Number(cols[0]) || undefined;
    const driverName = cols[2];
    const team = cols[3];
    const laps = cols[4] ? Number(cols[4]) : undefined;
    const timeOrRetired = cols[5];
    const grid = cols[6] ? Number(cols[6]) : undefined;
    const points = cols[7] ? Number(cols[7]) : undefined;

    rows.push({
      position,
      code: codeFor(driverName, customMap),
      driverName,
      team,
      grid,
      laps,
      time: (/^\+?[\d:.\+]+s$/.test(timeOrRetired)) ? timeOrRetired : null,
      status: guessStatus(timeOrRetired),
      points,
      flLap: "", flTime: "", flAvg: ""
    });
  }

  const header = "position,code,driverName,team,grid,laps,time,status,points,flLap,flTime,flAvg\n";
  const csv = header + rows.map(r =>
    [r.position, r.code, r.driverName, r.team, r.grid ?? "", r.laps ?? "", r.time ?? "", r.status ?? "", r.points ?? "", r.flLap, r.flTime, r.flAvg]
      .map(toCSVCell).join(",")
  ).join("\n") + "\n";

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(outFile, csv, "utf-8");
  console.log(`✅ Wrote server/data/${season}/r${round}.csv (${rows.length} rows)`);
}

main().catch(e => {
  console.error("Failed:", e);
  process.exit(1);
});
