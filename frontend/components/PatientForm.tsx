"use client";

import React from "react";
import { User, Calendar, Hash, Phone, UserCheck } from "lucide-react";
import { PatientInfo } from "../types";

interface PatientFormProps {
  patient: PatientInfo;
  onChange: (updated: PatientInfo) => void;
  disabled?: boolean;
}

export default function PatientForm({
  patient,
  onChange,
  disabled = false,
}: PatientFormProps) {
  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Patient Demographics
            </h3>
            <p className="text-xs text-slate-400">
              Required for clinical report generation & WhatsApp dispatch
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center space-x-1.5">
            <User className="h-3.5 w-3.5 text-cyan-400" />
            <span>Patient Full Name *</span>
          </label>
          <input
            type="text"
            required
            disabled={disabled}
            value={patient.name}
            onChange={(e) => onChange({ ...patient, name: e.target.value })}
            placeholder="e.g. John Doe"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50"
          />
        </div>

        {/* Patient ID */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center space-x-1.5">
            <Hash className="h-3.5 w-3.5 text-teal-400" />
            <span>Patient ID (MRN) *</span>
          </label>
          <input
            type="text"
            required
            disabled={disabled}
            value={patient.patient_id}
            onChange={(e) =>
              onChange({ ...patient, patient_id: e.target.value })
            }
            placeholder="e.g. PAT-1049"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50"
          />
        </div>

        {/* Mobile Number for WhatsApp */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center space-x-1.5">
            <Phone className="h-3.5 w-3.5 text-emerald-400" />
            <span>WhatsApp Mobile Number *</span>
          </label>
          <input
            type="tel"
            required
            disabled={disabled}
            value={patient.mobile_number}
            onChange={(e) =>
              onChange({ ...patient, mobile_number: e.target.value })
            }
            placeholder="e.g. +91 98765 43210"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50"
          />
        </div>

        {/* Age */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center space-x-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            <span>Age (Years) *</span>
          </label>
          <input
            type="number"
            min={0}
            max={125}
            required
            disabled={disabled}
            value={patient.age || ""}
            onChange={(e) =>
              onChange({
                ...patient,
                age: parseInt(e.target.value, 10) || 0,
              })
            }
            placeholder="e.g. 54"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Gender *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["Male", "Female", "Other"] as const).map((g) => (
              <button
                key={g}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...patient, gender: g })}
                className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all ${
                  patient.gender === g
                    ? "bg-gradient-to-r from-cyan-600/30 to-teal-600/30 border-cyan-500/80 text-cyan-200 shadow-sm shadow-cyan-500/20"
                    : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                } disabled:opacity-50`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Date of Birth */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Date of Birth (DOB) *
          </label>
          <input
            type="date"
            required
            disabled={disabled}
            value={patient.dob}
            onChange={(e) => onChange({ ...patient, dob: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
