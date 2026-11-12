"use client";

import { useEffect, useRef } from "react";

import { Icon, Mark } from "./Icons";

const NAV = [
  { key: "leads", label: "Leads", icon: "list" },
  { key: "outreach", label: "Outreach", icon: "send" },
  { key: "prospects", label: "Prospects", icon: "star" },
];

export default function Shell({ tab, onTab, counts, query, onQuery, onImport, email, onSignOut, children }) {
  const search = useRef(null);

  // "/" jumps to search, like most work tools
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target.tagName);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initial = (email || "?").trim()[0]?.toUpperCase();

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <Mark />
          <span>Outreach</span>
        </div>
        <nav aria-label="Main">
          <div className="nav-group">Pipeline</div>
          {NAV.map((n) => (
            <a
              key={n.key}
              href={`#${n.key}`}
              className={`nav-item ${tab === n.key ? "on" : ""}`}
              aria-current={tab === n.key ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onTab(n.key);
              }}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              <span className="nav-count">{counts[n.key]}</span>
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">
            <span className="avatar" aria-hidden="true">{initial}</span>
            <span className="who-email" title={email}>{email}</span>
          </div>
          <button className="text-btn" onClick={onSignOut}>
            <Icon name="out" size={14} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="search">
            <Icon name="search" size={15} />
            <input
              ref={search}
              type="search"
              placeholder="Search leads"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              aria-label="Search"
            />
            <kbd>/</kbd>
          </div>
          <span className="grow" />
          <button className="btn" onClick={onImport}>
            <Icon name="upload" size={15} /> Import leads
          </button>
        </header>
        <main className="canvas">{children}</main>
      </div>

      <nav className="bottombar" aria-label="Main">
        {NAV.map((n) => (
          <a
            key={n.key}
            href={`#${n.key}`}
            className={tab === n.key ? "on" : ""}
            onClick={(e) => {
              e.preventDefault();
              onTab(n.key);
            }}
          >
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
