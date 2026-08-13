"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  width = "wide",
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: "narrow" | "wide";
  children: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    // Hide the floating Copilot launcher while the drawer is open so it
    // doesn't visually block the drawer footer action buttons.
    document.body.dataset.drawerOpen = "true";
    return () => {
      document.removeEventListener("keydown", handler);
      delete document.body.dataset.drawerOpen;
    };
  }, [open, onClose]);

  if (!open) return null;
  const w = width === "narrow" ? "w-full sm:w-[520px]" : "w-full sm:w-[min(760px,92vw)]";

  return (
    <>
      <div className="fixed inset-0 z-40 backdrop-blur-[2px]" style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }} onClick={onClose} />
      <aside className={`fixed right-0 top-0 ${w} h-screen bg-clinical-surface border-l border-clinical-border shadow-2xl z-50 flex flex-col`}>
        <div className="flex items-start justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-clinical-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-bold font-heading tracking-tight text-clinical-fg">{title}</h2>
            {subtitle && <p className="text-[13.5px] text-clinical-fg-muted mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 -mt-1 text-clinical-fg-subtle hover:text-clinical-fg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        {actions && (
          <div className="border-t border-clinical-border px-4 py-3 sm:px-6 sm:py-4 bg-clinical-surface-2 flex flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        )}
      </aside>
    </>
  );
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold font-heading text-clinical-fg-muted mb-2.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Field({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13.5px] py-2 border-b border-clinical-border last:border-b-0">
      <span className="text-clinical-fg-muted flex-shrink-0">{label}</span>
      <span className={`text-clinical-fg text-right ${mono ? "font-mono text-[12.5px] tabular-nums" : ""}`}>{value || "·"}</span>
    </div>
  );
}
