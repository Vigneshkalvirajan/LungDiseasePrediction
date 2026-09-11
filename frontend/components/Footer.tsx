import React from "react";
import { ShieldCheck, Heart, Cpu, FileCode2 } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800/80 bg-slate-950/90 py-8 text-xs text-slate-400 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left Info */}
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>
              <strong>Breathe Easy AI</strong> / VoxMed 2.0 • ICBHI 2017 Benchmark Dataset
            </span>
          </div>

          {/* Model info */}
          <div className="flex items-center space-x-4 text-[11px] text-slate-500">
            <span className="flex items-center space-x-1">
              <Cpu className="h-3 w-3 text-teal-400" />
              <span>AST Transformer (768-D) + 1D-CNN</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <FileCode2 className="h-3 w-3 text-cyan-400" />
              <span>Gemini 2.5 Flash Report Synthesis</span>
            </span>
          </div>

          {/* Right Disclaimer */}
          <div className="text-[11px] text-slate-500 text-center md:text-right">
            For investigational & clinical decision-support use only.
          </div>
        </div>
      </div>
    </footer>
  );
}
