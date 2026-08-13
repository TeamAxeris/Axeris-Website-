import clsx from "clsx";
import { CheckCircle2, AlertCircle, ShieldAlert, Clock } from "lucide-react";

type Disposition = "APPROVE" | "REVIEW" | "FLAG";

const styles: Record<Disposition, string> = {
  APPROVE: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700",
  REVIEW: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",
  FLAG: "bg-red-100 text-red-900 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700",
};

const icons: Record<Disposition, React.ComponentType<any>> = {
  APPROVE: CheckCircle2,
  REVIEW: AlertCircle,
  FLAG: ShieldAlert,
};

const subtitles: Record<Disposition, string> = {
  APPROVE: "Auto-payment authorized",
  REVIEW: "Soft hold · 24h SLA",
  FLAG: "Hard hold · explicit resolution",
};

export default function DispositionBadge({
  disposition,
  holdType,
  slaDeadline,
  size = "md",
  showSubtitle = false,
}: {
  disposition: Disposition;
  holdType?: string | null;
  slaDeadline?: string | null;
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
}) {
  const Icon = icons[disposition];
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  const slaText = slaDeadline ? new Date(slaDeadline).toLocaleString() : null;

  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border font-bold uppercase tracking-wider",
        styles[disposition],
        sizeClasses[size]
      )}>
        <Icon className="w-3.5 h-3.5" />
        {disposition}
      </span>
      {showSubtitle && (
        <span className="text-[10px] text-gray-500 dark:text-gray-400 px-1">
          {subtitles[disposition]}
        </span>
      )}
      {slaText && holdType === "soft_hold" && (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 px-1 inline-flex items-center gap-1">
          <Clock className="w-3 h-3" /> Auto-release: {slaText}
        </span>
      )}
    </div>
  );
}
