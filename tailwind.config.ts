import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0B111D",
          900: "#101827", // Main background
          850: "#141F33", // Input / well background
          800: "#18243A", // Card / surface background
          750: "#1B2A43", // Elevated card / dropdown
          700: "#1E2D44", // Secondary border / divider
          600: "#263750", // Primary card border
          500: "#334766", // Focus / accent border
        },
        accent: {
          DEFAULT: "#3978F6",
          hover: "#2B68E0",
          light: "#60A5FA",
        },
        fintech: {
          green: "#20B486",
          greenHover: "#199B72",
          amber: "#F0A83B",
          amberHover: "#D9942E",
          red: "#EF4444",
          redHover: "#DC2626",
          slate: "#94A3B8",
          muted: "#64748B",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 3px 0 rgba(0, 0, 0, 0.25), 0 1px 2px -1px rgba(0, 0, 0, 0.2)",
        card: "0 4px 16px -2px rgba(0, 0, 0, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.2)",
        cardHover: "0 10px 25px -4px rgba(0, 0, 0, 0.45), 0 4px 10px -2px rgba(0, 0, 0, 0.3)",
        modal: "0 24px 48px -12px rgba(0, 0, 0, 0.65), 0 12px 24px -8px rgba(0, 0, 0, 0.4)",
        glowBlue: "0 0 20px -3px rgba(57, 120, 246, 0.35)",
        glowGreen: "0 0 20px -3px rgba(32, 180, 134, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
