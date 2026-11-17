// The one public door: the studio8six website posts its visits and enquiries here.
// It has no login (visitors have none), so it is strict instead: only our own site's origin, a small body,
// a short allow-list of event types, and a limit per address. It never stores an IP address or a cookie.
import { makeLimiter } from "../../../lib/server/auth.js";
import { allowedOrigins, cleanEvent, isBot } from "../../../lib/server/analytics.js";
import { recordEvent } from "../../../lib/server/db.js";

export const dynamic = "force-dynamic";

const MAX_BODY = 2000;
const limiter = makeLimiter(120, 60_000); // 120 events a minute from one address is far more than a real visitor

const reply = (status, origin) =>
  new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
      vary: "Origin",
      ...(origin && {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      }),
    },
  });

const originOf = (request) => {
  const origin = request.headers.get("origin");
  return origin && allowedOrigins(process.env.ANALYTICS_ORIGINS).includes(origin) ? origin : null;
};

// The browser asks permission first on some requests
export async function OPTIONS(request) {
  const origin = originOf(request);
  return origin ? reply(204, origin) : reply(403);
}

export async function POST(request) {
  const origin = originOf(request);
  if (!origin) return reply(403);
  if (!process.env.DATABASE_URL) return reply(503, origin);
  if (isBot(request.headers.get("user-agent"))) return reply(204, origin); // accepted, not counted

  const who = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limiter.blocked(who)) return reply(429, origin);
  limiter.fail(who); // every request counts toward the limit

  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return reply(400, origin);
  try {
    const body = JSON.parse(text);
    // Vercel tells us the visitor's country; we keep the two letters and drop the address
    await recordEvent(cleanEvent(body, request.headers.get("x-vercel-ip-country") || ""));
  } catch (err) {
    return reply(err.status === 400 || err instanceof SyntaxError ? 400 : 500, origin);
  }
  return reply(204, origin);
}
