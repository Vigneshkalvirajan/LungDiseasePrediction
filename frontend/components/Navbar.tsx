"use client";

import React, { useEffect, useState } from "react";
import { Activity, Stethoscope, CheckCircle2, AlertCircle, RefreshCw, Cpu } from "lucide-react";
import { apiService } from "../services/api";
import { HealthResponse } from "../types";

export default function Navbar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const checkHealth = async () => {
    try {
      setLoading(true);
      const res = await apiService.getHealth();
      setHealth(res);
      setError(false);
    } catch {
      setError(true);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-cyan-400 animate-pulse-subtle" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                  Breathe Easy AI
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                  VoxMed v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Clinical Respiratory Acoustic Intelligence
              </p>
            </div>
          </div>

          {/* Right Status & Badges */}
          <div className="flex items-center space-x-3">
            {/* Model Arch Badge */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              <Cpu className="h-3.5 w-3.5 text-teal-400" />
              <span>AST (768-D) + 1D-CNN (6-Class)</span>
            </div>

            {/* Backend Health Badge */}
            <button
              onClick={checkHealth}
              title="Click to recheck backend connectivity"
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                loading
                  ? "bg-slate-900 border-slate-700 text-slate-400"
                  : error
                  ? "bg-rose-950/40 border-rose-800/80 text-rose-300 hover:bg-rose-900/40"
                  : "bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/30"
              }`}
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
              ) : error ? (
                <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span>
                {loading
                  ? "Connecting..."
                  : error
                  ? "Backend Offline"
                  : `Backend Ready (${health?.gemini_model || "Gemini"})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
