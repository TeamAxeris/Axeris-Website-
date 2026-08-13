"use client";

import { useMode, TPA_CONFIG, PBA_CONFIG } from "@/context/ModeContext";
import { useRouter } from "next/navigation";
import { ChevronDown, Building2, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import clsx from "clsx";

export default function ModeBar() {
  const { mode, modeConfig, setMode } = useMode();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const switchMode = (m: "TPA" | "PBA") => {
    setMode(m);
    setOpen(false);
    router.push(m === "TPA" ? TPA_CONFIG.homeRoute : PBA_CONFIG.homeRoute);
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex items-center px-4 py-2 gap-4">
        {/* Mode pill */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1 rounded text-[12px] font-semibold border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
          >
            {mode === "TPA" ? <Building2 className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            <span>{mode === "TPA" ? "TPA · Plan Sponsor" : "PBA · Real-Time Adjudication"}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 w-[420px] bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 shadow-lg z-50">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Switch Operating Mode
              </div>
              {[TPA_CONFIG, PBA_CONFIG].map((cfg) => {
                const ModeIcon = cfg.mode === "TPA" ? Building2 : Zap;
                const active = cfg.mode === mode;
                return (
                  <button
                    key={cfg.mode}
                    onClick={() => switchMode(cfg.mode)}
                    className={clsx(
                      "w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-b-0 border-slate-100 dark:border-slate-800",
                      active && "bg-slate-50/60 dark:bg-slate-800/60"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <ModeIcon className="w-4 h-4 text-slate-600 dark:text-slate-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{cfg.label} · {cfg.fullLabel}</span>
                          {active && <span className="text-[9px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{cfg.shortDesc}</p>
                        <div className="flex gap-3 mt-1.5 text-[10px] text-slate-500">
                          <span><strong className="text-slate-700 dark:text-slate-300">Audience:</strong> {cfg.primaryAudience}</span>
                          <span><strong className="text-slate-700 dark:text-slate-300">Latency:</strong> {cfg.latency}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
