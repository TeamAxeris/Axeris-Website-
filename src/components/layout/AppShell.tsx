"use client";

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

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <>
      <div className="console-shell flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ModeBar />
          <main className="flex-1 overflow-y-auto transition-colors" style={{ background: "var(--color-bg)" }}>
            {/* Single content cap for the whole app: stretches to fill the
                viewport on laptops and standard desktops, centers on
                ultra-wide screens so a 4K monitor doesn't sprawl tables
                across 2400px of pixels. Per-page max-w wrappers were
                removed to avoid double-capping at 1400px. */}
            <div className="mx-auto max-w-[1440px] px-5 py-9 pb-28 sm:pl-10 sm:pr-24">
              {children}
            </div>
          </main>
        </div>
      </div>
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
