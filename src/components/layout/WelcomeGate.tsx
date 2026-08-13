"use client";

import { useEffect, useState, useCallback } from "react";
import { AxerisLogo } from "@/components/ui/AxerisLogo";
import { ArrowRight, BarChart3, ListChecks, X } from "lucide-react";

const KEY = "axeris-welcomed-v3";

type Step = { selector: string; title: string; body: string };
const STEPS: Step[] = [
  { selector: '[data-tour="nav"]', title: "Start with the left rail", body: "Every workflow has one clear home. Use the groups to move from today’s work to contract savings, clinical programs, and records." },
  { selector: '[data-tour="kpis"]', title: "Read the book in ten seconds", body: "These four cards answer what was recovered, what is waiting, whether review is on time, and how much needs attention." },
  { selector: '[data-tour="resolution"]', title: "See how claims resolved", body: "Green passed, amber found an equivalent, and red stayed held for a decision. The chart is always a quick outcome summary." },
  { selector: '[data-tour="pend"]', title: "Then work the queue", body: "Open the Pend Queue to see highest-impact claims first, with risk signals and plan dollars already prioritized." },
  { selector: "[data-copilot]", title: "Ask Axeris when you need context", body: "Use the Axeris mark to ask about a claim, number, or flag without leaving the page you are reviewing." },
];

export default function WelcomeGate() {
  const [phase, setPhase] = useState<"hidden" | "welcome" | "tour">("hidden");
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(KEY) && !document.querySelector('[data-copilot-open="true"]')) {
          setPhase("welcome");
        }
      } catch {}
    }, 700);
    return () => clearTimeout(t);
  }, []);

  const finish = useCallback(() => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setPhase("hidden");
  }, []);

  // locate the current step's element
  useEffect(() => {
    if (phase !== "tour") return;
    const measure = () => {
      const el = Array.from(document.querySelectorAll(STEPS[step].selector)).find((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      });
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => setRect(el.getBoundingClientRect()), 260); }
      else setRect(null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [phase, step]);

  if (phase === "hidden") return null;

  if (phase === "welcome") {
    return (
      <div data-welcome-overlay className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
           style={{ background: "rgba(20,18,12,0.42)", backdropFilter: "blur(4px)" }}>
        <div className="relative w-full max-w-[480px] rounded-3xl p-8 animate-fade-in-up overflow-hidden"
             style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 30px 80px -20px rgba(20,18,12,0.4)" }}>
          <div className="absolute -top-24 -right-20 w-64 h-64 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(79,195,232,0.17), rgba(47,47,230,0.06) 45%, transparent 70%)" }} />
          <div className="flex items-center gap-2.5 mb-6">
            <AxerisLogo size={26} />
            <span className="text-[1.15rem] font-medium tracking-[-0.02em] text-slate-900 dark:text-white">Axeris</span>
          </div>
          <h2 className="font-heading text-[1.7rem] leading-[1.15] tracking-[-0.02em] text-slate-900 dark:text-white">
            Hey — do you want to walk through the demo?
          </h2>
          <p className="text-[14px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            We&apos;ll explain the dashboard in five short steps using simple language. It takes about a minute, and you can exit at any time.
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-5">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 px-3 py-2.5 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-600" /><span className="text-[11.5px] text-slate-600 dark:text-slate-300">Understand the numbers</span></div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 px-3 py-2.5 flex items-center gap-2"><ListChecks className="w-4 h-4 text-emerald-600" /><span className="text-[11.5px] text-slate-600 dark:text-slate-300">Find the next action</span></div>
          </div>
          <div className="flex gap-3 mt-7">
            <button onClick={() => { setStep(0); setPhase("tour"); }}
                    className="flex-1 rounded-[10px] py-2.5 px-4 text-[14px] font-medium text-white transition-transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2"
                    style={{ background: "#17140d" }}>
              Walk me through it <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={finish}
                    className="flex-1 rounded-[9px] py-2.5 text-[14px] font-medium text-slate-700 dark:text-slate-200 transition-colors"
                    style={{ border: "1px solid var(--color-border-strong)" }}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // tour
  const s = STEPS[step];
  const pad = 8;
  const holeTop = rect ? rect.top - pad : 0;
  const holeLeft = rect ? rect.left - pad : 0;
  const holeW = rect ? rect.width + pad * 2 : 0;
  const holeH = rect ? rect.height + pad * 2 : 0;

  // tooltip placement: below the hole, else above; clamped to viewport
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const tipW = 320;
  let tipLeft = rect ? Math.min(Math.max(16, rect.left), vw - tipW - 16) : vw / 2 - tipW / 2;
  let tipTop = rect ? rect.bottom + 16 : vh / 2;
  const belowRoom = rect ? vh - rect.bottom : vh;
  if (belowRoom < 200 && rect) tipTop = rect.top - 172;
  // if the target is the tall left rail, sit the tooltip to its right
  if (rect && rect.height > vh * 0.6) { tipLeft = rect.right + 20; tipTop = vh / 2 - 90; }

  return (
    <div data-welcome-overlay className="fixed inset-0 z-[2000]">
      {/* spotlight hole via big box-shadow */}
      <div
        className="absolute rounded-xl transition-all duration-300 pointer-events-none"
        style={{
          top: holeTop, left: holeLeft, width: holeW, height: holeH,
          boxShadow: "0 0 0 9999px rgba(20,18,12,0.55)",
          border: "1.5px solid rgba(255,255,255,0.5)",
        }}
      />
      {/* tooltip */}
      <div className="absolute rounded-2xl p-5 transition-all duration-300"
           style={{ top: tipTop, left: tipLeft, width: tipW, background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 24px 60px -18px rgba(20,18,12,0.45)" }}>
        <button onClick={finish} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">{step + 1} of {STEPS.length}</div>
        <h3 className="font-heading text-[1.1rem] tracking-[-0.01em] text-slate-900 dark:text-white">{s.title}</h3>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{s.body}</p>
        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full transition-colors" style={{ background: i === step ? "#2f2fe6" : "var(--color-border-strong)" }} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep((v) => v - 1)} className="text-[13px] px-3 py-1.5 rounded-[8px] text-slate-600 dark:text-slate-300" style={{ border: "1px solid var(--color-border)" }}>Back</button>
            )}
            <button onClick={() => (step < STEPS.length - 1 ? setStep((v) => v + 1) : finish())}
                    className="text-[13px] px-4 py-1.5 rounded-[8px] text-white font-medium" style={{ background: "#17140d" }}>
              {step < STEPS.length - 1 ? "Next" : "Start exploring"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
