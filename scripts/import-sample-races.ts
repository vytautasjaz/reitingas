/**
 * One-shot helper: seed members + import Druskininkai OD/SD sample files.
 */
import fs from "fs";
import path from "path";
import { getDb } from "../src/lib/db";
import { backfillMemberSexFromNames, seedMembersFromWorkbook } from "../src/lib/members";
import { importRace } from "../src/lib/import-race";

const db = getDb();

const seed = seedMembersFromWorkbook();
console.log(`Members: +${seed.inserted} (skipped ${seed.skipped})`);
const backfilled = backfillMemberSexFromNames();
console.log(`Sex backfill from names: ${backfilled}`);

// Re-import cleanly so sex comes from protocol Sx/Cat columns.
db.exec("DELETE FROM race_results");
db.exec("DELETE FROM races");

const resultsDir = path.join(process.cwd(), "Results");

const jobs = [
  {
    file: "2026-09-05_LTT_Druskinikai_OD.xls",
    name: "Druskininkai OD",
    raceDate: "2026-09-05",
    distanceType: "olympic" as const,
  },
  {
    file: "2026-09-05_LTT_Druskinikai_SD.xls",
    name: "Druskininkai SD",
    raceDate: "2026-09-05",
    distanceType: "sprint" as const,
  },
];

for (const job of jobs) {
  const full = path.join(resultsDir, job.file);
  const buffer = fs.readFileSync(full);
  const result = importRace({
    ...job,
    sourceFilename: job.file,
    fileBuffer: buffer,
  });
  console.log(
    `${job.name}: tritonas=${result.tritonasRows}, included=${result.included}, new=${result.newMembers.length}`
  );
}

const sexes = db
  .prepare(
    `SELECT sex, COUNT(*) AS n FROM members WHERE active = 1 GROUP BY sex ORDER BY sex`
  )
  .all();
console.log("Member sex distribution:", sexes);
