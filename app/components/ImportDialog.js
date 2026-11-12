"use client";

import Papa from "papaparse";
import { useEffect, useState } from "react";

import { leadsFromRows } from "../../lib/leads";
import { api } from "../../lib/api";
import { Icon } from "./Icons";

const CHUNK = 150; // each batch is one trip to the database

export default function ImportDialog({ onDone, onClose }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [okOnly, setOkOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const plan = rows ? leadsFromRows(rows, { okOnly }) : null;

  function read(file) {
    setResult(null);
    setError("");
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        if (!meta.fields?.includes("website") || !meta.fields.includes("name")) {
          setRows(null);
          setError("This does not look like a LeadFinder CSV. It needs the columns name and website.");
          return;
        }
        setRows(data);
      },
      error: (err) => setError(err.message),
    });
  }

  async function run() {
    setBusy(true);
    setError("");
    try {
      let added = 0;
      for (let i = 0; i < plan.leads.length; i += CHUNK) {
        const res = await api("/api/leads/import", { leads: plan.leads.slice(i, i + CHUNK) });
        added += res.added;
      }
      setResult({ added, existing: plan.leads.length - added });
      onDone();
    } catch (err) {
      setError(err.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scrim center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Import leads">
        <header className="dialog-head">
          <h2>Import leads</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </header>

        <label
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            read(e.dataTransfer.files?.[0]);
          }}
        >
          <Icon name="upload" size={22} />
          <b>{fileName || "Choose the LeadFinder CSV"}</b>
          <span className="muted">{fileName ? "Click to choose a different file" : "or drop it here"}</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => read(e.target.files?.[0])} />
        </label>

        {plan && (
          <div className="plan">
            <label className="check">
              <input type="checkbox" className="tick" checked={okOnly} onChange={(e) => setOkOnly(e.target.checked)} />
              Only businesses with a working website
            </label>
            <p className="plan-count"><b>{plan.leads.length}</b> businesses will be imported</p>
            <ul className="muted">
              {plan.skipped.notLive > 0 && <li>{plan.skipped.notLive} skipped: website down or parked</li>}
              {plan.skipped.noWebsite > 0 && <li>{plan.skipped.noWebsite} skipped: no website</li>}
              {plan.skipped.duplicate > 0 && <li>{plan.skipped.duplicate} skipped: same website listed twice</li>}
              <li>Businesses already in the platform are skipped, so importing twice is safe.</li>
            </ul>
          </div>
        )}

        {result && (
          <p className="ok-text">
            <Icon name="check" size={15} /> {result.added} added
            {result.existing ? `, ${result.existing} were already here` : ""}.
          </p>
        )}
        {error && <p className="error-text">{error}</p>}

        <footer className="dialog-foot">
          <button className="btn" onClick={onClose}>{result ? "Done" : "Cancel"}</button>
          {!result && (
            <button className="btn primary" onClick={run} disabled={busy || !plan?.leads.length}>
              {busy ? "Importing..." : plan ? `Import ${plan.leads.length}` : "Import"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
