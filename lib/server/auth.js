// Login from the env file: a short list of "email:password" pairs and a signed cookie. Pure functions.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "outreach_session";
export const SESSION_DAYS = 30;

/** "ada@x.com:pass1,bola@x.com:pass2" -> Map(email -> password). Split on the first ":" only. */
export function parseLogins(text) {
  const logins = new Map();
  for (const entry of String(text ?? "").split(",")) {
    const i = entry.indexOf(":");
    if (i < 1) continue;
    const email = entry.slice(0, i).trim().toLowerCase();
    const password = entry.slice(i + 1).trim();
    if (email && password) logins.set(email, password);
  }
  return logins;
}

const digest = (s) => createHash("sha256").update(String(s)).digest();

/** Constant-time check of an email and password against the list. */
export function checkLogin(logins, email, password) {
  const key = String(email ?? "").trim().toLowerCase();
  const expected = logins.get(key);
  // Always compare something, so a wrong email takes as long as a wrong password
  const ok = timingSafeEqual(digest(password), digest(expected ?? "\u0000no-such-user"));
  return ok && expected !== undefined ? key : null;
}

const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (body, secret) => createHmac("sha256", secret).update(body).digest("base64url");

/** A cookie value: payload.signature. Cannot be forged without the secret. */
export function signSession(email, secret, now = Date.now()) {
  const body = b64(JSON.stringify({ e: email, x: now + SESSION_DAYS * 86_400_000 }));
  return `${body}.${sign(body, secret)}`;
}

/** The email in a valid, unexpired cookie, or null. */
export function verifySession(token, secret, now = Date.now()) {
  if (!token || !secret) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const good = Buffer.from(sign(body, secret));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof e === "string" && x > now ? e : null;
  } catch {
    return null;
  }
}

/** Slows down password guessing: 5 wrong tries per address in 10 minutes. */
export function makeLimiter(max = 5, windowMs = 600_000) {
  const tries = new Map();
  return {
    blocked(id, now = Date.now()) {
      return (tries.get(id) ?? []).filter((t) => now - t < windowMs).length >= max;
    },
    fail(id, now = Date.now()) {
      tries.set(id, [...(tries.get(id) ?? []).filter((t) => now - t < windowMs), now]);
    },
    clear(id) {
      tries.delete(id);
    },
  };
}
