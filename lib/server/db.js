// Talks to Supabase Postgres. Server-only: DATABASE_URL must never reach the browser.
// DATABASE_URL is the "Transaction pooler" link (port 6543), the right one for Vercel.
import postgres from "postgres";

import { LEAD_KINDS, TIMEZONE, rangeWindow } from "./analytics.js";
import { applyPatch } from "./patch.js";

// One shared connection, kept on globalThis so a code reload in dev does not open (and leak) a new one each time
const sql = () =>
  (globalThis.__outreachDb ??= postgres(process.env.DATABASE_URL, {
    prepare: false, // the transaction pooler does not support prepared statements
    max: 1, // one connection per serverless instance; the pooler shares the real ones
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  }));

let cache = null; // the lead list for a few seconds, so several people polling share one query
const CACHE_MS = 3000;

// A stuck connection must not freeze everybody's screen. Give each call a time limit; if the link looks broken,
// drop it so the next call opens a fresh one.
const LIMIT_MS = 15_000;
const BROKEN = /CONNECT_TIMEOUT|CONNECTION_|ECONNRESET|ETIMEDOUT|EPIPE|57P01/;

class DbSlow extends Error {
  status = 503;
  constructor() {
    super("The database did not answer in time. Please try again.");
  }
}

function dropClient() {
  const old = globalThis.__outreachDb;
  globalThis.__outreachDb = undefined;
  old?.end({ timeout: 1 }).catch(() => {});
}

function guarded(work) {
  return async (...args) => {
    let timer;
    const late = new Promise((_, reject) => (timer = setTimeout(() => reject(new DbSlow()), LIMIT_MS)));
    try {
      return await Promise.race([work(...args), late]);
    } catch (err) {
      if (err instanceof DbSlow || BROKEN.test(`${err.code} ${err.message}`)) {
        dropClient();
        cache = null;
        if (!(err instanceof DbSlow)) throw new DbSlow();
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
}

const LEAD_COLUMNS = `id, business, type, website, website_key, email, phone, socials, address, city, pitch,
  priority, stage, selected_by, selected_at, stage_changed_at, notes, created_at`;

const iso = (d) => (d ? new Date(d).toISOString() : null);

function toLead(r) {
  return { ...r, selected_at: iso(r.selected_at), stage_changed_at: iso(r.stage_changed_at), created_at: iso(r.created_at) };
}

async function listLeadsRaw() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.leads;
  const rows = await sql()`select ${sql()(LEAD_COLUMNS.split(",").map((c) => c.trim()))} from leads order by id`;
  const leads = rows.map(toLead);
  cache = { at: Date.now(), leads };
  return leads;
}

async function listEventsRaw(leadId) {
  const rows = await sql()`select id, lead_id, user_email, from_stage, to_stage, created_at
    from events where lead_id = ${leadId} order by id desc`;
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at) }));
}

/** Adds new businesses. A website already stored is skipped, so importing twice is safe. */
async function importLeadsRaw(leads) {
  cache = null;
  const rows = leads.map((l) => ({
    business: l.business, type: l.type || "", website: l.website || "", website_key: l.website_key,
    email: l.email || "", phone: l.phone || "", socials: sql().json(l.socials || {}), address: l.address || "",
    city: l.city || "", pitch: l.pitch || "", priority: l.priority || 0,
  }));
  const usable = rows.filter((r) => r.business && r.website_key);
  let added = 0;
  if (usable.length) {
    const done = await sql()`insert into leads ${sql()(usable)} on conflict (website_key) do nothing returning id`;
    added = done.length;
  }
  return { added, skipped: leads.length - added };
}

/** Changes the stage or notes of several leads in one go, and logs each stage change. */
async function updateLeadsRaw(ids, patch, user) {
  cache = null;
  return sql().begin(async (tx) => {
    const current = await tx`select ${tx(LEAD_COLUMNS.split(",").map((c) => c.trim()))} from leads
      where id in ${tx(ids)} order by id for update`; // two people saving at once take turns
    const now = new Date().toISOString();
    const updated = [];
    for (const row of current) {
      const res = applyPatch(toLead(row), patch, user, now);
      const n = res.lead;
      await tx`update leads set stage = ${n.stage}, notes = ${n.notes}, selected_by = ${n.selected_by},
        selected_at = ${n.selected_at}, stage_changed_at = ${n.stage_changed_at} where id = ${n.id}`;
      if (res.event) {
        await tx`insert into events (lead_id, user_email, from_stage, to_stage, created_at)
          values (${res.event.lead_id}, ${user || ""}, ${res.event.from_stage}, ${res.event.to_stage}, ${now})`;
      }
      updated.push(n);
    }
    return { leads: updated };
  });
}

/** Deletes businesses for good. Their history goes with them. */
async function deleteLeadsRaw(ids) {
  cache = null;
  const gone = await sql()`delete from leads where id in ${sql()(ids)} returning id`;
  return { deleted: gone.map((r) => r.id) };
}


/** Stores one website event (already checked by cleanEvent). */
async function recordEventRaw(e) {
  await sql()`insert into analytics_events (kind, session_id, page, source, medium, campaign, referrer_host, device, country)
    values (${e.kind}, ${e.session_id}, ${e.page}, ${e.source}, ${e.medium}, ${e.campaign}, ${e.referrer_host}, ${e.device}, ${e.country})`;
}

/**
 * Everything the analytics screen shows, for the last `days` days, in ONE database request.
 * (The link to the database is slow to answer, so eight separate queries took too long.) Counts only.
 */
async function getAnalyticsRaw(days) {
  const { since, firstDay, lastDay } = rangeWindow(days);
  const from = since.toISOString();
  const db = sql();
  const lk = db(LEAD_KINDS);
  const [row] = await db`
    with ev as (
      select id, created_at, kind, session_id, page, source, medium, device, country
      from analytics_events where created_at >= ${from}::timestamptz
    )
    select
      (select json_build_object(
          'views', count(*) filter (where kind = 'pageview'),
          'visits', count(distinct session_id) filter (where kind = 'pageview'),
          'leads', count(*) filter (where kind in ${lk}),
          'bookings', count(*) filter (where kind = 'booking')) from ev) as totals,
      (select coalesce(json_agg(s order by s.day), '[]'::json) from (
          select to_char(g.d, 'YYYY-MM-DD') as day,
            coalesce(v.views, 0) as views, coalesce(v.visits, 0) as visits, coalesce(v.leads, 0) as leads
          from generate_series(${firstDay}::timestamp, ${lastDay}::timestamp, interval '1 day') as g(d)
          left join (
            select (created_at at time zone ${TIMEZONE}::text)::date as d,
              count(*) filter (where kind = 'pageview') as views,
              count(distinct session_id) filter (where kind = 'pageview') as visits,
              count(*) filter (where kind in ${lk}) as leads
            from ev group by 1
          ) v on v.d = g.d::date) s) as series,
      (select coalesce(json_agg(s), '[]'::json) from (
          select source, medium,
            count(distinct session_id) filter (where kind = 'pageview') as visits,
            count(*) filter (where kind in ${lk}) as leads,
            count(*) filter (where kind = 'booking') as bookings
          from ev group by source, medium order by visits desc, leads desc, source limit 30) s) as sources,
      (select coalesce(json_agg(s), '[]'::json) from (
          select page, count(*) as views, count(distinct session_id) as visits
          from ev where kind = 'pageview' group by page order by views desc limit 15) s) as pages,
      (select coalesce(json_agg(s), '[]'::json) from (
          select device as label, count(distinct session_id) as visits
          from ev where kind = 'pageview' group by device order by visits desc) s) as devices,
      (select coalesce(json_agg(s), '[]'::json) from (
          select country as label, count(distinct session_id) as visits
          from ev where kind = 'pageview' group by country order by visits desc limit 10) s) as countries,
      (select coalesce(json_agg(s), '[]'::json) from (
          select id, created_at, kind, page, source, medium, country, device
          from ev where kind <> 'pageview' order by id desc limit 15) s) as recent`;
  return { days, ...row };
}

export const listLeads = guarded(listLeadsRaw);
export const listEvents = guarded(listEventsRaw);
export const importLeads = guarded(importLeadsRaw);
export const updateLeads = guarded(updateLeadsRaw);
export const deleteLeads = guarded(deleteLeadsRaw);
export const recordEvent = guarded(recordEventRaw);
export const getAnalytics = guarded(getAnalyticsRaw);
