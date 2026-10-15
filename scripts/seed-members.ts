import { seedMembersFromWorkbook } from "../src/lib/members";
import { getDb } from "../src/lib/db";

getDb();
const result = seedMembersFromWorkbook();
console.log(
  `Seeded members: ${result.inserted} inserted, ${result.skipped} skipped (already present).`
);
if (result.names.length) {
  console.log("Sample:", result.names.slice(0, 10).join(", "));
}
