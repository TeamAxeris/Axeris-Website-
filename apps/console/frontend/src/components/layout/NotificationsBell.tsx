"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertOctagon, AlertTriangle, ShieldCheck, Info, X } from "lucide-react";
import clsx from "clsx";

interface NotificationItem {
  id: string;
  type: string;
  severity: "alert" | "warn" | "info";
  title: string;
  body: string;
  link?: string | null;
  timestamp: string;
}

interface NotificationsResponse {
  unread_count: number;
  items: NotificationItem[];
  last_updated: string;
}

const sevIcon = (sev: string) =>
  sev === "alert" ? AlertOctagon : sev === "warn" ? AlertTriangle : Info;

const sevColor = (sev: string) =>
  sev === "alert"
    ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
    : sev === "warn"
      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
      : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30";

const LAST_SEEN_KEY = "axeris.notifications.lastSeen";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/v1/notifications").then(r => r.json() as Promise<NotificationsResponse>);
      setData(res);
      const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) || "0");
      const newCount = res.items.filter((i) => {
        const t = new Date(i.timestamp).getTime();
        return t > lastSeen && (i.severity === "alert" || i.severity === "warn");
      }).length;
      setUnread(newCount);
    } catch {
      // silent fail · bell still works without data
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const openPanel = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        // Mark current as seen
        localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
        setUnread(0);
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={openPanel}
        className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white dark:ring-slate-900">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-h-[520px] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">Notifications</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {data ? `${data.items.length} active signal${data.items.length !== 1 ? "s" : ""}` : "Loading…"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!data && (
            <div className="px-4 py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">Loading notifications…</div>
          )}

          {data && data.items.length === 0 && (
            <div className="px-4 py-10 text-center">
              <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">All clear</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">No urgent signals right now.</div>
            </div>
          )}

          {data && data.items.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {data.items.map((n) => {
                const Icon = sevIcon(n.severity);
                const inner = (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className={clsx("p-1.5 rounded-lg flex-shrink-0", sevColor(n.severity))}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{n.title}</div>
                      <div className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">{n.body}</div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })}
            </div>
          )}

          {data && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 dark:text-slate-500 text-center">
              Updated {new Date(data.last_updated).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
