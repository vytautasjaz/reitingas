import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzePaste,
  parsePastedParticipantLines,
} from "./manual-paste";

describe("parsePastedParticipantLines", () => {
  it("parses name + time TSV from Excel", () => {
    const rows = parsePastedParticipantLines(
      "Airidas Gražinskis\t4:21:57\nAleksej Kaminskij\t4:34:59"
    );
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      place: "",
      name: "Airidas Gražinskis",
      time: "4:21:57",
    });
    assert.equal(rows[1].name, "Aleksej Kaminskij");
  });

  it("parses place + name + time", () => {
    const rows = parsePastedParticipantLines(
      "12\tMantas Marcinkevičius\t4:43:12"
    );
    assert.deepEqual(rows[0], {
      place: "12",
      name: "Mantas Marcinkevičius",
      time: "4:43:12",
    });
  });

  it("skips a header row", () => {
    const rows = parsePastedParticipantLines(
      "Vardas\tLaikas\nJonas Jonaitis\t1:10:00"
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Jonas Jonaitis");
  });
});

describe("analyzePaste", () => {
  it("treats a name list as a single column", () => {
    const result = analyzePaste("Airidas Gražinskis\nAleksej Kaminskij\nLukas");
    assert.deepEqual(result, {
      kind: "column",
      values: ["Airidas Gražinskis", "Aleksej Kaminskij", "Lukas"],
    });
  });

  it("treats a time list as a single column", () => {
    const result = analyzePaste("4:21:57\n4:34:59\n4:35:12");
    assert.deepEqual(result, {
      kind: "column",
      values: ["4:21:57", "4:34:59", "4:35:12"],
    });
  });

  it("keeps multi-column paste as rows", () => {
    const result = analyzePaste("Airidas\t4:21:57\nAleksej\t4:34:59");
    assert.equal(result?.kind, "rows");
    if (result?.kind === "rows") {
      assert.equal(result.rows.length, 2);
      assert.equal(result.rows[0].name, "Airidas");
      assert.equal(result.rows[0].time, "4:21:57");
    }
  });
});
