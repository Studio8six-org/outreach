import { route, json } from "../../../../lib/server/guard.js";
import { deleteLeads } from "../../../../lib/server/db.js";
import { cleanIds } from "../../../../lib/server/validate.js";

export const POST = route(
  async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    return json(await deleteLeads(cleanIds(body.ids)));
  },
  { write: true },
);
