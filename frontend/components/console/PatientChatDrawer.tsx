"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  PatientInfo,
  PredictionResult,
  RespiratoryReport,
  ChatMessage,
} from "../../types";
import { apiService } from "../../services/api";

interface PatientChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientInfo;
  prediction: PredictionResult;
  report?: RespiratoryReport | null;
}

export function PatientChatDrawer({
  isOpen,
  onClose,
  patient,
  prediction,
  report,
}: PatientChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [followups, setFollowups] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const condition = prediction.predicted_class || "Healthy";
  const confidencePct = (prediction.confidence * 100).toFixed(1);

  // Initialize contextual default follow-up chips when opened or patient changes
  useEffect(() => {
    if (isOpen) {
      const defaultChips = [
        `Explain what ${condition} (${confidencePct}% confidence) means for this patient.`,
        `What are the recommended clinical management and treatment steps?`,
        `What do the acoustic stethoscope findings (wheezes/crackles) indicate?`,
        `What lifestyle precautions and follow-up tests are advised?`,
      ];
      setFollowups(defaultChips);

      // If empty conversation, initialize with a warm clinical greeting
      if (messages.length === 0) {
        setMessages([
          {
            id: "initial-greeting",
            role: "assistant",
            content: `Hello! I am the **AI Clinical Copilot** for **${patient.name}** (ID: \`${patient.patient_id}\`).\n\nI have loaded the **Audio Spectrogram Transformer** auscultation data and clinical report indicating **${condition}** (${confidencePct}% confidence).\n\nFeel free to ask any question regarding diagnosis interpretation, acoustic features, medications, or longitudinal care plan.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }

      // Auto-focus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, patient.patient_id, prediction.predicted_class]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSendMessage(queryToSend?: string) {
    const question = (queryToSend || inputQuestion).trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputQuestion("");
    setLoading(true);

    try {
      const chatPayload = {
        patient,
        prediction,
        report: report || null,
        messages: updatedHistory.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        question,
      };

      const res = await apiService.chatWithPatient(chatPayload);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (res.suggested_followups && res.suggested_followups.length > 0) {
        setFollowups(res.suggested_followups);
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Unable to fetch response:** ${err.message || "Failed to reach AI Copilot backend."}\n\nPlease check that the VoxMed backend is running.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleClearChat() {
    setMessages([
      {
        id: `greeting-${Date.now()}`,
        role: "assistant",
        content: `Conversation reset. Ask any questions regarding **${patient.name}**'s auscultation, spectrogram patterns, or clinical next steps.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <aside className="relative flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl border-l border-line z-10 sm:max-w-md md:max-w-lg lg:max-w-xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-line bg-paper/60 px-5 py-3.5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-surface shadow-xs">
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M8 9h8M8 13h5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold text-ink">
                  Patient AI Copilot
                </h3>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[10px] font-medium text-brand">
                  Live Context
                </span>
              </div>
              <p className="text-xs text-mute truncate max-w-[240px]">
                {patient.name} · {patient.patient_id} ({patient.age}y, {patient.gender})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleClearChat}
              title="Clear Conversation"
              className="rounded-lg p-1.5 text-mute hover:bg-paper hover:text-ink transition-colors cursor-pointer"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close Copilot"
              className="rounded-lg p-1.5 text-mute hover:bg-paper hover:text-ink transition-colors cursor-pointer"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Patient Clinical Context Card */}
        <div className="bg-paper/40 border-b border-line px-5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-mute uppercase">Diagnosis:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                condition === "Healthy"
                  ? "bg-sev-low/15 text-sev-low border border-sev-low/30"
                  : condition === "Pneumonia" || condition === "COPD"
                  ? "bg-sev-high/15 text-sev-high border border-sev-high/30"
                  : "bg-sev-mid/15 text-sev-mid border border-sev-mid/30"
              }`}
            >
              {condition} · {confidencePct}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-mute text-[11px] font-mono">
            <span>AST Neural Spectrogram</span>
            <span>·</span>
            <span>Confidence: {confidencePct}%</span>
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans text-xs">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand text-[11px] font-bold">
                    AI
                  </div>
                )}

                <div
                  className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                    isUser
                      ? "bg-brand text-surface rounded-br-xs"
                      : "bg-paper border border-line text-ink rounded-bl-xs"
                  }`}
                >
                  <div className="prose prose-xs max-w-none dark:prose-invert space-y-2">
                    {msg.content.split("\n\n").map((para, idx) => {
                      // Simple markdown formatting renderer
                      if (para.startsWith("### ")) {
                        return (
                          <h4 key={idx} className="font-display font-semibold text-xs mt-2 mb-1">
                            {para.replace("### ", "")}
                          </h4>
                        );
                      }
                      if (para.startsWith("- ") || para.startsWith("* ")) {
                        const items = para.split("\n");
                        return (
                          <ul key={idx} className="list-disc pl-4 space-y-1 my-1">
                            {items.map((it, iIdx) => (
                              <li key={iIdx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it.replace(/^[-*]\s+/, "")) }} />
                            ))}
                          </ul>
                        );
                      }
                      if (/^\d+\.\s+/.test(para)) {
                        const items = para.split("\n");
                        return (
                          <ol key={idx} className="list-decimal pl-4 space-y-1 my-1">
                            {items.map((it, iIdx) => (
                              <li key={iIdx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it.replace(/^\d+\.\s+/, "")) }} />
                            ))}
                          </ol>
                        );
                      }
                      if (para.startsWith("> ")) {
                        return (
                          <blockquote key={idx} className="border-l-2 border-brand/40 pl-2.5 italic text-mute my-1.5">
                            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(para.replace(/^>\s+/, "")) }} />
                          </blockquote>
                        );
                      }
                      return (
                        <p key={idx} className="my-1" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(para) }} />
                      );
                    })}
                  </div>

                  {msg.timestamp && (
                    <div
                      className={`mt-2 text-[10px] ${
                        isUser ? "text-surface/75 text-right" : "text-mute text-right"
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface border border-line text-ink text-[11px] font-medium">
                    Dr
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand text-[11px] font-bold">
                AI
              </div>
              <div className="rounded-2xl bg-paper border border-line px-4 py-3 text-xs text-mute flex items-center gap-2">
                <span className="size-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="size-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="size-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="ml-1 text-[11px]">Analyzing clinical parameters...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Follow-up Quick Chips */}
        {followups.length > 0 && !loading && (
          <div className="border-t border-line/60 bg-paper/30 px-4 py-2.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-mute mb-1.5 flex items-center gap-1">
              <svg className="size-3 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Suggested Questions:
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {followups.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(chip)}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink/80 hover:border-brand hover:text-brand hover:bg-brand-soft/20 transition-all text-left truncate max-w-full cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <footer className="border-t border-line bg-surface p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={`Ask about ${patient.name}'s diagnosis, tests, or treatments...`}
              className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-xs text-ink outline-none transition-all placeholder:text-mute/60 focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputQuestion.trim() || loading}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-surface hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer shadow-xs"
              title="Send question"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-mute px-1">
            <span>Powered by Gemini & AST Neural Spectrogram Engine</span>
            <span>Press Enter ↵ to send</span>
          </div>
        </footer>
      </aside>
    </div>
  );
}

/** Helper to format inline bold, italics, code, and links */
function formatInlineMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-surface border border-line rounded px-1 py-0.5 text-[11px] font-mono text-ink'>$1</code>");
}
