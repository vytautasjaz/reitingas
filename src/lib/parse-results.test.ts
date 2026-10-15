import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "fs";
import path from "path";
import {
  parseResultsFileBuffer,
  parseResultsHtml,
} from "./parse-results";
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

describe("parseResultsFileBuffer Gdansk compact xlsx", () => {
  it("reads leader time from first row and Tritonas roster", () => {
    const file = path.join(
      process.cwd(),
      "Results",
      "2026-06-21 _Gdansk_Half.xlsx"
    );
    const parsed = parseResultsFileBuffer(fs.readFileSync(file));
    assert.equal(parsed.leaderTimeSeconds, 3 * 3600 + 57 * 60 + 55);
    assert.equal(parsed.rows.length, 17);
    assert.equal(parsed.rows[0].name, "Airidas Gražinskis");
    assert.equal(parsed.rows[0].club, "TRItonas");
    assert.equal(parsed.rows[0].place, 1);
    assert.ok(parsed.rows[0].timeSeconds != null);
    assert.ok(parsed.rows.every((r) => clubMentionsTritonas(r.club)));
  });
});
