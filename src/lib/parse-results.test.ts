import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "fs";
import path from "path";
import { parseResultsHtml } from "./parse-results";
import { clubMentionsTritonas } from "./club";

describe("parseResultsHtml Druskininkai", () => {
  it("parses OD and finds Tritonas athletes", () => {
    const file = path.join(process.cwd(), "Results", "2026-09-05_LTT_Druskinikai_OD.xls");
    const html = fs.readFileSync(file, "utf8");
    const parsed = parseResultsHtml(html);
    assert.ok(parsed.rows.length > 100);
    assert.ok(parsed.leaderTimeSeconds != null);
    const trit = parsed.rows.filter((r) => clubMentionsTritonas(r.club));
    assert.equal(trit.length, 18);
    assert.ok(/jablonskis/i.test(parsed.rows[0].name));
  });

  it("parses SD Tritonas count", () => {
    const file = path.join(process.cwd(), "Results", "2026-09-05_LTT_Druskinikai_SD.xls");
    const html = fs.readFileSync(file, "utf8");
    const parsed = parseResultsHtml(html);
    const trit = parsed.rows.filter((r) => clubMentionsTritonas(r.club));
    assert.equal(trit.length, 14);
  });
});
