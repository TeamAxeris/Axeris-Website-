"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Pill, Stethoscope, FileText, X, Loader2 } from "lucide-react";
import { globalSearch } from "@/lib/api";
import type { SearchResults, SearchResultItem } from "@/types";
import clsx from "clsx";

const typeIcons = {
  patient: User,
  drug: Pill,
  provider: Stethoscope,
  prescription: FileText,
};

const typeColors = {
  patient: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20",
  drug: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20",
  provider: "text-teal-600 bg-teal-50",
  prescription: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
};

const typeRoutes: Record<string, string> = {
  patient: "/patients",
  drug: "/drugs",
  provider: "/providers",
  prescription: "/prescriptions",
};

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(q);
      setResults(data);
      setOpen(true);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleSelect = (item: SearchResultItem) => {
    const route = typeRoutes[item.type] || "";
    router.push(`${route}/${item.id}`);
    setOpen(false);
    setQuery("");
  };

  const allResults: SearchResultItem[] = results
    ? [...results.patients, ...results.drugs, ...results.providers, ...results.prescriptions]
    : [];

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results && results.total > 0) setOpen(true); }}
          placeholder="Search patients, drugs, providers... (Ctrl+K)"
          className="pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dark:border-slate-600"
        />
        {loading && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(""); setResults(null); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results && (
        <div className="absolute top-full mt-2 w-[420px] right-0 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 overflow-hidden animate-fade-in dark:bg-slate-800 dark:border-slate-700">
          {results.total === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {(["patients", "drugs", "providers", "prescriptions"] as const).map((group) => {
                const items = results[group];
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 dark:bg-slate-900/40 dark:border-slate-700">
                      <span className="text-xs font-semibold text-gray-500 uppercase">{group}</span>
                      <span className="text-xs text-gray-400 ml-2">{items.length}</span>
                    </div>
                    {items.map((item) => {
                      const Icon = typeIcons[item.type];
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left"
                        >
                          <div className={clsx("p-1.5 rounded-lg", typeColors[item.type])}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate dark:text-white">{item.label}</div>
                            {item.sublabel && (
                              <div className="text-xs text-gray-500 truncate">{item.sublabel}</div>
                            )}
                          </div>
                          {item.flag_color && (
                            <span className={clsx(
                              "w-2.5 h-2.5 rounded-full flex-shrink-0",
                              item.flag_color === "RED" ? "bg-red-500" :
                              item.flag_color === "YELLOW" ? "bg-yellow-500" : "bg-green-500"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex justify-between dark:bg-slate-900/40 dark:border-slate-700">
            <span>{results.total} results</span>
            <span>ESC to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
