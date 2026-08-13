"use client";

import GlobalSearch from "./GlobalSearch";
import NotificationsBell from "./NotificationsBell";

export default function Header({ title }: { title?: string }) {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">{title || "Dashboard"}</h2>
      </div>
      <div className="flex items-center gap-4">
        <GlobalSearch />
        <NotificationsBell />
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
          A
        </div>
      </div>
    </header>
  );
}
