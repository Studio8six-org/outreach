// Talks to Supabase Postgres. Server-only: DATABASE_URL must never reach the browser.
// DATABASE_URL is the "Transaction pooler" link (port 6543), the right one for Vercel.
import postgres from "postgres";

import { applyPatch } from "./patch.js";

let client;
const sql = () =>
  (client ??= postgres(process.env.DATABASE_URL, {
    prepare: false, // the transaction pooler does not support prepared statements
    max: 1, // one connection per serverless instance; the pooler shares the real ones
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  }));

let cache = null; // the lead list for a few seconds, so several people polling share one query
const CACHE_MS = 3000;

const LEAD_COLUMNS = `id, business, type, website, website_key, email, phone, socials, address, city, pitch,
  priority, stage, selected_by, selected_at, stage_changed_at, notes, created_at`;

const iso = (d) => (d ? new Date(d).toISOString() : null);

function toLead(r) {
  return { ...r, selected_at: iso(r.selected_at), stage_changed_at: iso(r.stage_changed_at), created_at: iso(r.created_at) };
}

export async function listLeads() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.leads;
  const rows = await sql()`select ${sql()(LEAD_COLUMNS.split(",").map((c) => c.trim()))} from leads order by id`;
  const leads = rows.map(toLead);
  cache = { at: Date.now(), leads };
  return leads;
}

export async function listEvents(leadId) {
  const rows = await sql()`select id, lead_id, user_email, from_stage, to_stage, created_at
    from events where lead_id = ${leadId} order by id desc`;
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at) }));
}

/** Adds new businesses. A website already stored is skipped, so importing twice is safe. */
export async function importLeads(leads) {
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
export async function updateLeads(ids, patch, user) {
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
