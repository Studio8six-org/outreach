"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "../../lib/api";
import Shell from "../components/Shell";

const RANGES = [7, 30, 90];
const REFRESH_MS = 60_000;
const number = new Intl.NumberFormat("en");
const KIND = { enquiry: "Sent an enquiry", audit: "Asked for a free audit", booking: "Clicked Book a call" };

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : "–");
const dayLabel = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const when = (iso) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

let regions;
function country(code) {
  if (!code) return "Unknown";
  try {
    regions ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regions.of(code) || code;
  } catch {
    return code;
  }
}

/** A round top for the y axis. Four equal steps of 1, 2, 5 or 10 times a power of ten, so every grid line is a whole number. */
function niceMax(max) {
  const raw = Math.max(4, max) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return 4 * [1, 2, 5, 10].map((k) => k * pow).find((v) => v >= raw);
}

export default function Analytics() {
  const router = useRouter();
  const [me, setMe] = useState(undefined);
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0); // bumped by "Try again"

  useEffect(() => {
    api("/api/me")
      .then((d) => setMe(d.email ? { email: d.email } : null))
      .catch(() => setMe(null));
  }, []);
  useEffect(() => {
    if (me === null) router.replace("/login");
  }, [me, router]);

  // Load when the range changes, then keep fresh while the page is in view
  useEffect(() => {
    if (!me) return;
    let live = true;
    const load = () =>
      api(`/api/analytics?days=${days}`)
        .then((d) => live && (setData(d), setError(null)))
        .catch((err) => {
          if (err.status === 401) return router.replace("/login");
          if (live) setError(err.message);
        });
    setData((d) => (d?.days === days ? d : null));
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [me, days, retry, router]);

  async function signOut() {
    await api("/api/logout", {}).catch(() => {});
    router.replace("/login");
  }

  if (!me) return <main className="center-page"><p className="muted">Loading...</p></main>;

  const empty = data && data.totals.views === 0 && data.totals.leads === 0 && data.totals.bookings === 0;

  return (
    <Shell tab="analytics" onTab={(key) => router.push(`/#${key}`)} email={me.email} onSignOut={signOut} hideTools>
      <div className="title-row an-title">
        <div>
          <h1>Analytics</h1>
          <p className="muted">Where visitors to studio8six.com come from, and who asks for work.</p>
        </div>
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r} className={days === r ? "on" : ""} aria-pressed={days === r} onClick={() => setDays(r)}>
              {r} days
            </button>
          ))}
        </div>
      </div>

      {error && !data ? (
        <div className="empty">
          <h2>Could not load analytics</h2>
          <p>{error}. Nothing has been lost.</p>
          <button className="btn primary" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : !data ? (
        <div className="panel skeleton" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i}><i style={{ width: `${30 + ((i * 11) % 30)}%` }} /><i /></div>
          ))}
        </div>
      ) : empty ? (
        <div className="empty">
          <h2>No visits recorded yet</h2>
          <p>
            Visits appear here a few seconds after someone opens the website. If you just set this up, make sure the website
            has <code>VITE_ANALYTICS_URL</code> set and has been deployed, then open the site in a private window. (Your own
            visits are only skipped if you opened the site once with <code>?notrack=1</code>.)
          </p>
        </div>
      ) : (
        <Report data={data} />
      )}
    </Shell>
  );
}

function Report({ data }) {
  const { totals, series, sources, pages, devices, countries, recent } = data;
  const topVisits = Math.max(1, ...sources.map((s) => s.visits));
  const deviceTotal = devices.reduce((n, d) => n + d.visits, 0);

  return (
    <div className="an">
      <div className="an-tiles">
        <Tile label="Visits" value={totals.visits} note="Browser sessions" />
        <Tile label="Page views" value={totals.views} />
        <Tile label="Leads" value={totals.leads} note="Enquiries and audit requests" />
        <Tile label="Book a call clicks" value={totals.bookings} />
        <Tile label="Lead rate" value={percent(totals.leads, totals.visits)} note="Leads per visit" />
      </div>

      <section className="panel an-card" aria-labelledby="an-daily">
        <h2 id="an-daily">Visits per day</h2>
        <DailyChart series={series} />
        <details className="an-details">
          <summary>Show as a table</summary>
          <div className="an-scroll">
            <table className="an-table">
              <thead>
                <tr><th>Day</th><th className="num">Visits</th><th className="num">Page views</th><th className="num">Leads</th></tr>
              </thead>
              <tbody>
                {[...series].reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{dayLabel(d.day)}</td>
                    <td className="num">{d.visits}</td>
                    <td className="num">{d.views}</td>
                    <td className="num">{d.leads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="panel an-card" aria-labelledby="an-sources">
        <h2 id="an-sources">Where visitors come from</h2>
        <p className="muted small">
          Each visit counts once, under the site or link that first sent the person. Leads are enquiries and audit requests.
        </p>
        <div className="an-scroll">
          <table className="an-table">
            <thead>
              <tr><th>Source</th><th className="num">Visits</th><th className="num">Leads</th><th className="num">Book a call</th><th className="num">Lead rate</th></tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={`${s.source}/${s.medium}`}>
                  <td>
                    <div className="an-name">{cap(s.source)}</div>
                    <div className="muted small">{s.medium === "none" ? "No referrer" : cap(s.medium)}</div>
                    <div className="an-bar" aria-hidden="true"><i style={{ width: `${(s.visits / topVisits) * 100}%` }} /></div>
                  </td>
                  <td className="num">{number.format(s.visits)}</td>
                  <td className="num">{number.format(s.leads)}</td>
                  <td className="num">{number.format(s.bookings)}</td>
                  <td className="num">{percent(s.leads, s.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Tip: many apps hide where a click came from, so Instagram and WhatsApp visits often show as "Direct". Put links in
          your bio and messages like <code>https://www.studio8six.com/?utm_source=instagram&amp;utm_medium=bio</code> to
          count them properly.
        </p>
      </section>

      <div className="an-split">
        <section className="panel an-card" aria-labelledby="an-pages">
          <h2 id="an-pages">Pages</h2>
          <List rows={pages.map((p) => ({ label: p.page, value: p.views, note: `${number.format(p.visits)} visits` }))} unit="views" />
        </section>
        <section className="panel an-card" aria-labelledby="an-devices">
          <h2 id="an-devices">Devices</h2>
          <List rows={devices.map((d) => ({ label: cap(d.label), value: d.visits, note: percent(d.visits, deviceTotal) }))} unit="visits" />
        </section>
        <section className="panel an-card" aria-labelledby="an-countries">
          <h2 id="an-countries">Countries</h2>
          <List rows={countries.map((c) => ({ label: country(c.label), value: c.visits }))} unit="visits" />
        </section>
      </div>

      <section className="panel an-card" aria-labelledby="an-recent">
        <h2 id="an-recent">Latest leads and clicks</h2>
        {recent.length ? (
          <div className="an-scroll">
            <table className="an-table">
              <thead>
                <tr><th>When (Lagos)</th><th>What</th><th>Page</th><th>Came from</th><th>Country</th></tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{when(r.created_at)}</td>
                    <td>{KIND[r.kind] || r.kind}</td>
                    <td>{r.page}</td>
                    <td>{cap(r.source)}</td>
                    <td>{country(r.country)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No enquiries or clicks in this period yet.</p>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, note }) {
  return (
    <div className="panel an-tile">
      <p className="an-tile-label">{label}</p>
      <p className="an-tile-value">{typeof value === "number" ? number.format(value) : value}</p>
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}

/** Ranked bars with the number in plain text beside them. */
function List({ rows, unit }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="muted">Nothing yet.</p>;
  return (
    <ul className="an-list">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="an-list-row">
            <span className="an-name">{r.label}</span>
            <span>
              {number.format(r.value)}{" "}
              <span className="muted small">
                {r.value === 1 ? unit.replace(/s$/, "") : unit}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            </span>
          </div>
          <div className="an-bar" aria-hidden="true"><i style={{ width: `${(r.value / top) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** One thin bar per day, anchored to the baseline. Hover or focus a day for its numbers. */
function DailyChart({ series }) {
  const [at, setAt] = useState(null);
  const top = useMemo(() => niceMax(Math.max(0, ...series.map((d) => d.visits))), [series]);
  const ticks = [top, top / 2, 0];
  const labelAt = new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]);
  const hovered = at === null ? null : series[at];
  // Keep the tooltip inside the chart near the left and right edges
  const x = at === null ? 0 : ((at + 0.5) / series.length) * 100;

  return (
    <div className="an-chart" onMouseLeave={() => setAt(null)}>
      <div className="an-plot">
        {ticks.map((t) => (
          <div key={t} className="an-grid" style={{ bottom: `${(t / top) * 100}%` }}>
            <span>{number.format(t)}</span>
          </div>
        ))}
        <div className="an-cols">
          {series.map((d, i) => (
            <button
              key={d.day}
              type="button"
              className={`an-col${at === i ? " on" : ""}`}
              aria-label={`${dayLabel(d.day)}: ${d.visits} visits, ${d.views} page views, ${d.leads} leads`}
              onMouseEnter={() => setAt(i)}
              onFocus={() => setAt(i)}
              onBlur={() => setAt(null)}
            >
              <i style={{ height: `${(d.visits / top) * 100}%` }} />
            </button>
          ))}
        </div>
        {hovered && (
          <div className="an-tip" role="status" style={{ left: `${Math.min(88, Math.max(12, x))}%` }}>
            <b>{dayLabel(hovered.day)}</b>
            <span>{number.format(hovered.visits)} visits</span>
            <span>{number.format(hovered.views)} page views</span>
            <span>{number.format(hovered.leads)} leads</span>
          </div>
        )}
      </div>
      <div className="an-xaxis" aria-hidden="true">
        {series.map((d, i) => (
          <span key={d.day}>{labelAt.has(i) ? dayLabel(d.day) : ""}</span>
        ))}
      </div>
    </div>
  );
}
