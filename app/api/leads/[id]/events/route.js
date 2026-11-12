import { route, json } from "../../../../../lib/server/guard.js";
import { listEvents } from "../../../../../lib/server/db.js";
import { BadRequest } from "../../../../../lib/server/validate.js";

export const GET = route(async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw new BadRequest("Bad id");
  return json({ events: await listEvents(id) });
});
