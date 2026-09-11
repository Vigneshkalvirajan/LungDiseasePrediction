"use client";

import React, { useState } from "react";
import { BarChart3, TrendingUp, Award, ArrowDownUp } from "lucide-react";
import { PredictionResult } from "../types";

interface ProbabilityChartProps {
  prediction: PredictionResult;
}

const CLASS_COLORS: Record<string, { bar: string; text: string; bg: string; border: string }> = {
  Healthy: {
    bar: "bg-gradient-to-r from-emerald-500 to-teal-400",
    text: "text-emerald-400",
    bg: "bg-emerald-950/40",
    border: "border-emerald-800/60",
  },
  URTI: {
    bar: "bg-gradient-to-r from-blue-500 to-cyan-400",
    text: "text-blue-400",
    bg: "bg-blue-950/40",
    border: "border-blue-800/60",
  },
  Bronchiolitis: {
    bar: "bg-gradient-to-r from-amber-500 to-yellow-400",
    text: "text-amber-400",
    bg: "bg-amber-950/40",
    border: "border-amber-800/60",
  },
  Bronchiectasis: {
    bar: "bg-gradient-to-r from-orange-500 to-amber-400",
    text: "text-orange-400",
    bg: "bg-orange-950/40",
    border: "border-orange-800/60",
  },
  Pneumonia: {
    bar: "bg-gradient-to-r from-rose-500 to-red-400",
    text: "text-rose-400",
    bg: "bg-rose-950/40",
    border: "border-rose-800/60",
  },
  COPD: {
    bar: "bg-gradient-to-r from-purple-500 to-rose-400",
    text: "text-purple-400",
    bg: "bg-purple-950/40",
    border: "border-purple-800/60",
  },
};

const DEFAULT_COLOR = {
  bar: "bg-gradient-to-r from-cyan-500 to-teal-400",
  text: "text-cyan-400",
  bg: "bg-slate-900/60",
  border: "border-slate-700",
};

export default function ProbabilityChart({ prediction }: ProbabilityChartProps) {
  const [sortByProb, setSortByProb] = useState(true);

  const rawEntries = Object.entries(prediction.probabilities || {});
  const entries = sortByProb
    ? [...rawEntries].sort((a, b) => b[1] - a[1])
    : rawEntries;

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              6-Class Probability Spectrum
            </h3>
            <p className="text-xs text-slate-400">
              Softmax posterior distribution across all ICBHI diagnostic categories
            </p>
          </div>
        </div>

        {/* Sort Toggle */}
        <button
          type="button"
          onClick={() => setSortByProb(!sortByProb)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition"
        >
          <ArrowDownUp className="h-3.5 w-3.5 text-cyan-400" />
          <span>{sortByProb ? "Sorted by Value" : "Default Order"}</span>
        </button>
      </div>

      {/* Primary Diagnosis Highlight Banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900/70 border border-cyan-500/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-cyan-500/5 blur-xl pointer-events-none" />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                Primary Classification
              </span>
              <h4 className="text-lg font-bold text-white tracking-tight">
                {prediction.predicted_class}
              </h4>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-400 block">
              Confidence Score
            </span>
            <span className="text-2xl font-black text-cyan-300 font-mono">
              {(prediction.confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Probability Bars List */}
      <div className="space-y-3.5">
        {entries.map(([className, probability]) => {
          const isTop = className === prediction.predicted_class;
          const style = CLASS_COLORS[className] || DEFAULT_COLOR;
          const percent = (probability * 100).toFixed(2);

          return (
            <div
              key={className}
              className={`p-3 rounded-xl border transition-all ${
                isTop
                  ? `${style.bg} ${style.border} ring-1 ring-cyan-400/20`
                  : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <div className="flex items-center space-x-2">
                  <span
                    className={`font-semibold ${
                      isTop ? style.text : "text-slate-200"
                    }`}
                  >
                    {className}
                  </span>
                  {isTop && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      Primary Match
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs font-semibold text-slate-200">
                  {percent}%
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-slate-950/80 rounded-full overflow-hidden p-[1px] border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isTop ? style.bar : "bg-slate-600"
                  }`}
                  style={{ width: `${Math.max(probability * 100, 1.5)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
