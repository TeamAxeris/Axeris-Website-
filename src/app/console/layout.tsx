import type { Metadata } from "next";
import "./console.css";
import { ToastProvider } from "@/context/ToastContext";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Axeris · Plan Sponsor Console",
  description: "AI-powered prescription review and clinical decision support for plan sponsors.",
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
