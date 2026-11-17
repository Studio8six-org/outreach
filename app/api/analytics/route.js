import { cleanDays } from "../../../lib/server/analytics.js";
import { getAnalytics } from "../../../lib/server/db.js";
import { json, route } from "../../../lib/server/guard.js";

export const dynamic = "force-dynamic";

// Signed-in team members only (the guard checks the login cookie). ?days=7, 30 or 90.
export const GET = route(async ({ request }) => {
  const days = cleanDays(new URL(request.url).searchParams.get("days"));
  return json(await getAnalytics(days));
});
