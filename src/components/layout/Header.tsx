"use client";

import GlobalSearch from "./GlobalSearch";
import NotificationsBell from "./NotificationsBell";

export default function Header({ title }: { title?: string }) {
  return (
    <header className="flex min-h-16 flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-gray-800 dark:text-slate-100">{title || "Dashboard"}</h2>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 lg:flex-none">
          <GlobalSearch />
        </div>
        <NotificationsBell />
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
          A
        </div>
      </div>
    </header>
  );
}
