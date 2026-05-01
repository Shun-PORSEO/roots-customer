import type { Config } from "tailwindcss";

/**
 * Roots Customer — Refined Wedding Companion
 * Tokens are sourced from /DESIGN.md (DESIGN.md alpha spec).
 * Always update DESIGN.md first, then mirror here.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary — Forest Sage
        primary: {
          5: "#F2F7F3",
          10: "#E7F0EA",
          20: "#CFE0D5",
          30: "#A7C5B2",
          50: "#5A8E6E",
          60: "#3F7556",
          70: "#2F5A40",
          80: "#1F3A2A",
          95: "#0F2118",
          DEFAULT: "#2F5A40",
        },
        // Tertiary — Champagne Gold
        tertiary: {
          10: "#FAEFD2",
          20: "#F2DEAB",
          40: "#E2C079",
          50: "#D4A853",
          60: "#B8884E",
          70: "#9A6E2F",
          DEFAULT: "#D4A853",
        },
        // Neutral — Warm Ivory
        neutral: {
          10: "#1A1815",
          20: "#2C2925",
          30: "#4A4540",
          50: "#7A7268",
          60: "#9E9484",
          80: "#DDD3C2",
          90: "#EFE8DC",
          95: "#F5F1EA",
          98: "#FBFAF6",
          100: "#FFFFFF",
        },
        // Semantic
        success: "#2F8A4E",
        warning: "#D88B2C",
        error: "#B5402F",
        info: "#3F6E92",

        // Semantic aliases
        surface: "#FFFFFF",
        "surface-muted": "#F5F1EA",
        "surface-page": "#FBFAF6",
        "on-surface": "#2C2925",
        "on-surface-muted": "#7A7268",
        border: "#EFE8DC",
        "border-strong": "#DDD3C2",
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', "system-ui", "sans-serif"],
        display: ['"Shippori Mincho"', '"Noto Serif JP"', "serif"],
      },
      fontSize: {
        // Body & UI
        "body-sm": ["12px", { lineHeight: "1.55" }],
        "body-md": ["14px", { lineHeight: "1.6" }],
        "body-lg": ["16px", { lineHeight: "1.65" }],
        "label-md": ["13px", { lineHeight: "1.4", fontWeight: "600" }],
        "label-caps": ["10px", { lineHeight: "1", letterSpacing: "0.22em", fontWeight: "700" }],
        "headline-sm": ["15px", { lineHeight: "1.45", fontWeight: "600" }],
        "headline-md": ["17px", { lineHeight: "1.4", fontWeight: "700" }],
        "headline-lg": ["20px", { lineHeight: "1.35", fontWeight: "700" }],
        // Display (Mincho)
        "display-md": ["22px", { lineHeight: "1.3", letterSpacing: "0.02em", fontWeight: "600" }],
        "display-lg": ["28px", { lineHeight: "1.25", letterSpacing: "0.02em", fontWeight: "600" }],
        "numeric-display": ["40px", { lineHeight: "1", fontWeight: "600" }],
      },
      spacing: {
        "3xs": "2px",
        "2xs": "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
        "4xl": "64px",
      },
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,24,21,0.04), 0 4px 12px rgba(26,24,21,0.04)",
        "card-hover": "0 2px 4px rgba(26,24,21,0.06), 0 8px 20px rgba(26,24,21,0.06)",
        modal: "0 8px 24px rgba(26,24,21,0.10)",
        focus: "0 0 0 3px rgba(167,197,178,0.55)",
      },
      maxWidth: {
        liff: "440px",
      },
      transitionDuration: {
        micro: "100ms",
        short: "200ms",
        medium: "320ms",
      },
    },
  },
  plugins: [],
};
export default config;