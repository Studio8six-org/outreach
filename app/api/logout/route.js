import { cookies } from "next/headers";

import { COOKIE } from "../../../lib/server/auth.js";
import { json, sameOrigin } from "../../../lib/server/guard.js";

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "Cross-site request blocked" }, 403);
  const jar = await cookies();
  jar.delete(COOKIE);
  return json({ ok: true });
}
