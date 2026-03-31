import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4A7C59",
        secondary: "#F5F0E8",
        accent: "#D4A853",
        "text-main": "#2C2C2C",
        "text-sub": "#7A7A7A",
        error: "#C0392B",
        success: "#27AE60",
        border: "#E0D8CC",
        bg: "#FAFAF7",
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', "sans-serif"],
      },
      maxWidth: {
        app: "440px",
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
