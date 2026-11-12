import { route, json } from "../../../../lib/server/guard.js";
import { importLeads } from "../../../../lib/server/db.js";
import { cleanLeads } from "../../../../lib/server/validate.js";

export const POST = route(
  async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const leads = cleanLeads(body.leads);
    return json(await importLeads(leads));
  },
  { write: true },
);
