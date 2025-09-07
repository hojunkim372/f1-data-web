// Usage:
// node scripts/make-csv-templates.mjs 2019 21
// node scripts/make-csv-templates.mjs 2024 24

import fs from "node:fs/promises";
import path from "node:path";

const season = Number(process.argv[2]);
const rounds = Number(process.argv[3]);

if (!season || !rounds) {
  console.error("Usage: node scripts/make-csv-templates.mjs <season> <rounds>");
  process.exit(1);
}

const dir = path.join(process.cwd(), "server", "data", String(season));
const header = "position,code,driverName,team,grid,laps,time,status,points,flLap,flTime,flAvg\n";

await fs.mkdir(dir, { recursive: true });
for (let r = 1; r <= rounds; r++) {
  const f = path.join(dir, `r${r}.csv`);
  await fs.writeFile(f, header, "utf-8");
}
console.log(`✅ Created ${rounds} templates in server/data/${season}/`);
