import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allowedOrigins, classifySource, cleanDays, cleanEvent, cleanPage, hostOf, isBot, rangeWindow,
} from "./analytics.js";

test("hostOf keeps only the host", () => {
  assert.equal(hostOf("https://www.Google.com/search?q=secret"), "google.com");
  assert.equal(hostOf("android-app://com.instagram.android"), "com.instagram.android");
  assert.equal(hostOf(""), "");
  assert.equal(hostOf(undefined), "");
});

test("classifySource: tagged links win over the referrer", () => {
  const r = classifySource({ ref: "https://google.com/", utmSource: "Instagram", utmMedium: "bio", utmCampaign: "Nov Launch" });
  assert.deepEqual(r, { source: "instagram", medium: "bio", campaign: "nov launch" });
  assert.equal(classifySource({ utmSource: "newsletter" }).medium, "campaign");
});

test("classifySource: known sites, other sites, and direct", () => {
  assert.deepEqual(classifySource({ ref: "https://www.google.com.ng/" }), { source: "google", medium: "organic", campaign: "" });
  assert.equal(classifySource({ ref: "https://l.instagram.com/?u=x" }).source, "instagram");
  assert.equal(classifySource({ ref: "https://t.co/abc" }).source, "x");
  assert.equal(classifySource({ ref: "https://wa.me/234" }).medium, "social");
  assert.deepEqual(classifySource({ ref: "https://some-blog.com/post" }), { source: "some-blog.com", medium: "referral", campaign: "" });
  assert.equal(classifySource({ ref: "" }).source, "direct");
  assert.equal(classifySource({ ref: "https://www.studio8six.com/schools" }).source, "direct"); // our own site
  assert.equal(classifySource({ ref: "https://studio8six.com/" }).source, "direct");
});

test("cleanPage drops queries and trailing slashes", () => {
  assert.equal(cleanPage("/schools/?utm_source=x"), "/schools");
  assert.equal(cleanPage("/"), "/");
  assert.equal(cleanPage("https://evil.com"), "/");
  assert.equal(cleanPage(undefined), "/");
});

test("cleanEvent accepts a good event and cuts everything else", () => {
  const row = cleanEvent(
    { kind: "pageview", session: "abc12345XYZ", page: "/schools?x=1", ref: "https://www.google.com/", device: "mobile", extra: "ignored" },
    "NG",
  );
  assert.deepEqual(row, {
    kind: "pageview", session_id: "abc12345XYZ", page: "/schools", source: "google", medium: "organic",
    campaign: "", referrer_host: "google.com", device: "mobile", country: "NG",
  });
  assert.equal(cleanEvent({ kind: "pageview", session: "abc12345XYZ", device: "toaster" }, "nigeria").device, "unknown");
  assert.equal(cleanEvent({ kind: "pageview", session: "abc12345XYZ" }, "nigeria").country, "");
});

test("cleanEvent rejects bad input", () => {
  assert.throws(() => cleanEvent(null), { status: 400 });
  assert.throws(() => cleanEvent({ kind: "delete", session: "abc12345XYZ" }), { status: 400 });
  assert.throws(() => cleanEvent({ kind: "pageview", session: "x" }), { status: 400 });
  assert.throws(() => cleanEvent({ kind: "pageview", session: "bad session!" }), { status: 400 });
  assert.throws(() => cleanEvent({ kind: "pageview" }), { status: 400 });
});

test("isBot", () => {
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBot(""), true);
  assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"), false);
});

test("allowedOrigins adds extra origins and trims slashes", () => {
  assert.ok(allowedOrigins().includes("https://www.studio8six.com"));
  assert.ok(allowedOrigins("http://localhost:5173/, https://x.test").includes("http://localhost:5173"));
  assert.ok(allowedOrigins("https://x.test").includes("https://x.test"));
});

test("cleanDays only allows 7, 30 or 90", () => {
  assert.equal(cleanDays("7"), 7);
  assert.equal(cleanDays("90"), 90);
  assert.equal(cleanDays("1000000"), 30);
  assert.equal(cleanDays(undefined), 30);
});

test("rangeWindow cuts days at Lagos midnight", () => {
  // 2026-11-17 23:30 UTC is already 00:30 on 18 Nov in Lagos
  const w = rangeWindow(7, Date.UTC(2026, 10, 17, 23, 30));
  assert.equal(w.lastDay, "2026-11-18");
  assert.equal(w.firstDay, "2026-11-12");
  assert.equal(w.since.toISOString(), "2026-11-11T23:00:00.000Z"); // 12 Nov 00:00 Lagos
  // 10:00 UTC the same day is still 17 Nov in Lagos
  assert.equal(rangeWindow(1, Date.UTC(2026, 10, 17, 10, 0)).lastDay, "2026-11-17");
});
