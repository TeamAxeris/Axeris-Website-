import type { Config } from "tailwindcss";

const warm = {
  50: "#f7f5f0", 100: "#efece4", 200: "#e4dfd4", 300: "#d3ccbe",
  400: "#a8a196", 500: "#7c766c", 600: "#5f5a50", 700: "#423d34",
  800: "#292620", 900: "#17140d", 950: "#0e0c08",
};

const brandBlue = {
  50: "#eef0ff", 100: "#e0e3ff", 200: "#c6cbff", 300: "#a2a8fb",
  400: "#6f74f3", 500: "#4a4aee", 600: "#2f2fe6", 700: "#2727c2",
  800: "#21219b", 900: "#1d1d7a", 950: "#131350",
};

const config: Config = {
  // The console owns its light/dark state explicitly through ThemeProvider.
  // Without class mode, Tailwind follows the operating-system preference and
  // can render dark cards while the console itself is still in light mode.
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: warm,
        slate: warm,
        blue: brandBlue,
        indigo: brandBlue,
        clinical: {
          bg: "var(--color-bg)", surface: "var(--color-surface)",
          "surface-2": "var(--color-surface-2)", muted: "var(--color-muted)",
          fg: "var(--color-fg)", "fg-muted": "var(--color-fg-muted)",
          "fg-subtle": "var(--color-fg-subtle)", primary: "var(--color-primary)",
          "primary-hover": "var(--color-primary-hover)", "on-primary": "var(--color-on-primary)",
          secondary: "var(--color-secondary)", accent: "var(--color-accent)",
          border: "var(--color-border)", "border-strong": "var(--color-border-strong)",
          ok: "var(--color-ok)", warn: "var(--color-warn)", alert: "var(--color-alert)",
          info: "var(--color-info)", ring: "var(--color-ring)",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
      },
      fontFamily: {
        heading: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
