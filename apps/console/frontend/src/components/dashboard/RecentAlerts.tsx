"use client";

import Link from "next/link";
import FlagBadge from "@/components/prescriptions/FlagBadge";
import type { Prescription, FlagColor } from "@/types";

export default function RecentAlerts({ prescriptions }: { prescriptions: Prescription[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Recent Alerts</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {prescriptions.length === 0 && (
          <p className="text-gray-400 text-sm">No alerts to display</p>
        )}
        {prescriptions.slice(0, 15).map((rx) => (
          <Link
            key={rx.id}
            href={`/prescriptions/${rx.id}`}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 dark:border-slate-700 dark:hover:bg-slate-700/40"
          >
            <FlagBadge color={rx.flag_color as FlagColor} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900 truncate dark:text-white">{rx.patient_name}</span>
                <span className="text-gray-400">-</span>
                <span className="text-sm text-gray-600 truncate dark:text-slate-400">{rx.drug_name}</span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {rx.flags && rx.flags.length > 0 ? rx.flags[0].title : "Flagged prescription"}
              </p>
            </div>
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {rx.date_written ? new Date(rx.date_written).toLocaleDateString() : ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
