import { getDb } from "../src/lib/db";
import { repairMemberSexes } from "../src/lib/members";

getDb();
const result = repairMemberSexes();
console.log(`Narių pataisyta: ${result.membersFixed}`);
console.log(`Rezultatų eilučių atnaujinta: ${result.resultsFixed}`);
for (const line of result.details) {
  console.log(" -", line);
}
