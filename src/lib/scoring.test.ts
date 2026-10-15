import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bestNSum, calculatePoints, parseTimeToSeconds } from "./scoring";
import { normalizeName, namesMatch, toDisplayName } from "./names";
import { clubMentionsTritonas, isMixedTritonasClub, isPureTritonasClub } from "./club";

describe("parseTimeToSeconds", () => {
  it("parses h:mm:ss.s", () => {
    assert.equal(parseTimeToSeconds("2:03:54.4"), 2 * 3600 + 3 * 60 + 54.4);
  });

  it("parses mm:ss.s", () => {
    assert.equal(parseTimeToSeconds("1:19.4"), 79.4);
  });
});

describe("calculatePoints", () => {
  it("gives leader base points", () => {
    assert.equal(calculatePoints(7434.4, 7434.4, 1000), 1000);
  });

  it("scales from leader for OD sample", () => {
    // Airidas ~2:09:29.3
    const pts = calculatePoints(7434.4, 2 * 3600 + 9 * 60 + 29.3, 1000);
    assert.equal(pts, 957);
  });

  it("scales sprint base 900", () => {
    const leader = 1 * 3600 + 8 * 60 + 19;
    const ath = 1 * 3600 + 13 * 60 + 2.4;
    assert.equal(calculatePoints(leader, ath, 900), 842);
  });
});

describe("bestNSum", () => {
  it("sums top 3", () => {
    assert.equal(bestNSum([100, 200, 50, 300], 3), 600);
  });
});

describe("names", () => {
  it("matches reordered and cased names", () => {
    assert.ok(namesMatch("JABLONSKIS Mantas", "Mantas Jablonskis"));
    assert.equal(normalizeName("Mantas JABLONSKIS"), normalizeName("Jablonskis Mantas"));
  });

  it("formats display name", () => {
    assert.equal(toDisplayName("JABLONSKIS Mantas"), "Mantas Jablonskis");
  });
});

describe("club", () => {
  it("detects tritonas variants", () => {
    assert.ok(clubMentionsTritonas("TRItonas"));
    assert.ok(clubMentionsTritonas("tritonas"));
    assert.ok(clubMentionsTritonas("Lietuvos kariuomenė / TRItonas"));
    assert.ok(isPureTritonasClub("TRItonas"));
    assert.ok(isMixedTritonasClub("Lietuvos kariuomenė/TRItonas"));
    assert.equal(isPureTritonasClub("Lietuvos kariuomenė / TRItonas"), false);
  });
});
