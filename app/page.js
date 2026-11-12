"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "../lib/api";
import { OUTREACH_STAGES, stageLabel } from "../lib/leads";
import Drawer from "./components/Drawer";
import ImportDialog from "./components/ImportDialog";
import LeadsTable from "./components/LeadsTable";
import PipelineTable from "./components/PipelineTable";
import Shell from "./components/Shell";

const TABS = ["leads", "outreach", "prospects"];
const SYNC_MS = 20_000; // how often we look for changes made by teammates

export default function Home() {
  const router = useRouter();
  const [me, setMe] = useState(undefined); // undefined = checking, null = not signed in, else { email }
  const [configured, setConfigured] = useState(true);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("leads");
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null); // { text, undo }
  const saving = useRef(0); // saves in flight: a sync must not overwrite them

  const say = (text, undo) => {
    setToast({ text, undo });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), undo ? 8000 : 5000);
  };

  // The tab lives in the address (#outreach), so refresh and back keep your place
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (TABS.includes(h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const goTab = (t) => {
    window.location.hash = t;
    setTab(t);
  };

  // Who is signed in
  useEffect(() => {
    api("/api/me")
      .then((d) => {
        setConfigured(d.configured);
        setMe(d.email ? { email: d.email } : null);
      })
      .catch((err) => {
        setConfigured(err.data?.configured !== false);
        setMe(null);
      });
  }, []);
  useEffect(() => {
    if (me === null && configured) router.replace("/login");
  }, [me, configured, router]);

  async function load(quiet = false) {
    try {
      const d = await api("/api/leads");
      if (saving.current === 0) setLeads(d.leads);
    } catch (err) {
      if (err.status === 401) return router.replace("/login");
      if (!quiet) say(`Could not load leads: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Load once, then look for teammates' changes while the page is in view
  useEffect(() => {
    if (!me) return;
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(true), SYNC_MS);
    const onShow = () => document.visibilityState === "visible" && load(true);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [me]);

  // Change leads. The screen updates at once; if saving fails, it is put back.
  async function change(ids, patch, text, undoable = false) {
    const before = leads.filter((l) => ids.includes(l.id));
    setLeads((all) => all.map((l) => (ids.includes(l.id) ? { ...l, ...patch } : l)));
    saving.current++;
    try {
      const { leads: saved } = await api("/api/leads/update", { ids, patch });
      // The database also fills in who changed it and when
      setLeads((all) => all.map((l) => saved.find((d) => d.id === l.id) || l));
      if (text) say(text, undoable ? () => undo(before) : undefined);
    } catch (err) {
      setLeads((all) => all.map((l) => before.find((b) => b.id === l.id) || l));
      if (err.status === 401) return router.replace("/login");
      say(`Could not save: ${err.message}`);
    } finally {
      saving.current--;
    }
  }

  // Put stages back the way they were
  function undo(before) {
    const byStage = new Map();
    for (const b of before) byStage.set(b.stage, [...(byStage.get(b.stage) || []), b.id]);
    byStage.forEach((ids, stage) => change(ids, { stage }));
    setToast(null);
  }

  const select = (ids) =>
    change(ids, { stage: "first" }, ids.length === 1 ? "Added to outreach" : `${ids.length} businesses added to outreach`, true);
  const unselect = (lead) => {
    if (lead.stage !== "first" && !window.confirm(`${lead.business} is already at "${stageLabel(lead.stage)}". Remove it from outreach?`)) return;
    change([lead.id], { stage: null }, "Removed from outreach", true);
  };
  const setStage = (lead, stage) =>
    change([lead.id], { stage }, stage === "responded" ? `${lead.business} moved to Prospects` : undefined, stage === "responded");
  const setNotes = (lead, notes) => change([lead.id], { notes });

  async function signOut() {
    await api("/api/logout", {}).catch(() => {});
    router.replace("/login");
  }

  const outreach = useMemo(() => leads.filter((l) => OUTREACH_STAGES.includes(l.stage)), [leads]);
  const prospects = useMemo(() => leads.filter((l) => l.stage === "responded"), [leads]);
  const counts = { leads: leads.filter((l) => !l.stage).length, outreach: outreach.length, prospects: prospects.length };
  const open = leads.find((l) => l.id === openId);

  if (!configured) {
    return (
      <main className="center-page">
        <div className="card">
          <h1>Almost ready</h1>
          <p>The server is missing its settings. Copy <code>.env.example</code> to <code>.env.local</code>, fill in the values, and restart.</p>
          <p className="muted">See README.md for the full setup.</p>
        </div>
      </main>
    );
  }
  if (!me) return <main className="center-page"><p className="muted">Loading...</p></main>;

  const heading = {
    leads: ["Leads", `${counts.leads} businesses to pick from, ${outreach.length + prospects.length} already in outreach`],
    outreach: ["Outreach", outreach.length ? `${outreach.length} businesses being contacted` : "Nobody selected yet"],
    prospects: ["Prospects", `${prospects.length} ${prospects.length === 1 ? "business has" : "businesses have"} responded`],
  }[tab];

  return (
    <Shell
      tab={tab}
      onTab={goTab}
      counts={counts}
      query={query}
      onQuery={setQuery}
      onImport={() => setShowImport(true)}
      email={me.email}
      onSignOut={signOut}
    >
      <div className="title-row">
        <div>
          <h1>{heading[0]}</h1>
          <p className="muted">{loading ? "Loading..." : heading[1]}</p>
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : tab === "leads" ? (
        <LeadsTable
          leads={leads}
          query={query}
          onSelect={select}
          onUnselect={unselect}
          onOpen={(l) => setOpenId(l.id)}
          onGoOutreach={() => goTab("outreach")}
          onImport={() => setShowImport(true)}
        />
      ) : (
        <PipelineTable
          key={tab}
          mode={tab}
          rows={tab === "outreach" ? outreach : prospects}
          query={query}
          onStage={setStage}
          onOpen={(l) => setOpenId(l.id)}
          onGoLeads={() => goTab("leads")}
        />
      )}

      {open && <Drawer key={open.id} lead={open} onClose={() => setOpenId(null)} onStage={setStage} onNotes={setNotes} />}
      {showImport && <ImportDialog onDone={() => load(true)} onClose={() => setShowImport(false)} />}

      {toast && (
        <div className="toast" role="status">
          {toast.text}
          {toast.undo && <button onClick={toast.undo}>Undo</button>}
        </div>
      )}
    </Shell>
  );
}

// Loading: the final layout with flat grey bars, so nothing jumps when the data lands
function Skeleton() {
  return (
    <div className="panel skeleton" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i}><i style={{ width: `${34 + ((i * 13) % 30)}%` }} /><i /><i /></div>
      ))}
    </div>
  );
}
