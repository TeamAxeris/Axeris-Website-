"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8">
      <AlertTriangle className="w-10 h-10 text-amber-500" />
      <div>
        <div className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">
          Failed to load
        </div>
        <div className="text-[13px] text-slate-500 mt-1">
          Something went wrong fetching this page.
        </div>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 text-[13px] font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}
