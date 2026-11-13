"use client";

import { useMemo, useState } from "react";

import {
  FOLLOW_UP_AFTER_DAYS, NEXT_STAGE, OUTREACH_STAGES, STAGES, daysSince, stageLabel, waitingText,
} from "../../lib/leads";
import { ContactCell, SocialCell, WebsiteCell } from "./Cells";
import { Icon } from "./Icons";

const date = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "–");

/**
 * mode "outreach": leads still being worked, with the stage strip and one-click next steps
 * mode "prospects": leads that responded
 */
export default function PipelineTable({ mode, rows, query, onStage, onDelete, onOpen, onGoLeads }) {
  const [filter, setFilter] = useState("");
  const prospects = mode === "prospects";

  const needle = query.trim().toLowerCase();
  const matches = (l) => !needle || `${l.business} ${l.type} ${l.address} ${l.website} ${l.email}`.toLowerCase().includes(needle);

  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.key, rows.filter((l) => l.stage === s.key).length])), [rows]);
  const shown = rows.filter((l) => (!filter || l.stage === filter) && matches(l));
  const dueIn = (key) =>
    rows.filter((l) => {
      const d = daysSince(l.stage_changed_at || l.selected_at);
      return l.stage === key && d !== null && d >= FOLLOW_UP_AFTER_DAYS;
    }).length;

  if (!rows.length) {
    return (
      <div className="empty">
        <h2>{prospects ? "No prospects yet" : "Nobody selected yet"}</h2>
        <p>
          {prospects
            ? "When a business responds, press Responded on its row in Outreach and it moves here."
            : "Tick businesses on the Leads screen. They appear here, ready to contact."}
        </p>
        {!prospects && <button className="btn primary" onClick={onGoLeads}>Go to leads <Icon name="arrow" size={15} /></button>}
      </div>
    );
  }

  return (
    <>
      {!prospects && (
        <div className="strip" role="group" aria-label="Filter by stage">
          <button className={`cell all ${filter === "" ? "on" : ""}`} onClick={() => setFilter("")}>
            <span className="cell-label">Everyone</span>
            <span className="cell-value">{rows.length}</span>
          </button>
          {STAGES.filter((s) => OUTREACH_STAGES.includes(s.key)).map((s) => (
            <button key={s.key} className={`cell stage-${s.key} ${filter === s.key ? "on" : ""}`} onClick={() => setFilter(filter === s.key ? "" : s.key)}>
              <span className="cell-label">{s.label}</span>
              <span className="cell-value">{counts[s.key]}</span>
              {s.key !== "no_response" && dueIn(s.key) > 0 && <span className="cell-due">{dueIn(s.key)} due</span>}
            </button>
          ))}
        </div>
      )}

      <div className="panel table-wrap">
        <table className={`grid ${prospects ? "prospects" : "outreach"}`}>
          <thead>
            <tr>
              <th>Business</th>
              <th>Website</th>
              <th>Contact</th>
              <th>Social</th>
              {prospects ? (
                <>
                  <th>Responded</th>
                  <th>Handled by</th>
                  <th>Notes</th>
                  <th className="c-stage">Stage</th>
                  <th className="c-del"><span className="sr">Delete</span></th>
                </>
              ) : (
                <>
                  <th>Stage</th>
                  <th className="num">Waiting</th>
                  <th className="c-actions">Next step</th>
                  <th className="c-del"><span className="sr">Delete</span></th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const days = daysSince(l.stage_changed_at || l.selected_at);
              const due = !prospects && days !== null && days >= FOLLOW_UP_AFTER_DAYS && ["first", "followup1", "followup2"].includes(l.stage);
              const next = NEXT_STAGE[l.stage];
              return (
                <tr key={l.id}>
                  <td className="c-name">
                    <button className="name" onClick={() => onOpen(l)}>{l.business}</button>
                    <div className="sub">{l.type || "No type"}</div>
                  </td>
                  <td className="c-site" data-label="Website"><WebsiteCell url={l.website} /></td>
                  <td className="c-contact" data-label="Contact"><ContactCell email={l.email} phone={l.phone} /></td>
                  <td className="c-social" data-label="Social"><SocialCell socials={l.socials} /></td>
                  {prospects ? (
                    <>
                      <td data-label="Responded">{date(l.stage_changed_at)}</td>
                      <td className="small" data-label="Handled by">{l.selected_by || <span className="dash">–</span>}</td>
                      <td className="c-note" data-label="Notes">{l.notes ? l.notes : <span className="dash">–</span>}</td>
                      <td className="c-stage">
                        <StageSelect lead={l} onStage={onStage} />
                      </td>
                      <td className="c-del"><DeleteBtn lead={l} onDelete={onDelete} /></td>
                    </>
                  ) : (
                    <>
                      <td data-label="Stage"><StageSelect lead={l} onStage={onStage} /></td>
                      <td className={`num ${due ? "due" : ""}`} data-label="Waiting" title={due ? "Due for the next step" : undefined}>
                        {due && <i className="dot" aria-hidden="true" />}
                        {waitingText(days) || "–"}
                      </td>
                      <td className="c-actions">
                        <div className="actions">
                          {next && (
                            <button className="btn small-btn" onClick={() => onStage(l, next)} title={`Move to ${stageLabel(next)}`}>
                              {next === "no_response" ? "No response" : <><Icon name="arrow" size={14} /> {stageLabel(next)}</>}
                            </button>
                          )}
                          {l.stage !== "no_response" && (
                            <button className="btn small-btn ok" onClick={() => onStage(l, "responded")}>
                              <Icon name="check" size={14} /> Responded
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="c-del"><DeleteBtn lead={l} onDelete={onDelete} /></td>
                    </>
                  )}
                </tr>
              );
            })}
            {!shown.length && (
              <tr className="none"><td colSpan={prospects ? 9 : 8}>Nothing matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DeleteBtn({ lead, onDelete }) {
  return (
    <button className="icon-btn del" onClick={() => onDelete([lead])} aria-label={`Delete ${lead.business}`} title="Delete">
      <Icon name="trash" size={16} />
    </button>
  );
}

function StageSelect({ lead, onStage }) {
  return (
    <select
      className={`stage-select stage-${lead.stage}`}
      value={lead.stage}
      onChange={(e) => onStage(lead, e.target.value)}
      aria-label={`Stage for ${lead.business}`}
    >
      {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
    </select>
  );
}
