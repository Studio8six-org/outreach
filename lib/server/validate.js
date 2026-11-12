// Checks everything the browser sends before it goes near the database. Pure functions.
import { SOCIALS, STAGES, safeUrl, websiteKey } from "../leads.js";

export const MAX_IDS = 1000;
export const MAX_IMPORT = 500;
export const MAX_NOTES = 5000;

export class BadRequest extends Error {
  status = 400;
}

/** A list of whole-number ids. */
export function cleanIds(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_IDS) throw new BadRequest("Send between 1 and 1000 ids");
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) throw new BadRequest("Ids must be whole numbers");
  return ids;
}

/** Only the two things a person may change: the stage and the notes. */
export function cleanPatch(patch) {
  if (!patch || typeof patch !== "object") throw new BadRequest("Nothing to change");
  const out = {};
  if ("stage" in patch) {
    if (patch.stage !== null && !STAGES.some((s) => s.key === patch.stage)) throw new BadRequest("Unknown stage");
    out.stage = patch.stage;
  }
  if ("notes" in patch) {
    if (typeof patch.notes !== "string") throw new BadRequest("Notes must be text");
    out.notes = patch.notes.slice(0, MAX_NOTES);
  }
  if (!Object.keys(out).length) throw new BadRequest("Nothing to change");
  return out;
}

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Leads from an import. The website key is worked out here, never trusted from the browser. */
export function cleanLeads(leads) {
  if (!Array.isArray(leads) || !leads.length || leads.length > MAX_IMPORT) {
    throw new BadRequest(`Import between 1 and ${MAX_IMPORT} leads at a time`);
  }
  return leads.flatMap((l) => {
    const website = safeUrl(l?.website);
    const key = websiteKey(website);
    const business = text(l?.business, 200);
    if (!business || !key) return [];
    const socials = {};
    for (const name of SOCIALS) {
      const url = safeUrl(l?.socials?.[name]);
      if (url) socials[name] = url.slice(0, 500);
    }
    return [{
      business, type: text(l.type, 100), website: website.slice(0, 500), website_key: key,
      email: text(l.email, 500), phone: text(l.phone, 200), socials,
      address: text(l.address, 300), city: text(l.city, 100), pitch: text(l.pitch, 2000),
      priority: Number.isFinite(l.priority) ? Math.round(l.priority) : 0,
    }];
  });
}
