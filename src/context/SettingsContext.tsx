"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SettingsState {
  // Rule thresholds
  redThreshold: number;
  yellowThreshold: number;
  polypharmacyThreshold: number;
  doctorShoppingThreshold: number;
  // AI config
  aiModel: string;
  confidenceThreshold: number;
  autoGenerateNotes: boolean;
  enableCopilotSuggestions: boolean;
  // Alert preferences
  emailRedFlags: boolean;
  emailYellowFlags: boolean;
  realtimeDashboard: boolean;
  prescriberNotifications: boolean;
  paStatusNotifications: boolean;
  fraudSiuAlerts: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  redThreshold: 0.7,
  yellowThreshold: 0.3,
  polypharmacyThreshold: 5,
  doctorShoppingThreshold: 3,
  aiModel: "claude-sonnet",
  confidenceThreshold: 0.8,
  autoGenerateNotes: true,
  enableCopilotSuggestions: true,
  emailRedFlags: true,
  emailYellowFlags: false,
  realtimeDashboard: true,
  prescriberNotifications: true,
  paStatusNotifications: true,
  fraudSiuAlerts: true,
};

interface SettingsContextType {
  settings: SettingsState;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
  resetSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  useEffect(() => {
    const stored = localStorage.getItem("axeris_settings");
    if (stored) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } catch { /* ignore */ }
    }
  }, []);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("axeris_settings", JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem("axeris_settings");
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
