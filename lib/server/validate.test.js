import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanIds, cleanLeads, cleanList, cleanPatch } from "./validate.js";

test("cleanIds accepts whole-number ids only", () => {
  assert.deepEqual(cleanIds([1, 2, 3]), [1, 2, 3]);
  for (const bad of [[], "1", [1.5], ["1"], [0], [-2], null, Array.from({ length: 1001 }, (_, i) => i + 1)]) {
    assert.throws(() => cleanIds(bad), /ids|Ids/);
  }
});

test("cleanPatch keeps only stage and notes", () => {
  assert.deepEqual(cleanPatch({ stage: "first", notes: "hi", selected_by: "eve", id: 7 }), { stage: "first", notes: "hi" });
  assert.deepEqual(cleanPatch({ stage: null }), { stage: null });
});

test("cleanPatch refuses bad stages, non-text notes and empty changes", () => {
  assert.throws(() => cleanPatch({ stage: "hacked" }), /Unknown stage/);
  assert.throws(() => cleanPatch({ notes: 5 }), /text/);
  assert.throws(() => cleanPatch({ selected_by: "eve" }), /Nothing to change/);
  assert.throws(() => cleanPatch(null), /Nothing to change/);
});

test("cleanPatch cuts very long notes", () => {
  assert.equal(cleanPatch({ notes: "x".repeat(9000) }).notes.length, 5000);
});

const lead = (over = {}) => ({
  business: "Sunrise Cafe", type: "Cafes", website: "https://www.sunrise-test.com/menu", website_key: "WRONG",
  email: "hi@sunrise-test.com", phone: "+2348010001111", socials: { facebook: "https://facebook.com/x", instagram: "javascript:alert(1)", bogus: "https://a.com" },
  address: "1 Test Street", city: "Lagos", pitch: "Offer booking.", priority: 61.6, ...over,
});

test("cleanLeads works out the website key itself and keeps safe links only", () => {
  const [l] = cleanLeads([lead()]);
  assert.equal(l.website_key, "sunrise-test.com");
  assert.deepEqual(l.socials, { facebook: "https://facebook.com/x" });
  assert.equal(l.priority, 62);
});

test("cleanLeads drops rows with no name, and keeps a bad or missing website as no website", () => {
  assert.deepEqual(cleanLeads([lead({ business: "" })]), []);
  const [bad, none] = cleanLeads([lead({ website: "javascript:alert(1)" }), lead({ website: "" })]);
  assert.equal(bad.website, "");
  assert.equal(bad.website_key, "name:sunrise-cafe|2348010001111");
  assert.equal(none.website_key, bad.website_key);
});

test("cleanLeads refuses empty or oversized batches", () => {
  assert.throws(() => cleanLeads([]), /Import between/);
  assert.throws(() => cleanLeads(Array.from({ length: 501 }, () => lead())), /Import between/);
  assert.throws(() => cleanLeads("nope"), /Import between/);
});

test("cleanList trims the name and refuses an empty one", () => {
  assert.equal(cleanList("  Shortlets - Lagos "), "Shortlets - Lagos");
  assert.equal(cleanList("x".repeat(100)).length, 60);
  for (const bad of ["", "   ", null, 5, undefined]) assert.throws(() => cleanList(bad), /name/);
});
