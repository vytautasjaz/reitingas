import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferSexFromName, normalizeSex } from "./gender";

describe("normalizeSex", () => {
  it("reads Male/Female", () => {
    assert.equal(normalizeSex("Male", null), "M");
    assert.equal(normalizeSex("Female", "M40"), "F");
  });

  it("uses Lithuanian categories", () => {
    assert.equal(normalizeSex(null, "V35"), "M");
    assert.equal(normalizeSex(null, "M40"), "F");
    assert.equal(normalizeSex(null, "F30"), "F");
  });
});

describe("inferSexFromName", () => {
  it("detects Lithuanian endings", () => {
    assert.equal(inferSexFromName("Sigita Šidlauskienė"), "F");
    assert.equal(inferSexFromName("Mantas Jablonskis"), "M");
  });
});
