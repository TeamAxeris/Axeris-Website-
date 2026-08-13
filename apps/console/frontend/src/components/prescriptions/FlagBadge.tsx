import type { FlagColor } from "@/types";
import clsx from "clsx";

const styles: Record<FlagColor, string> = {
  GREEN: "bg-green-100 text-green-800 border-green-300 dark:text-emerald-300 dark:bg-green-900/30",
  YELLOW: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:text-yellow-300 dark:bg-yellow-900/30",
  RED: "bg-red-100 text-red-800 border-red-300 dark:text-red-300 dark:bg-red-900/30",
};

const labels: Record<FlagColor, string> = {
  GREEN: "Appropriate",
  YELLOW: "Review",
  RED: "High Risk",
};

const dots: Record<FlagColor, string> = {
  GREEN: "bg-green-500",
  YELLOW: "bg-yellow-500",
  RED: "bg-red-500",
};

export default function FlagBadge({
  color,
  showLabel = true,
  size = "md",
}: {
  color: FlagColor;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  if (!showLabel) {
    return (
      <span className={clsx("inline-block w-3 h-3 rounded-full", dots[color])} />
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        styles[color],
        sizeClasses[size]
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", dots[color])} />
      {labels[color]}
    </span>
  );
}
