"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { copilotChat, getQuickQuestions } from "@/lib/api";
import type { CopilotMessage } from "@/types";
import {
  Send, X, Bot, User, Sparkles, Loader2,
  Lightbulb, ExternalLink, Minimize2, Maximize2,
  Trash2, ArrowRight, Shield, Pill, UserSearch, FileSearch,
  AlertTriangle, Stethoscope,
} from "lucide-react";
import { AxerisLogo } from "@/components/ui/AxerisLogo";
import clsx from "clsx";

interface CopilotPanelProps {
  contextType?: string;
  contextId?: string;
}

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  suggested_actions?: string[];
  confidence?: number;
  timestamp: Date;
}

// Render markdown-like content: **bold**, emoji, bullet lists
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        // Bold rendering
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          // Italic rendering *text*
          const italicParts = part.split(/(\*[^*]+\*)/g);
          return italicParts.map((ip, k) => {
            if (ip.startsWith("*") && ip.endsWith("*") && ip.length > 2) {
              return (
                <em key={`${j}-${k}`} className="italic text-gray-500">
                  {ip.slice(1, -1)}
                </em>
              );
            }
            return <span key={`${j}-${k}`}>{ip}</span>;
          });
        });

        // Bullet point lines
        if (line.trim().startsWith("- ")) {
          return (
            <div key={i} className="flex gap-1.5 pl-2">
              <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
              <span>{rendered}</span>
            </div>
          );
        }
        // Indented sub-items (starts with spaces + text)
        if (line.trim().startsWith("➡️") || line.trim().startsWith("Effect:") || line.trim().startsWith("Management:") || line.trim().startsWith("Evidence:") || line.trim().startsWith("Dose")) {
          return (
            <div key={i} className="pl-5 text-gray-600 dark:text-slate-400 text-[12px]">
              {rendered}
            </div>
          );
        }
        // Empty line = small spacer
        if (line.trim() === "") {
          return <div key={i} className="h-1.5" />;
        }
        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );
}

// Category styling config
const CATEGORY_STYLES: Record<string, { icon: typeof UserSearch; color: string }> = {
  Patients: { icon: UserSearch, color: "text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40" },
  Drugs: { icon: Pill, color: "text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40" },
  Prescriptions: { icon: FileSearch, color: "text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40" },
  Fraud: { icon: AlertTriangle, color: "text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40" },
};

export default function CopilotPanel({ contextType, contextId }: CopilotPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [quickCategories, setQuickCategories] = useState<{ label: string; questions: string[] }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load dynamic quick questions from DB
  useEffect(() => {
    getQuickQuestions()
      .then((res) => setQuickCategories(res.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatEntry = {
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history: CopilotMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await copilotChat(
        userMsg.content,
        contextType,
        contextId,
        history,
      );

      const assistantMsg: ChatEntry = {
        role: "assistant",
        content: response.reply,
        sources: response.sources,
        suggested_actions: response.suggested_actions,
        confidence: response.confidence,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I encountered an error connecting to the Axeris engine. Please check that the backend is running and try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, contextType, contextId]);

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (q: string) => {
    sendMessage(q);
    setActiveCategory(null);
  };

  const handleActionClick = (action: string) => {
    // Turn suggested actions into follow-up queries
    const actionQueries: Record<string, string> = {
      "Review RED-flagged prescriptions": "Show me all RED flag prescriptions",
      "Deny prescription": "Generate a denial rationale for this prescription",
      "Approve prescription": "Generate an approval rationale for this prescription",
      "Request prior authorization": "What are the PA requirements for this drug?",
      "Flag for SIU review": "Show me suspicious providers",
      "Review formulary alternatives": "What are cheaper alternatives for this drug?",
      "Refer to Special Investigations Unit (SIU)": "Show me fraud indicators for this provider",
      "Review all prescriptions from this provider": "How many prescriptions does this provider have?",
      "Audit provider prescribing patterns": "Show me this provider's prescribing stats",
      "Check PDMP records": "Show me doctor shopping activity",
    };
    const query = actionQueries[action] || action;
    sendMessage(query);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        data-copilot
        className="fixed bottom-5 right-5 z-50 flex h-[58px] w-[58px] items-center justify-center rounded-[20px] border border-white/30 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.03] group"
        style={{
          background: "linear-gradient(145deg, #4338ca 0%, #7c3aed 52%, #0891b2 100%)",
          boxShadow: "0 20px 44px -14px rgba(79,70,229,.78), 0 5px 16px rgba(15,23,42,.22), inset 0 1px 0 rgba(255,255,255,.32)",
        }}
        title="Ask Axeris"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white shadow-[0_5px_15px_rgba(15,23,42,.18)]">
          <AxerisLogo size={28} />
        </span>
      </button>
    );
  }

  return (
    <div
      data-copilot
      className={clsx(
        "fixed z-50 bg-white dark:bg-slate-800 rounded-[22px] shadow-2xl border border-indigo-100 dark:border-slate-700 flex flex-col transition-all duration-300 overflow-hidden",
        isExpanded
          ? "bottom-4 right-4 w-[650px] h-[750px]"
          : "bottom-6 right-6 w-[440px] h-[600px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-700 via-violet-600 to-cyan-600 text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <AxerisLogo size={24} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Axeris AI Copilot</h3>
            <p className="text-[10px] text-blue-100">
              {loading ? "Analyzing..." : "Decision Support · Ready"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setActiveCategory(null); }}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context indicator */}
      {contextType && contextId && (
        <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
          <ExternalLink className="w-3 h-3" />
          Context: <span className="font-medium">{contextType}</span> {contextId}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="py-4">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-white dark:bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-200">
                <AxerisLogo size={38} />
              </div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">
                AI Clinical Assistant
              </h4>
              <p className="text-xs text-gray-500 max-w-[300px] mx-auto">
                I query live patient, drug, and prescription data. Ask me anything about your cases.
              </p>
            </div>

            {/* Category Quick Questions · loaded from DB */}
            <div className="space-y-2">
              {quickCategories.map((cat, ci) => {
                const style = CATEGORY_STYLES[cat.label] || CATEGORY_STYLES.Patients;
                const CatIcon = style.icon;
                return (
                  <div key={ci}>
                    <button
                      onClick={() => setActiveCategory(activeCategory === ci ? null : ci)}
                      className={clsx(
                        "w-full flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-all",
                        activeCategory === ci
                          ? style.color
                          : "text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/40 border-gray-100 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700/40"
                      )}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                      {cat.label}
                      <ArrowRight className={clsx(
                        "w-3 h-3 ml-auto transition-transform",
                        activeCategory === ci ? "rotate-90" : ""
                      )} />
                    </button>
                    {activeCategory === ci && (
                      <div className="mt-1 ml-2 space-y-1">
                        {cat.questions.map((q, qi) => (
                          <button
                            key={qi}
                            onClick={() => handleQuickQuestion(q)}
                            className="block w-full text-left text-[12px] text-gray-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <Lightbulb className="w-3 h-3 inline mr-1.5 text-yellow-500" />
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick input hints */}
            <div className="mt-4 text-center">
              <p className="text-[10px] text-gray-400">
                or type any question · I understand natural language
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={clsx(
              "flex gap-2",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div
              className={clsx(
                "max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-gray-50 dark:bg-slate-900/40 text-gray-800 dark:text-slate-200 rounded-bl-md border border-gray-100 dark:border-slate-700"
              )}
            >
              {msg.role === "assistant" ? (
                <RichText text={msg.content} />
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-slate-700">
                  <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    Data Sources:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {msg.sources.map((s, j) => (
                      <span key={j} className="text-[10px] bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Actions · clickable */}
              {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                  <div className="text-[10px] text-gray-400 mb-1">Actions:</div>
                  <div className="flex flex-wrap gap-1">
                    {msg.suggested_actions.map((a, j) => (
                      <button
                        key={j}
                        onClick={() => handleActionClick(a)}
                        className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2 py-1 rounded-md flex items-center gap-1 transition-colors border border-blue-100 dark:border-blue-800"
                      >
                        <ArrowRight className="w-2.5 h-2.5" />
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence */}
              {msg.confidence !== undefined && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all",
                        msg.confidence >= 0.9 ? "bg-green-500" : msg.confidence >= 0.8 ? "bg-blue-500" : "bg-yellow-500"
                      )}
                      style={{ width: `${msg.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {(msg.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 bg-gray-200 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl px-4 py-3 rounded-bl-md border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                <span>Querying Axeris database...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 rounded-b-2xl">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a patient, drug, prescription, or provider..."
            rows={1}
            className="flex-1 text-sm border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-slate-900 dark:text-white"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-600 text-white rounded-xl px-3 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-1.5 text-[10px] text-gray-400 text-center">
          Axeris decision intelligence · Responses use the current claim workspace
        </div>
      </div>
    </div>
  );
}
