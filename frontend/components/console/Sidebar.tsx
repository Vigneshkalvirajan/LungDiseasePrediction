"use client";

import React from "react";

const iconClass = "size-4 shrink-0";

function IconPlus() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l2 5 4-14 2 9h7" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

interface SidebarProps {
  active: "new" | "results" | "history";
  onTabChange: (tab: "new" | "results" | "history") => void;
  hasActiveResult?: boolean;
  backendHealthy?: boolean;
  onLogout: () => void;
}

export function Sidebar({
  active,
  onTabChange,
  hasActiveResult = false,
  backendHealthy = true,
  onLogout,
}: SidebarProps) {
  const base = "flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer w-full text-left transition-colors text-xs font-medium";
  const on = "bg-brand-soft text-brand font-semibold shadow-xs";
  const off = "text-mute hover:bg-paper hover:text-ink";

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 lg:flex no-print min-h-screen">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-2">
        <div className="grid size-8 place-items-center rounded-lg bg-brand font-display text-sm font-bold text-surface shadow-xs">
          R
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold text-ink">RespiraAI</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-mute font-mono">Clinical DX</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="mt-7 space-y-1">
        <button
          type="button"
          onClick={() => onTabChange("new")}
          className={`${base} ${active === "new" ? on : off}`}
        >
          <IconPlus />
          New Analysis
        </button>

        {hasActiveResult && (
          <button
            type="button"
            onClick={() => onTabChange("results")}
            className={`${base} ${active === "results" ? on : off}`}
          >
            <IconPulse />
            Current Results
          </button>
        )}

        <button
          type="button"
          onClick={() => onTabChange("history")}
          className={`${base} ${active === "history" ? on : off}`}
        >
          <IconHistory />
          Analysis History
        </button>
      </nav>

      {/* Backend Status indicator */}
      <div className="mt-6 pt-4 border-t border-line px-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-mute text-[11px]">Neural Classifier</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium text-brand">
            <span className={`size-1.5 rounded-full ${backendHealthy ? "bg-sev-low animate-pulse" : "bg-sev-high"}`} />
            {backendHealthy ? "6-Class AST" : "Offline"}
          </span>
        </div>
      </div>

      {/* Bottom Clinician Profile & Logout */}
      <div className="mt-auto pt-6 space-y-3">
        <div className="rounded-xl bg-paper p-3 ring-1 ring-line">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-brand font-display text-xs font-semibold text-surface">
              AD
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink truncate">Admin Clinician</p>
              <p className="text-[10px] text-mute font-mono">admin@123</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-mute hover:bg-sev-high/10 hover:text-sev-high hover:border-sev-high/30 transition-colors"
        >
          <IconLogout />
          Log out
        </button>
      </div>
    </aside>
  );
}
