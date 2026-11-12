// The rules for changing one lead. Pure, so it is tested without a database.
export const STAGE_VALUES = ["first", "followup1", "followup2", "responded", "no_response"];

/** Applies a change to one lead. Says what changed, and the history event to log (or null). */
export function applyPatch(lead, patch, user, now) {
  const next = { ...lead };
  let event = null;
  if ("notes" in patch) next.notes = String(patch.notes).slice(0, 5000);
  if ("stage" in patch) {
    const stage = patch.stage || null;
    if (stage !== null && !STAGE_VALUES.includes(stage)) throw new Error("Unknown stage");
    if (stage !== lead.stage) {
      next.stage = stage;
      next.stage_changed_at = now;
      if (!lead.stage && stage) {
        next.selected_by = user || null; // who picked it, and when
        next.selected_at = now;
      } else if (!stage) {
        next.selected_by = null;
        next.selected_at = null;
      }
      event = { lead_id: lead.id, user_email: user, from_stage: lead.stage, to_stage: stage, created_at: now };
    }
  }
  return { lead: next, event };
}
