"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ModeProvider } from "@/context/ModeContext";
import Sidebar from "@/components/layout/Sidebar";
import ModeBar from "@/components/layout/ModeBar";
import LoginScreen from "@/components/auth/LoginScreen";
import ToastContainer from "@/components/ui/ToastContainer";
import CopilotWrapper from "@/components/ui/CopilotWrapper";
import DemoPrefetcher from "@/components/layout/DemoPrefetcher";
import WelcomeGate from "@/components/layout/WelcomeGate";
import { AxerisLogo } from "@/components/ui/AxerisLogo";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <>
      <div className="console-shell flex h-screen overflow-hidden">
        <Sidebar className="hidden w-[248px] flex-shrink-0 md:flex" />
        <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
          <header data-tour="nav" className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900 md:hidden">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <AxerisLogo size={25} />
              <span className="text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">Axeris</span>
            </div>
            <div className="w-10" aria-hidden="true" />
          </header>
          <ModeBar />
          <main className="flex-1 overflow-y-auto transition-colors" style={{ background: "var(--color-bg)" }}>
            {/* Single content cap for the whole app: stretches to fill the
                viewport on laptops and standard desktops, centers on
                ultra-wide screens so a 4K monitor doesn't sprawl tables
                across 2400px of pixels. Per-page max-w wrappers were
                removed to avoid double-capping at 1400px. */}
            <div className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pl-10 md:pr-24">
              {children}
            </div>
          </main>
        </div>
      </div>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[1000] md:hidden">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <Sidebar
            className="relative h-full min-h-0 w-[min(86vw,300px)] shadow-2xl"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </div>
      )}
      <ToastContainer />
      <CopilotWrapper />
      <DemoPrefetcher />
      <WelcomeGate />
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SettingsProvider>
          <ModeProvider>
            <AuthGate>{children}</AuthGate>
          </ModeProvider>
        </SettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
