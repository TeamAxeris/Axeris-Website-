"use client";

import { useToast } from "@/context/ToastContext";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: "bg-green-50 border-green-300 text-green-900 dark:bg-emerald-900/20",
  error: "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:text-red-200",
  warning: "bg-yellow-50 border-yellow-300 text-yellow-900 dark:bg-yellow-900/20",
  info: "bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200",
};

const iconStyles = {
  success: "text-green-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  info: "text-blue-600 dark:text-blue-400",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        const content = (
          <div
            key={toast.id}
            className={clsx(
              "flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm",
              "animate-slide-in-right",
              styles[toast.type]
            )}
          >
            <Icon className={clsx("w-5 h-5 flex-shrink-0 mt-0.5", iconStyles[toast.type])} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{toast.title}</div>
              {toast.message && (
                <div className="text-xs mt-0.5 opacity-80">{toast.message}</div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
            >
              <X className="w-4 h-4 opacity-60" />
            </button>
          </div>
        );

        if (toast.link) {
          return (
            <Link key={toast.id} href={toast.link} onClick={() => removeToast(toast.id)}>
              {content}
            </Link>
          );
        }
        return <div key={toast.id}>{content}</div>;
      })}
    </div>
  );
}
