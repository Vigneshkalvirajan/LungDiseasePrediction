"use client";

import React, { useState } from "react";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simple application-level login gate check
    setTimeout(() => {
      if (username.trim() === "admin@123" && password === "123") {
        if (typeof window !== "undefined") {
          localStorage.setItem("voxmed_auth", "true");
        }
        setIsLoading(false);
        onLoginSuccess();
      } else {
        setIsLoading(false);
        setError("Invalid username or password.");
      }
    }, 300);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper font-body text-ink antialiased p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex size-12 items-center justify-center rounded-xl bg-brand font-display text-xl font-bold text-surface shadow-md mb-3">
            R
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            RespiraAI
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-mute font-mono">
            AI Clinical Respiratory Diagnostic Workstation
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-surface p-7 ring-1 ring-black/5 shadow-md">
          <div className="mb-6 border-b border-line pb-4">
            <h2 className="text-base font-semibold text-ink">Clinician Login</h2>
            <p className="mt-0.5 text-xs text-mute">
              Enter your clinical credentials to access the diagnostic workstation.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-lg bg-sev-high/10 border border-sev-high/30 p-3 text-xs text-sev-high animate-in fade-in duration-200">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink/80 mb-1.5 font-mono uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter username"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-mute/60 focus:border-brand focus:ring-2 focus:ring-brand/15"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/80 mb-1.5 font-mono uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-mute/60 focus:border-brand focus:ring-2 focus:ring-brand/15"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-surface shadow-xs transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Access Console</span>
              )}
            </button>
          </form>
        </div>

        {/* Secure Disclaimer */}
        <div className="mt-6 text-center">
          <p className="font-mono text-[11px] text-mute">
            AST Spectrogram Model · 6-Class Neural Classifier
          </p>
          <p className="mt-1 text-[10px] text-mute/80">
            For medical professional diagnostic screening assistance only.
          </p>
        </div>
      </div>
    </div>
  );
}
