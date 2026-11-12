// Pure helpers: no browser or database code here, so they are easy to test.

export const STAGES = [
  { key: "first", label: "First outreach" },
  { key: "followup1", label: "Follow-up 1" },
  { key: "followup2", label: "Follow-up 2" },
  { key: "responded", label: "Responded" },
  { key: "no_response", label: "No response" },
];

// Stages that belong in the Outreach table (Responded goes to Prospects)
export const OUTREACH_STAGES = ["first", "followup1", "followup2", "no_response"];

export const stageLabel = (key) => STAGES.find((s) => s.key === key)?.label ?? "";

// One click moves a lead to the next step of the sequence
export const NEXT_STAGE = { first: "followup1", followup1: "followup2", followup2: "no_response" };

// A lead that has waited this many days at a step is due for the next one
export const FOLLOW_UP_AFTER_DAYS = 3;

/** Whole days since an ISO date; null when there is no date. */
export function daysSince(iso, now = Date.now()) {
  const t = Date.parse(iso ?? "");
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 86_400_000));
}

/** "Today", "1 day", "4 days" */
export function waitingText(days) {
  if (days === null) return "";
  return days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;
}

export const SOCIALS = ["facebook", "instagram", "tiktok", "x", "linkedin", "youtube", "whatsapp"];

/** Only http(s) links may be used as href. Scraped data can hold javascript: links. */
export function safeUrl(url) {
  const u = String(url ?? "").trim();
  return /^https?:\/\//i.test(u) ? u : "";
}

/** "https://www.Sunrise-Test.com/menu" -> "sunrise-test.com". Shared hosts keep their subdomain. */
export function websiteKey(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  try {
    const host = new URL(/^[a-z]+:\/\//i.test(u) ? u : `http://${u}`).hostname;
    return host.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// LeadFinder's CSV export puts a ' in front of text that starts with = + - @ (formula protection)
const unquote = (v) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v);
const clean = (v) => unquote(String(v ?? "").trim());

/** One LeadFinder CSV row -> one row for the leads table (or null when unusable). */
export function rowToLead(row) {
  const website = clean(row.website);
  const key = websiteKey(website);
  const business = clean(row.name);
  if (!business || !key) return null;

  const socials = {};
  for (const name of SOCIALS) {
    const url = safeUrl(clean(row[name]));
    if (url) socials[name] = url;
  }
  return {
    business,
    type: clean(row.business_type),
    website: safeUrl(website) || `http://${key}`,
    website_key: key,
    email: clean(row.email),
    phone: clean(row.phone),
    socials,
    address: clean(row.address),
    city: clean(row.city),
    pitch: clean(row.pitch),
    priority: Number.parseInt(row.priority, 10) || 0,
  };
}

/**
 * Turn parsed CSV rows into leads to import.
 * okOnly (default): keep only websites that are live, because those are the ones we contact.
 */
export function leadsFromRows(rows, { okOnly = true } = {}) {
  const leads = [];
  const seen = new Set();
  const skipped = { notLive: 0, noWebsite: 0, duplicate: 0 };
  for (const row of rows) {
    if (okOnly && clean(row.website_status) !== "ok") {
      if (clean(row.website_status) === "none" || !clean(row.website)) skipped.noWebsite++;
      else skipped.notLive++;
      continue;
    }
    const lead = rowToLead(row);
    if (!lead) {
      skipped.noWebsite++;
      continue;
    }
    if (seen.has(lead.website_key)) {
      skipped.duplicate++;
      continue;
    }
    seen.add(lead.website_key);
    leads.push(lead);
  }
  return { leads, skipped };
}

/** Split "a@x.com; b@x.com" into a list. */
export const splitList = (v) =>
  String(v ?? "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
