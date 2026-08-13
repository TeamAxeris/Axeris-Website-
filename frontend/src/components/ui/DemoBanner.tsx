"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useMode } from "@/context/ModeContext";

const STORAGE_KEY = "axeris-demo-banner-dismissed";

export function DemoBanner() {
  const { modeConfig } = useMode();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-[13px] text-slate-700 dark:text-slate-300">
            <div className="flex-1">
        <span className="font-semibold text-slate-900 dark:text-slate-100">Welcome to Axeris.</span>{" "}
        You&apos;re viewing the <span className="font-semibold">{modeConfig.label}</span> mode demo.
        Switch modes via the header dropdown. All data is synthetic.
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0 mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
