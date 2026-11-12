import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NEXT_STAGE, daysSince, leadsFromRows, rowToLead, safeUrl, splitList, waitingText, websiteKey,
} from "./leads.js";

// Fictional businesses only
const row = (over = {}) => ({
  priority: "62", recommendation: "Growth pitch", need_score: "40", fit_score: "70",
  name: "Sunrise Cafe", business_type: "Cafes & bakeries", website: "https://www.sunrise-test.com/menu",
  website_status: "ok", email: "hello@sunrise-test.com", phone: "+2348010001111",
  facebook: "https://www.facebook.com/sunrisetest", instagram: "", whatsapp: "",
  address: "1 Test Street", city: "Lagos", pitch: "Offer online booking.", ...over,
});

test("websiteKey strips protocol, www, path and case", () => {
  assert.equal(websiteKey("https://www.Sunrise-Test.com/menu"), "sunrise-test.com");
  assert.equal(websiteKey("sunrise-test.com"), "sunrise-test.com");
  assert.equal(websiteKey(""), "");
});

test("websiteKey keeps the subdomain on shared hosts", () => {
  assert.notEqual(websiteKey("http://cafe-one.wixsite.com"), websiteKey("http://cafe-two.wixsite.com"));
});

test("safeUrl only allows http and https", () => {
  assert.equal(safeUrl("https://a.com"), "https://a.com");
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "//a.com", "", null]) assert.equal(safeUrl(bad), "");
});

test("rowToLead keeps only the columns we need", () => {
  const lead = rowToLead(row());
  assert.deepEqual(Object.keys(lead).sort(), [
    "address", "business", "city", "email", "phone", "pitch", "priority", "socials", "type", "website", "website_key",
  ]);
  assert.equal(lead.website_key, "sunrise-test.com");
  assert.deepEqual(lead.socials, { facebook: "https://www.facebook.com/sunrisetest" });
  assert.equal(lead.priority, 62);
});

test("rowToLead drops javascript: social links and undoes the CSV formula quote", () => {
  const lead = rowToLead(row({ instagram: "javascript:alert(1)", name: "'=Odd Name", phone: "'+2348010001111" }));
  assert.equal(lead.socials.instagram, undefined);
  assert.equal(lead.business, "=Odd Name");
  assert.equal(lead.phone, "+2348010001111");
});

test("rowToLead rejects rows with no name or website", () => {
  assert.equal(rowToLead(row({ name: "" })), null);
  assert.equal(rowToLead(row({ website: "" })), null);
});

test("leadsFromRows keeps only live (ok) sites by default", () => {
  const { leads, skipped } = leadsFromRows([
    row(),
    row({ name: "Down Cafe", website: "http://down-test.com", website_status: "dead" }),
    row({ name: "Parked Cafe", website: "http://parked-test.com", website_status: "parked" }),
    row({ name: "No Site Cafe", website: "", website_status: "none" }),
  ]);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].business, "Sunrise Cafe");
  assert.deepEqual(skipped, { notLive: 2, noWebsite: 1, duplicate: 0 });
});

test("leadsFromRows can include every site when okOnly is off", () => {
  const rows = [row(), row({ name: "Down Cafe", website: "http://down-test.com", website_status: "dead" })];
  assert.equal(leadsFromRows(rows, { okOnly: false }).leads.length, 2);
});

test("leadsFromRows removes duplicates by website", () => {
  const { leads, skipped } = leadsFromRows([row(), row({ name: "Sunrise Cafe (copy)", website: "http://sunrise-test.com/" })]);
  assert.equal(leads.length, 1);
  assert.equal(skipped.duplicate, 1);
});

test("daysSince and waitingText", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  assert.equal(daysSince("2026-11-12T01:00:00Z", now), 0);
  assert.equal(daysSince("2026-11-08T12:00:00Z", now), 4);
  assert.equal(daysSince(null, now), null);
  assert.equal(waitingText(0), "Today");
  assert.equal(waitingText(1), "1 day");
  assert.equal(waitingText(4), "4 days");
  assert.equal(waitingText(null), "");
});

test("the next stage follows the sequence and Responded is a separate choice", () => {
  assert.equal(NEXT_STAGE.first, "followup1");
  assert.equal(NEXT_STAGE.followup1, "followup2");
  assert.equal(NEXT_STAGE.followup2, "no_response");
  assert.equal(NEXT_STAGE.responded, undefined);
});

test("splitList splits emails and phones", () => {
  assert.deepEqual(splitList("a@x.com; b@x.com"), ["a@x.com", "b@x.com"]);
  assert.deepEqual(splitList(""), []);
});
