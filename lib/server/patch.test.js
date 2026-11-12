import assert from "node:assert/strict";
import { test } from "node:test";

import { applyPatch } from "./patch.js";

const base = { id: 7, stage: null, selected_by: null, selected_at: null, stage_changed_at: null, notes: "" };

test("picking a lead records who picked it and when, and gives an event", () => {
  const { lead, event } = applyPatch(base, { stage: "first" }, "ada@x.test", "T1");
  assert.equal(lead.stage, "first");
  assert.equal(lead.selected_by, "ada@x.test");
  assert.equal(lead.selected_at, "T1");
  assert.deepEqual(event, { lead_id: 7, user_email: "ada@x.test", from_stage: null, to_stage: "first", created_at: "T1" });
});

test("moving on keeps the original picker", () => {
  const picked = applyPatch(base, { stage: "first" }, "ada@x.test", "T1").lead;
  const { lead, event } = applyPatch(picked, { stage: "followup1" }, "bola@x.test", "T2");
  assert.equal(lead.selected_by, "ada@x.test");
  assert.equal(lead.stage_changed_at, "T2");
  assert.equal(event.from_stage, "first");
  assert.equal(event.user_email, "bola@x.test");
});

test("removing from outreach clears who picked it", () => {
  const picked = applyPatch(base, { stage: "first" }, "ada@x.test", "T1").lead;
  const { lead, event } = applyPatch(picked, { stage: null }, "ada@x.test", "T2");
  assert.equal(lead.stage, null);
  assert.equal(lead.selected_by, null);
  assert.equal(lead.selected_at, null);
  assert.equal(event.to_stage, null);
});

test("an unchanged stage gives no event, and notes can be saved", () => {
  const picked = applyPatch(base, { stage: "first" }, "ada@x.test", "T1").lead;
  assert.equal(applyPatch(picked, { stage: "first" }, "ada@x.test", "T2").event, null);
  const { lead, event } = applyPatch(picked, { notes: "called back" }, "ada@x.test", "T2");
  assert.equal(lead.notes, "called back");
  assert.equal(event, null);
});

test("an unknown stage is refused", () => {
  assert.throws(() => applyPatch(base, { stage: "hacked" }, "ada@x.test", "T1"), /Unknown stage/);
});
