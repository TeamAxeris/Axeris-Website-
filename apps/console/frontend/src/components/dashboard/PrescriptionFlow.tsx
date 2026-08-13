"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TrendData } from "@/types";

export default function PrescriptionFlow({ trends }: { trends: TrendData[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Prescription Flow by Period</h3>
      <div className="h-64">
        {trends.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="green_count" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Appropriate" />
              <Area type="monotone" dataKey="yellow_count" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} name="Review" />
              <Area type="monotone" dataKey="red_count" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="High Risk" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">No trend data available</div>
        )}
      </div>
    </div>
  );
}
