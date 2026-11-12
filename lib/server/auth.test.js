import assert from "node:assert/strict";
import { test } from "node:test";

import { checkLogin, makeLimiter, parseLogins, signSession, verifySession } from "./auth.js";

const SECRET = "a-long-test-secret-that-is-not-real-0123456789";

test("parseLogins reads email:password pairs", () => {
  const logins = parseLogins("Ada@Agency.test:pass1, bola@agency.test:pa:ss2 ,broken,:nope,x@y.test:");
  assert.deepEqual([...logins], [["ada@agency.test", "pass1"], ["bola@agency.test", "pa:ss2"]]);
  assert.equal(parseLogins(undefined).size, 0);
});

test("checkLogin accepts the right password and any email case", () => {
  const logins = parseLogins("ada@agency.test:pass1");
  assert.equal(checkLogin(logins, "ADA@agency.test ", "pass1"), "ada@agency.test");
});

test("checkLogin refuses wrong passwords, unknown emails and empty input", () => {
  const logins = parseLogins("ada@agency.test:pass1");
  assert.equal(checkLogin(logins, "ada@agency.test", "pass2"), null);
  assert.equal(checkLogin(logins, "eve@agency.test", "pass1"), null);
  assert.equal(checkLogin(logins, "", ""), null);
  assert.equal(checkLogin(logins, undefined, undefined), null);
});

test("a signed session comes back as the email", () => {
  const token = signSession("ada@agency.test", SECRET, 1_000);
  assert.equal(verifySession(token, SECRET, 2_000), "ada@agency.test");
});

test("a session expires after 30 days", () => {
  const token = signSession("ada@agency.test", SECRET, 0);
  assert.equal(verifySession(token, SECRET, 29 * 86_400_000), "ada@agency.test");
  assert.equal(verifySession(token, SECRET, 31 * 86_400_000), null);
});

test("a changed, forged or wrongly signed session is refused", () => {
  const token = signSession("ada@agency.test", SECRET, 1_000);
  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ e: "eve@agency.test", x: 9e15 })).toString("base64url");
  assert.equal(verifySession(`${forged}.${sig}`, SECRET, 2_000), null);
  assert.equal(verifySession(token, "another-secret", 2_000), null);
  assert.equal(verifySession(`${body}.`, SECRET, 2_000), null);
  assert.equal(verifySession("garbage", SECRET, 2_000), null);
  assert.equal(verifySession(undefined, SECRET, 2_000), null);
  assert.equal(verifySession(token, "", 2_000), null);
});

test("the limiter blocks after five misses and lets go after the window", () => {
  const limiter = makeLimiter(5, 1000);
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.blocked("1.2.3.4", i), false);
    limiter.fail("1.2.3.4", i);
  }
  assert.equal(limiter.blocked("1.2.3.4", 10), true);
  assert.equal(limiter.blocked("5.6.7.8", 10), false);
  assert.equal(limiter.blocked("1.2.3.4", 5000), false);
  limiter.fail("1.2.3.4", 5000);
  limiter.clear("1.2.3.4");
  assert.equal(limiter.blocked("1.2.3.4", 5001), false);
});
