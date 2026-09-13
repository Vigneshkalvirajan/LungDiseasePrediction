"use client";

import React, { useState, useEffect } from "react";
import { HistoryItem, HistoryDetailRecord } from "../../types";
import { apiService } from "../../services/api";
import { ReportView, Severity, severityDot, severityLabel, severityText } from "./ReportView";

interface HistoryViewProps {
  onNewAnalysis: () => void;
}

export function HistoryView({ onNewAnalysis }: HistoryViewProps) {
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<HistoryDetailRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getHistory();
      // Ensure records are strictly ordered with latest visit/creation date first
      const sorted = (data.history || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setHistoryList(sorted);
    } catch (err: any) {
      setError(err.message || "Failed to load analysis history from server.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectRecord(id: string) {
    setIsLoadingDetail(true);
    setError(null);
    try {
      const res = await apiService.getHistoryDetail(id);
      setSelectedRecord(res.record);
    } catch (err: any) {
      setError(err.message || "Failed to load record details.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function getSeverity(cls: string): Severity {
    if (cls === "Healthy") return "low";
    if (cls === "URTI" || cls === "Bronchiolitis") return "mid";
    return "high";
  }

  const filteredHistory = historyList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.patient_id.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.predicted_class.toLowerCase().includes(q)
    );
  });

  // If a historical record is selected, show its full ReportView!
  if (selectedRecord) {
    const historicalPatient = {
      patient_id: selectedRecord.patient_id,
      name: selectedRecord.name,
      age: selectedRecord.age,
      gender: selectedRecord.gender as "Male" | "Female" | "Other",
      mobile_number: selectedRecord.mobile_number || "",
      dob: selectedRecord.dob || "",
      visit_date: selectedRecord.visit_date || selectedRecord.created_at.slice(0, 10),
    };

    const historicalPrediction = {
      predicted_class: selectedRecord.predicted_class,
      confidence: selectedRecord.confidence,
      probabilities: selectedRecord.probabilities || {},
    };

    return (
      <ReportView
        patient={historicalPatient}
        prediction={historicalPrediction}
        report={selectedRecord.report || null}
        audioFilename={selectedRecord.audio_filename || "Auscultation Recording"}
        onBack={() => setSelectedRecord(null)}
      />
    );
  }

  return (
    <div className="min-w-0 flex-1 p-6 font-body text-ink antialiased">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Analysis History
          </h1>
          <p className="mt-0.5 text-xs text-mute font-mono">
            Persistent records of completed patient respiratory sound analyses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchHistory}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-paper transition-colors"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
          <button
            onClick={onNewAnalysis}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-surface shadow-xs hover:opacity-90 transition-opacity"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Start New Analysis
          </button>
        </div>
      </div>

      {/* Search Bar for Patient ID / Name */}
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-mute"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by Patient ID (e.g. 1, P001) or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-mute/60 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 shadow-xs"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-xs text-mute hover:text-ink font-mono px-2 py-1"
          >
            Clear Search
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-sev-high/10 border border-sev-high/30 p-4 text-xs text-sev-high">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface p-12 ring-1 ring-black/5">
          <svg className="size-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          <p className="mt-3 text-xs text-mute font-mono">Loading history from database...</p>
        </div>
      ) : historyList.length === 0 ? (
        /* Genuine Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface p-12 text-center ring-1 ring-black/5 shadow-xs">
          <div className="grid size-12 place-items-center rounded-full bg-line/40 text-mute mb-3">
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h3 className="font-display text-base font-semibold text-ink">
            No analysis history yet
          </h3>
          <p className="mt-1 max-w-sm text-xs text-mute">
            Analyses performed through the workstation will be automatically stored in the clinical database and displayed here.
          </p>
          <button
            onClick={onNewAnalysis}
            className="mt-5 flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-surface shadow-xs hover:opacity-90 transition-opacity"
          >
            Start New Analysis
          </button>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface p-12 text-center ring-1 ring-black/5">
          <p className="text-sm font-medium text-ink">No matching patient records found</p>
          <p className="mt-1 text-xs text-mute font-mono">No records match &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        /* Real History Table / Cards */
        <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-paper/60 font-mono text-[11px] uppercase tracking-wider text-mute">
                <tr>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Patient ID</th>
                  <th className="px-5 py-3">Date of Visit</th>
                  <th className="px-5 py-3">Predicted Finding</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredHistory.map((item) => {
                  const sev = getSeverity(item.predicted_class);
                  const visitDateDisplay = item.visit_date || item.created_at.slice(0, 10);

                  return (
                    <tr key={item.id} className="hover:bg-paper/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-ink block">{item.name}</span>
                        <span className="text-[11px] text-mute">
                          {item.age} yrs · {item.gender}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] font-semibold text-brand">
                        {item.patient_id}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-ink/80">
                        {visitDateDisplay}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`size-2 rounded-full ${severityDot[sev]}`} />
                          <span className={`font-medium ${severityText[sev]}`}>
                            {item.predicted_class}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-mute">
                        {item.mobile_number || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleSelectRecord(item.id)}
                          disabled={isLoadingDetail}
                          className="cursor-pointer rounded-md bg-paper px-3 py-1.5 font-medium text-brand hover:bg-brand-soft/50 transition-colors ring-1 ring-line"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
