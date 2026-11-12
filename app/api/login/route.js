import { COOKIE, SESSION_DAYS, checkLogin, makeLimiter, parseLogins, signSession } from "../../../lib/server/auth.js";
import { isConfigured, json, sameOrigin } from "../../../lib/server/guard.js";
import { cookies } from "next/headers";

const limiter = makeLimiter();

export async function POST(request) {
  if (!isConfigured()) return json({ configured: false, error: "The server is not set up yet" }, 503);
  if (!sameOrigin(request)) return json({ error: "Cross-site request blocked" }, 403);

  const who = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limiter.blocked(who)) return json({ error: "Too many wrong tries. Wait 10 minutes and try again." }, 429);

  const body = await request.json().catch(() => ({}));
  const email = checkLogin(parseLogins(process.env.TEAM_LOGINS), body.email, body.password);
  if (!email) {
    limiter.fail(who);
    await new Promise((r) => setTimeout(r, 500)); // makes guessing slower
    return json({ error: "Wrong email or password." }, 401);
  }

  limiter.clear(who);
  const jar = await cookies();
  jar.set(COOKIE, signSession(email, process.env.SESSION_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return json({ email });
}
