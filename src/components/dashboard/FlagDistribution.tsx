"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { OverviewMetrics } from "@/types";

const COLORS = { GREEN: "#22c55e", YELLOW: "#eab308", RED: "#ef4444" };

export default function FlagDistribution({ metrics }: { metrics: OverviewMetrics }) {
  const data = [
    { name: "Appropriate", value: metrics.green_count, color: COLORS.GREEN },
    { name: "Review", value: metrics.yellow_count, color: COLORS.YELLOW },
    { name: "High Risk", value: metrics.red_count, color: COLORS.RED },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Flag Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, "Prescriptions"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
