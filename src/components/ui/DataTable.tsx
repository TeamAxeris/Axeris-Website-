"use client";

import { ReactNode } from "react";
import clsx from "clsx";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  onRowClick,
  emptyMessage = "No records",
  rowKey = (r: T, i: number) => i,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  rowKey?: (row: T, i: number) => string | number;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-12 text-center text-slate-400 text-base">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="bg-clinical-surface border border-clinical-border rounded-md overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-clinical-surface-2 border-b border-clinical-border">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={clsx(
                    "px-4 py-3 text-[11px] uppercase tracking-[0.06em] font-bold font-heading text-clinical-fg-muted",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-border">
            {rows.map((r, i) => (
              <tr
                key={rowKey(r, i)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={clsx(
                  "transition-colors duration-150",
                  onRowClick && "cursor-pointer hover:bg-clinical-muted"
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx(
                      "px-4 py-2.5 text-[13.5px] text-clinical-fg align-middle",
                      c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left",
                      c.className
                    )}
                  >
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatRow({ items }: { items: { label: string; value: string | number; sub?: string; severity?: "ok" | "warn" | "alert" | "info" }[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))" }}>
      {items.map((it, i) => {
        const tone = {
          ok: "#0f8f69",
          warn: "#b56f0b",
          alert: "#dc4b45",
          info: "#2f2fe6",
        }[it.severity || "info"];
        return (
          <div key={i} className="relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{it.label}</div>
            </div>
            <div className="text-[1.75rem] leading-none tracking-[-0.04em] text-slate-900 dark:text-white tabular-nums mt-3">{it.value}</div>
            {it.sub && <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-2 leading-snug min-h-[1.2em]">{it.sub}</div>}
            <div className="h-0.5 rounded-full mt-3" style={{ background: tone, opacity: 0.68 }} />
          </div>
        );
      })}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-3 border-b border-clinical-border pb-4 sm:flex-row sm:items-end sm:gap-4">
      <div>
        <h1 className="text-[22px] font-bold font-heading tracking-tight text-clinical-fg">{title}</h1>
        {subtitle && <p className="text-[13.5px] text-clinical-fg-muted mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
        {meta && <div className="text-[12.5px] text-clinical-fg-muted text-right">{meta}</div>}
        {actions}
      </div>
    </div>
  );
}
