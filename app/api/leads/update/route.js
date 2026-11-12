import { route, json } from "../../../../lib/server/guard.js";
import { updateLeads } from "../../../../lib/server/db.js";
import { cleanIds, cleanPatch } from "../../../../lib/server/validate.js";

export const POST = route(
  async ({ request, email }) => {
    const body = await request.json().catch(() => ({}));
    const ids = cleanIds(body.ids);
    const patch = cleanPatch(body.patch);
    // The person's email comes from the signed cookie, never from the browser's request
    const { leads } = await updateLeads(ids, patch, email);
    return json({ leads });
  },
  { write: true },
);
