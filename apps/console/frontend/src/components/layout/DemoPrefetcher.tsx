"use client";

/**
 * DemoPrefetcher · warms the demo cache right after login/first paint.
 *
 * Two jobs:
 *  1. Wake the backend (Render free tier cold-starts) with the first ping.
 *  2. Warm the highest-value routes for the active mode while the browser is
 *     idle. The previous implementation queued every endpoint in both modes,
 *     which competed with chart rendering and made the console feel sluggish.
 *
 * Requests are staggered so we never burst the backend, and any URL that
 * is already cached is skipped inside prefetch().
 */

import { useEffect } from "react";
import { useMode } from "@/context/ModeContext";
import { prefetch } from "@/lib/demoFetch";

const SHARED_URLS = [
  "/api/v1/notifications",
  "/api/v1/analytics/overview",
  "/api/v1/analytics/savings",
  "/api/v1/analytics/trends",
  "/api/v1/analytics/fraud",
  "/api/v1/prescriptions?limit=200",
  "/api/v1/patients",
  "/api/v1/providers",
  "/api/v1/audit?limit=100",
  "/api/v1/audit/stats",
  "/api/v1/safeguards/dashboard",
  "/api/v1/data-sources/manifest",
  "/api/v1/ml-engine/intelligence",
];

const TPA_URLS = [
  "/api/v1/tpa/dashboard",
  "/api/v1/tpa/pend-queue?sort_by=risk&limit=200",
  "/api/v1/tpa/asa-disputes",
  "/api/v1/tpa/fraud-referrals",
  "/api/v1/tpa/employers",
  "/api/v1/tpa/stewardship-reports",
  "/api/v1/tpa/compliance-status",
  "/api/v1/tpa/pbm-audit",
  "/api/v1/tpa/glp1-watch",
  "/api/v1/tpa/eligibility-leakage",
  "/api/v1/tpa/high-cost-forecast",
  "/api/v1/tpa/ops-metrics",
  "/api/v1/tpa/pa-gold-card",
  "/api/v1/tpa/med-optimization",
  "/api/v1/tpa/adherence",
  "/api/v1/tpa/mac-repricing",
  "/api/v1/tpa/dtc-leakage",
  "/api/v1/tpa/plan-design",
  "/api/v1/tpa/conflict-audit",
];

const PBA_URLS = [
  "/api/v1/pba/dashboard",
  "/api/v1/pba/live-transactions?limit=80",
  "/api/v1/pba/callback-queue?limit=80",
  "/api/v1/pba/ncpdp-rejects",
  "/api/v1/pba/pharmacy-network",
  "/api/v1/pba/formulary-mgmt",
  "/api/v1/pba/member-safety",
  "/api/v1/pba/savings-opportunities",
  "/api/v1/pba/split-fill",
  "/api/v1/pba/site-of-care",
  "/api/v1/pba/mail-order",
];

export default function DemoPrefetcher() {
  const { mode } = useMode();

  useEffect(() => {
    let timer = 0;
    let idle = 0;
    const warm = () => {
      const current = mode === "PBA" ? PBA_URLS : TPA_URLS;
      prefetch([...current.slice(0, 8), ...SHARED_URLS.slice(0, 5)], 280);
    };
    timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idle = (window as any).requestIdleCallback(warm, { timeout: 2500 });
      } else {
        warm();
      }
    }, 1400);
    return () => {
      window.clearTimeout(timer);
      if (idle && "cancelIdleCallback" in window) (window as any).cancelIdleCallback(idle);
    };
  }, [mode]);

  return null;
}
