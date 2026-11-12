// Shared by every API route: is the server set up, is the person signed in, and is the request from our own site.
import { cookies } from "next/headers";

import { COOKIE, verifySession } from "./auth.js";

export const isConfigured = () =>
  Boolean(process.env.TEAM_LOGINS && process.env.SESSION_SECRET && process.env.DATABASE_URL);

export const json = (data, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function currentUser() {
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value, process.env.SESSION_SECRET);
}

/** CSRF guard: a page on another site must not be able to post to us. */
export function sameOrigin(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // command-line tools send none; browsers always send one on cross-site posts
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** Wraps a route: checks setup, origin (for writes) and login, then turns errors into JSON. */
export function route(fn, { write = false } = {}) {
  return async (request, ctx) => {
    if (!isConfigured()) return json({ configured: false, error: "The server is not set up yet" }, 503);
    if (write && !sameOrigin(request)) return json({ error: "Cross-site request blocked" }, 403);
    const email = await currentUser();
    if (!email) return json({ error: "Not signed in" }, 401);
    try {
      return await fn({ request, email, params: ctx?.params ? await ctx.params : {} });
    } catch (err) {
      return json({ error: err.message || "Something went wrong" }, err.status || 500);
    }
  };
}
