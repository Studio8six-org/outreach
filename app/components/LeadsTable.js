"use client";

import { useMemo, useRef, useState } from "react";

import { OUTREACH_STAGES, daysSince, stageLabel, waitingText } from "../../lib/leads";
import { ContactCell, SocialCell, WebsiteCell } from "./Cells";
import { Icon } from "./Icons";

const VIEWS = [
  { key: "pick", label: "To pick" },
  { key: "selected", label: "In outreach" },
  { key: "all", label: "All" },
];

export default function LeadsTable({ leads, query, onSelect, onUnselect, onOpen, onGoOutreach, onImport }) {
  const [view, setView] = useState("pick");
  const [type, setType] = useState("");
  const lastTicked = useRef(null); // for shift-click ranges

  const inOutreach = (l) => !!l.stage;
  const counts = useMemo(
    () => ({
      pick: leads.filter((l) => !inOutreach(l)).length,
      selected: leads.filter(inOutreach).length,
      all: leads.length,
    }),
    [leads],
  );
  const types = useMemo(() => [...new Set(leads.map((l) => l.type).filter(Boolean))].sort(), [leads]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (view === "all" || (view === "pick") === !inOutreach(l)) &&
        (!type || l.type === type) &&
        (!needle || `${l.business} ${l.type} ${l.address} ${l.website} ${l.email}`.toLowerCase().includes(needle)),
    );
  }, [leads, view, type, query]);

  const unpicked = visible.filter((l) => !inOutreach(l));

  function confirmMany(n) {
    return n <= 25 || window.confirm(`Add ${n} businesses to outreach?`);
  }

  function tick(lead, index, event) {
    if (inOutreach(lead)) return onUnselect(lead);
    // Shift-click ticks everything between the last tick and this row
    if (event.shiftKey && lastTicked.current !== null) {
      const [a, b] = [lastTicked.current, index].sort((x, y) => x - y);
      const ids = visible.slice(a, b + 1).filter((l) => !inOutreach(l)).map((l) => l.id);
      if (ids.length && confirmMany(ids.length)) onSelect(ids);
    } else {
      onSelect([lead.id]);
    }
    lastTicked.current = index;
  }

  function selectAllShown() {
    if (unpicked.length && confirmMany(unpicked.length)) onSelect(unpicked.map((l) => l.id));
  }

  if (!leads.length) {
    return (
      <div className="empty">
        <h2>No leads yet</h2>
        <p>Import the CSV exported from LeadFinder. Only businesses with a working website are added.</p>
        <button className="btn primary" onClick={onImport}>
          <Icon name="upload" size={15} /> Import leads
        </button>
      </div>
    );
  }

  const mine = leads
    .filter((l) => OUTREACH_STAGES.includes(l.stage))
    .sort((a, b) => Date.parse(b.selected_at || 0) - Date.parse(a.selected_at || 0));

  return (
    <div className="split">
      <section>
        <div className="toolbar">
          <div className="seg" role="tablist" aria-label="Show">
            {VIEWS.map((v) => (
              <button key={v.key} role="tab" aria-selected={view === v.key} className={view === v.key ? "on" : ""} onClick={() => setView(v.key)}>
                {v.label} <span>{counts[v.key]}</span>
              </button>
            ))}
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Business type">
            <option value="">All types</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <span className="grow" />
          <button className="btn" onClick={selectAllShown} disabled={!unpicked.length}>
            Select all shown <b>{unpicked.length}</b>
          </button>
        </div>

        <div className="panel table-wrap">
          <table className="grid leads">
            <thead>
              <tr>
                <th className="c-check"><span className="sr">Select</span></th>
                <th>Business</th>
                <th>Website</th>
                <th>Contact</th>
                <th>Social</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l, i) => (
                <tr key={l.id} className={inOutreach(l) ? "picked" : ""}>
                  <td className="c-check">
                    <input
                      type="checkbox"
                      className="tick"
                      aria-label={`Select ${l.business}`}
                      checked={inOutreach(l)}
                      onChange={() => {}}
                      onClick={(e) => tick(l, i, e)}
                    />
                  </td>
                  <td className="c-name">
                    <button className="name" onClick={() => onOpen(l)}>{l.business}</button>
                    <div className="sub">
                      {l.type || "No type"}
                      {inOutreach(l) && <span className={`pill stage-${l.stage}`}>{stageLabel(l.stage)}</span>}
                    </div>
                  </td>
                  <td className="c-site" data-label="Website"><WebsiteCell url={l.website} /></td>
                  <td className="c-contact" data-label="Contact"><ContactCell email={l.email} phone={l.phone} /></td>
                  <td className="c-social" data-label="Social"><SocialCell socials={l.socials} /></td>
                  <td className="c-addr" data-label="Address">{l.address || <span className="dash">–</span>}</td>
                </tr>
              ))}
              {!visible.length && (
                <tr className="none">
                  <td colSpan={6}>
                    {view === "pick" && !query && !type
                      ? "Everything is already in outreach. Import more leads when you need them."
                      : "Nothing matches. Try another search or type."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="hint">Tip: hold Shift and tick a second business to select everything in between.</p>
      </section>

      <aside className="rail" aria-label="Your outreach list">
        <div className="rail-head">
          <h2>Your outreach list</h2>
          <span className="rail-count">{mine.length}</span>
        </div>
        {mine.length ? (
          <ul>
            {mine.slice(0, 8).map((l) => (
              <li key={l.id}>
                <button className="rail-name" onClick={() => onOpen(l)}>
                  {l.business}
                  <span>{stageLabel(l.stage)} · {waitingText(daysSince(l.stage_changed_at || l.selected_at)) || "now"}</span>
                </button>
                {l.stage === "first" && (
                  <button className="icon-btn" aria-label={`Remove ${l.business}`} onClick={() => onUnselect(l)}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rail-empty">Tick a business and it appears here at once. This is the list you will contact.</p>
        )}
        {mine.length > 8 && <p className="rail-more">and {mine.length - 8} more</p>}
        <button className="btn primary wide" onClick={onGoOutreach} disabled={!mine.length}>
          Open outreach table <Icon name="arrow" size={15} />
        </button>
      </aside>
    </div>
  );
}
