"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";

export type AxerisMode = "TPA" | "PBA";

interface ModeContextType {
  mode: AxerisMode;
  setMode: (m: AxerisMode) => void;
  modeConfig: ModeConfig;
}

export interface ModeConfig {
  mode: AxerisMode;
  label: string;
  fullLabel: string;
  shortDesc: string;
  primaryAudience: string;
  latency: string;
  output: string;
  accentColor: string;       // Tailwind color name
  accentBg: string;          // Tailwind bg class
  accentText: string;
  accentBorder: string;
  homeRoute: string;
  roles: string[];
  terminology: {
    claim: string;           // "Pended Claim" vs "Live Transaction"
    queue: string;           // "Pend Queue" vs "Live Adjudication"
    decision: string;        // "Pend / Release" vs "Approve / Reject"
    holdAction: string;      // "Hold ACH sweep" vs "Block dispense"
    alert: string;           // "Pend Alert" vs "Pharmacist Callback"
  };
}

export const TPA_CONFIG: ModeConfig = {
  mode: "TPA",
  label: "TPA",
  fullLabel: "Third-Party Administrator",
  shortDesc: "Post-adjudication, pre-payment batch review",
  primaryAudience: "Self-funded employer plan administrators",
  latency: "Batch · 24-48h SLA",
  output: "Financial recovery · ERISA fiduciary defense",
  accentColor: "blue",
  accentBg: "bg-blue-600",
  accentText: "text-blue-600 dark:text-blue-400",
  accentBorder: "border-blue-600",
  homeRoute: "/console/tpa/dashboard",
  roles: [
    "TPA Clinical Director",
    "Clinical Reviewer (PharmD)",
    "TPA Adjudicator",
    "Employer Benefits Liaison",
    "ERISA Compliance Officer",
    "Fraud Investigation Lead",
  ],
  terminology: {
    claim: "Pended Claim",
    queue: "Pend Queue",
    decision: "Pend / Release",
    holdAction: "Hold employer ACH sweep",
    alert: "Pend Alert",
  },
};

export const PBA_CONFIG: ModeConfig = {
  mode: "PBA",
  label: "PBA",
  fullLabel: "Pharmacy Benefit Administrator",
  shortDesc: "Real-time NCPDP D.0 pre-dispense intervention",
  primaryAudience: "Transparent PBMs · pass-through pricing",
  latency: "Real-time · <200ms p95",
  output: "Clinical safety · transparent economics · pre-dispense block",
  accentColor: "purple",
  accentBg: "bg-purple-600",
  accentText: "text-purple-600 dark:text-purple-400",
  accentBorder: "border-purple-600",
  homeRoute: "/console/pba/dashboard",
  roles: [
    "PBA Clinical Pharmacist",
    "Pharmacy Network Manager",
    "PBA Operations",
    "Formulary Manager",
    "Member Safety Officer",
  ],
  terminology: {
    claim: "Live Transaction",
    queue: "Live Adjudication Stream",
    decision: "Approve / Reject (NCPDP)",
    holdAction: "Block dispense at pharmacy POS",
    alert: "Pharmacist Callback",
  },
};

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AxerisMode>("TPA");
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Explicit mode routes always win. Shared record routes (Members, Claims,
    // Prescribers, Audit, Settings) retain the mode the user came from instead
    // of silently snapping PBA reviewers back to the TPA navigation.
    let nextMode: AxerisMode = "TPA";
    if (pathname.startsWith("/console/pba")) nextMode = "PBA";
    else if (pathname.startsWith("/console/tpa")) nextMode = "TPA";
    else {
      const saved = localStorage.getItem("axeris-mode");
      if (saved === "PBA" || saved === "TPA") nextMode = saved;
    }
    setModeState(nextMode);
    localStorage.setItem("axeris-mode", nextMode);
    setHydrated(true);
  }, [pathname]);

  const setMode = (m: AxerisMode) => {
    setModeState(m);
    localStorage.setItem("axeris-mode", m);
  };

  const modeConfig = mode === "TPA" ? TPA_CONFIG : PBA_CONFIG;

  // Avoid hydration mismatch · show TPA by default until client-side hydrates
  if (!hydrated) {
    return (
      <ModeContext.Provider value={{ mode: "TPA", setMode, modeConfig: TPA_CONFIG }}>
        {children}
      </ModeContext.Provider>
    );
  }

  return (
    <ModeContext.Provider value={{ mode, setMode, modeConfig }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
