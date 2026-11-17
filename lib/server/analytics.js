// Website analytics, the pure parts: what the website may send us, how a visit is labelled, and the date window.
// No database and no network in here, so it is easy to test.
import { BadRequest } from "./validate.js";

export const KINDS = ["pageview", "enquiry", "audit", "booking"];
/** Events that mean "someone asked us for work". Bookings are counted on their own. */
export const LEAD_KINDS = ["enquiry", "audit"];
export const RANGES = [7, 30, 90];
/** Days are cut at midnight in Lagos, so "today" matches the team's day. (No daylight saving: always UTC+1.) */
export const TIMEZONE = "Africa/Lagos";
const LAGOS_MS = 3_600_000;

/** Pages the website may report from. More can be added with the ANALYTICS_ORIGINS setting (comma separated). */
const SITE_ORIGINS = ["https://www.studio8six.com", "https://studio8six.com"];
const SITE_HOSTS = ["studio8six.com", "www.studio8six.com"];

export function allowedOrigins(extra = "") {
  const more = String(extra ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  return [...SITE_ORIGINS, ...more];
}

/** Crawlers and link-preview robots. They rarely run our script, but some do. */
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python|node-fetch|axios|vercel-screenshot/i;
export const isBot = (userAgent) => !userAgent || BOT.test(userAgent);

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const label = (v, max) => text(v, max).toLowerCase().replace(/[^a-z0-9 ._+-]/g, "");

// Where a referrer came from. First match wins.
const KNOWN = [
  ["google", /(^|\.)google\.[a-z.]+$|googlequicksearchbox/, "organic"],
  ["bing", /(^|\.)bing\.com$/, "organic"],
  ["duckduckgo", /(^|\.)duckduckgo\.com$/, "organic"],
  ["yahoo", /(^|\.)yahoo\.com$/, "organic"],
  ["instagram", /(^|\.)instagram\.com$|com\.instagram/, "social"],
  ["facebook", /(^|\.)(facebook|fb)\.com$|^fb\.me$|com\.facebook/, "social"],
  ["x", /(^|\.)(twitter|x)\.com$|^t\.co$/, "social"],
  ["linkedin", /(^|\.)linkedin\.com$|^lnkd\.in$|com\.linkedin/, "social"],
  ["whatsapp", /(^|\.)whatsapp\.com$|^wa\.me$|com\.whatsapp/, "social"],
  ["youtube", /(^|\.)youtube\.com$|^youtu\.be$|com\.google\.android\.youtube/, "social"],
  ["tiktok", /(^|\.)tiktok\.com$|musically/, "social"],
  ["telegram", /(^|\.)t\.me$|telegram/, "social"],
];

/** "https://www.Google.com/search?q=x" -> "google.com". Anything that is not a host gives "". */
export function hostOf(value) {
  const raw = text(value, 300).toLowerCase();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Labels a visit. Links with ?utm_source=... win (we tag our own links, like the Instagram bio);
 * otherwise the referring site decides; no referrer means "direct".
 */
export function classifySource({ ref, utmSource, utmMedium, utmCampaign }) {
  const campaign = label(utmCampaign, 60);
  const tagged = label(utmSource, 40);
  if (tagged) return { source: tagged, medium: label(utmMedium, 40) || "campaign", campaign };

  const host = hostOf(ref);
  if (!host || SITE_HOSTS.includes(host) || SITE_HOSTS.includes(`www.${host}`)) {
    return { source: "direct", medium: "none", campaign };
  }
  for (const [source, pattern, medium] of KNOWN) {
    if (pattern.test(host)) return { source, medium, campaign };
  }
  return { source: host.slice(0, 60), medium: "referral", campaign };
}

/** "/schools/?x=1" -> "/schools". Only paths, never a query string. */
export function cleanPage(value) {
  const path = text(value, 200).split(/[?#]/)[0];
  if (!path.startsWith("/")) return "/";
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : "/";
}

const DEVICES = ["mobile", "tablet", "desktop"];

/** The row to store for one event, or a BadRequest. The browser is never trusted: every field is checked and cut. */
export function cleanEvent(body, country = "") {
  if (!body || typeof body !== "object") throw new BadRequest("Nothing to record");
  if (!KINDS.includes(body.kind)) throw new BadRequest("Unknown event");
  const session = text(body.session, 40);
  if (!/^[A-Za-z0-9]{8,40}$/.test(session)) throw new BadRequest("Bad session");
  const { source, medium, campaign } = classifySource({
    ref: body.ref,
    utmSource: body.utm_source,
    utmMedium: body.utm_medium,
    utmCampaign: body.utm_campaign,
  });
  return {
    kind: body.kind,
    session_id: session,
    page: cleanPage(body.page),
    source,
    medium,
    campaign,
    referrer_host: hostOf(body.ref).slice(0, 100),
    device: DEVICES.includes(body.device) ? body.device : "unknown",
    country: /^[A-Z]{2}$/.test(country) ? country : "",
  };
}

export const cleanDays = (value) => (RANGES.includes(Number(value)) ? Number(value) : 30);

const dayText = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * The window for "the last N days, including today", cut at Lagos midnight.
 * `since` is the exact start; firstDay and lastDay (Lagos dates) build the day-by-day chart.
 */
export function rangeWindow(days, now = Date.now()) {
  const lagos = new Date(now + LAGOS_MS);
  const midnight = Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate());
  const first = midnight - (days - 1) * 86_400_000;
  return { since: new Date(first - LAGOS_MS), firstDay: dayText(first), lastDay: dayText(midnight) };
}
