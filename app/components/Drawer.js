"use client";

import { useEffect, useRef, useState } from "react";

import { STAGES, daysSince, splitList, stageLabel, waitingText } from "../../lib/leads";
import { api } from "../../lib/api";
import { ContactCell, SocialCell, WebsiteCell } from "./Cells";
import { Icon } from "./Icons";

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Drawer({ lead, onClose, onStage, onNotes, onDelete }) {
  const [events, setEvents] = useState(null);
  const [notes, setNotes] = useState(lead.notes);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeBtn = useRef(null);

  useEffect(() => closeBtn.current?.focus(), []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Who moved this lead and when. Reloaded whenever the stage changes.
  useEffect(() => {
    let live = true;
    api(`/api/leads/${lead.id}/events`)
      .then((d) => live && setEvents(d.events ?? []))
      .catch(() => live && setEvents([]));
    return () => {
      live = false;
    };
  }, [lead.id, lead.stage]);

  async function saveNotes() {
    if (notes === lead.notes) return;
    await onNotes(lead, notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function copyPitch() {
    try {
      await navigator.clipboard.writeText(lead.pitch);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  }

  const days = daysSince(lead.stage_changed_at || lead.selected_at);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={lead.business}>
        <header className="drawer-head">
          <div>
            <h2>{lead.business}</h2>
            <p className="muted">{lead.type || "No type"}{lead.city ? ` · ${lead.city}` : ""}</p>
          </div>
          <button ref={closeBtn} className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="drawer-body">
          <section className="drawer-block">
            <label className="label" htmlFor="stage">Stage</label>
            <div className="stage-row">
              {lead.stage ? (
                <select id="stage" className={`stage-select stage-${lead.stage}`} value={lead.stage} onChange={(e) => onStage(lead, e.target.value)}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              ) : (
                <button className="btn primary" onClick={() => onStage(lead, "first")}>Add to outreach</button>
              )}
              {lead.stage && days !== null && <span className="muted">Here for {waitingText(days).toLowerCase()}</span>}
            </div>
          </section>

          <section className="drawer-block facts">
            <div><span className="label">Website</span><WebsiteCell url={lead.website} /></div>
            <div><span className="label">Contact</span><ContactCell email={lead.email} phone={lead.phone} /></div>
            <div><span className="label">Social</span><SocialCell socials={lead.socials} /></div>
            <div><span className="label">Address</span>{lead.address || <span className="dash">–</span>}</div>
          </section>

          {lead.pitch && (
            <section className="drawer-block">
              <div className="label-row">
                <span className="label">Pitch from LeadFinder</span>
                <button className="text-btn" onClick={copyPitch}>
                  <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="pitch">{lead.pitch}</p>
            </section>
          )}

          <section className="drawer-block">
            <div className="label-row">
              <label className="label" htmlFor="notes">Notes</label>
              {saved && <span className="saved"><Icon name="check" size={13} /> Saved</span>}
            </div>
            <textarea
              id="notes"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Who you spoke to, what they said, when to call back..."
            />
          </section>

          <section className="drawer-block">
            <span className="label">History</span>
            {events === null ? (
              <p className="muted">Loading...</p>
            ) : events.length ? (
              <ol className="history">
                {events.map((e) => (
                  <li key={e.id}>
                    <span>
                      {e.from_stage ? `${stageLabel(e.from_stage)} → ` : "Selected → "}
                      <b>{e.to_stage ? stageLabel(e.to_stage) : "Removed"}</b>
                    </span>
                    <span className="muted">{(splitList(e.user_email)[0] || "").split("@")[0]} · {when(e.created_at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Nothing yet. Selecting this business starts its history.</p>
            )}
          </section>

          <section className="drawer-block danger-zone">
            <button className="text-btn danger" onClick={() => onDelete([lead])}>
              <Icon name="trash" size={14} /> Delete this business
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}
