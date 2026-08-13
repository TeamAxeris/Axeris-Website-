"use client";

import { ShieldCheck, AlertTriangle, DollarSign, ShieldAlert } from "lucide-react";
import type { OverviewMetrics } from "@/types";

export default function MetricsCards({ metrics }: { metrics: OverviewMetrics }) {
  const cards = [
    {
      label: "Total Prescriptions",
      value: metrics.total_prescriptions.toLocaleString(),
      icon: ShieldCheck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Flagged Rate",
      value: `${metrics.flagged_percentage}%`,
      sub: `${metrics.flagged_count} flagged`,
      icon: AlertTriangle,
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    {
      label: "Potential Savings",
      value: `$${metrics.total_cost_savings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: "text-green-600 dark:text-emerald-400",
      bg: "bg-green-50 dark:bg-emerald-900/20",
    },
    {
      label: "Safety Catches",
      value: metrics.safety_catches.toString(),
      sub: "high-risk flags",
      icon: ShieldAlert,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 font-medium">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
            {card.sub && <div className="text-sm text-gray-500 mt-1">{card.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
