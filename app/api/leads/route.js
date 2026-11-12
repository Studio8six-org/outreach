import { route, json } from "../../../lib/server/guard.js";
import { listLeads } from "../../../lib/server/db.js";

export const dynamic = "force-dynamic";

export const GET = route(async () => json({ leads: await listLeads() }));
