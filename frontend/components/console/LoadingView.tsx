"use client";

import React from "react";

interface LoadingViewProps {
  fileName: string;
  patientName: string;
}

export function LoadingView({ fileName, patientName }: LoadingViewProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center font-body">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 ring-1 ring-black/5 shadow-md">
        {/* Animated Scanner Wave */}
        <div className="relative mx-auto mb-6 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-ink/95 p-4">
          <div className="flex items-center gap-1.5">
            {[40, 65, 30, 85, 95, 60, 45, 75, 90, 35, 55, 70, 80, 50, 60].map((h, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-brand animate-pulse"
                style={{
                  height: `${h}%`,
                  animationDuration: "1.2s",
                  animationDelay: `${(i * 0.08).toFixed(2)}s`,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-2 text-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-surface/50">
              AST 768-D Feature Extraction
            </span>
          </div>
        </div>

        <h3 className="font-display text-lg font-semibold text-ink">
          Analyzing Respiratory Sound...
        </h3>
        <p className="mt-1 text-xs text-mute leading-relaxed">
          Running deep classification and generating Gemini clinical report for <span className="font-medium text-ink">{patientName}</span>.
        </p>

        {/* Live Status Indicators */}
        <div className="mt-6 space-y-2 rounded-xl bg-paper p-3.5 text-left text-xs font-mono ring-1 ring-line">
          <div className="flex items-center gap-2 text-brand">
            <span className="size-1.5 rounded-full bg-brand animate-ping" />
            <span>Audio: {fileName}</span>
          </div>
          <div className="flex items-center gap-2 text-ink/70">
            <span className="size-1.5 rounded-full bg-line" />
            <span>1D-CNN Multi-Class Probability Inference</span>
          </div>
          <div className="flex items-center gap-2 text-ink/70">
            <span className="size-1.5 rounded-full bg-line" />
            <span>Gemini AI Structured Diagnostic Report</span>
          </div>
        </div>

        <p className="mt-5 font-mono text-[10px] text-mute">
          Please wait while the server processes the recording...
        </p>
      </div>
    </div>
  );
}
