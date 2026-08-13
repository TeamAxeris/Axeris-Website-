import type { Config } from "tailwindcss";

/* ── Axeris brand ramps ─────────────────────────────────────────────────
 * The whole app is written in stock Tailwind gray/slate/blue utilities.
 * Rather than touch 44 pages, we remap those ramps to the Axeris design
 * system (warm cream paper, ink text, electric royal blue) so every page
 * picks up the brand at the token layer.
 */
const warm = {
  50: "#f7f5f0",
  100: "#efece4",
  200: "#e4dfd4",
  300: "#d3ccbe",
  400: "#a8a196",
  500: "#7c766c",
  600: "#5f5a50",
  700: "#423d34",
  800: "#292620",
  900: "#17140d",
  950: "#0e0c08",
};

const brandBlue = {
  50: "#eef0ff",
  100: "#e0e3ff",
  200: "#c6cbff",
  300: "#a2a8fb",
  400: "#6f74f3",
  500: "#4a4aee",
  600: "#2f2fe6",
  700: "#2727c2",
  800: "#21219b",
  900: "#1d1d7a",
  950: "#131350",
};

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gray: warm,
        slate: warm,
        blue: brandBlue,
        indigo: brandBlue,
        clinical: {
          bg: "var(--color-bg)",
          surface: "var(--color-surface)",
          "surface-2": "var(--color-surface-2)",
          muted: "var(--color-muted)",
          fg: "var(--color-fg)",
          "fg-muted": "var(--color-fg-muted)",
          "fg-subtle": "var(--color-fg-subtle)",
          primary: "var(--color-primary)",
          "primary-hover": "var(--color-primary-hover)",
          "on-primary": "var(--color-on-primary)",
          secondary: "var(--color-secondary)",
          accent: "var(--color-accent)",
          border: "var(--color-border)",
          "border-strong": "var(--color-border-strong)",
          ok: "var(--color-ok)",
          warn: "var(--color-warn)",
          alert: "var(--color-alert)",
          info: "var(--color-info)",
          ring: "var(--color-ring)",
        },
      },
      fontFamily: {
        heading: ["var(--font-geist)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist)", "system-ui", "-apple-system", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      letterSpacing: {
        tight: "-0.01em",
      },
    },
  },
  plugins: [],
};
export default config;
