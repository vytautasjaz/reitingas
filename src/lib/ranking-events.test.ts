import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupRacesIntoEvents } from "./ranking";
import type { Race } from "./db";

function race(
  partial: Partial<Race> & Pick<Race, "id" | "name" | "race_date" | "meet_id">
): Race {
  return {
    distance_type: "olympic",
    base_points: 1000,
    source_filename: null,
    leader_time_seconds: null,
    field_size: null,
    field_size_m: null,
    field_size_f: null,
    created_at: "2026-01-01",
    ...partial,
  };
}

describe("groupRacesIntoEvents", () => {
  it("merges OD and SD under the same meet_id into one event", () => {
    const events = groupRacesIntoEvents([
      race({
        id: 1,
        name: "Druskininkai OD",
        race_date: "2026-09-05",
        distance_type: "olympic",
        meet_id: 10,
      }),
      race({
        id: 2,
        name: "Druskininkai SD",
        race_date: "2026-09-05",
        distance_type: "sprint",
        meet_id: 10,
      }),
      race({
        id: 3,
        name: "Molėtai",
        race_date: "2026-08-23",
        meet_id: 11,
      }),
    ]);
    assert.equal(events.length, 2);
    assert.equal(events[0].date, "2026-08-23");
    assert.equal(events[1].date, "2026-09-05");
    assert.equal(events[1].races.length, 2);
    assert.equal(events[1].id, 10);
  });
});
