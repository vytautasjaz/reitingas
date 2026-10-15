import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestNSum,
  bestNSumWithForeignLimit,
  calculatePoints,
  parseTimeToSeconds,
} from "./scoring";
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

describe("bestNSumWithForeignLimit", () => {
  it("matches plain best-3 when no foreign scores", () => {
    assert.equal(
      bestNSumWithForeignLimit(
        [{ points: 100 }, { points: 200 }, { points: 50 }, { points: 300 }],
        3
      ),
      600
    );
  });

  it("keeps at most one foreign start in the best-3", () => {
    // Two strong foreign + two domestic — only best foreign may enter.
    assert.equal(
      bestNSumWithForeignLimit(
        [
          { points: 1100, foreign: true },
          { points: 1050, foreign: true },
          { points: 900 },
          { points: 850 },
        ],
        3
      ),
      1100 + 900 + 850
    );
  });

  it("drops a weak foreign when three domestics are better", () => {
    assert.equal(
      bestNSumWithForeignLimit(
        [
          { points: 700, foreign: true },
          { points: 1000 },
          { points: 950 },
          { points: 900 },
        ],
        3
      ),
      1000 + 950 + 900
    );
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
