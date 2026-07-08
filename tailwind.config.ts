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
        // Jade green palette — #6BD5AC is the standard base; everything derives from it
        jade: {
          DEFAULT: "#6BD5AC",  // base color — standard
          light: "#8FE2C2",    // lighter hover / highlights
          dark: "#4FB890",     // pressed / deeper accents
          900: "#0E2A21",      // near-black green for page background
          800: "#15392C",      // surface / card background
          700: "#1C4938",      // borders, dividers
          400: "#86DEBC",
          300: "#A4E8CE",
        },
      },
      boxShadow: {
        jade: "0 0 32px rgba(107, 213, 172, 0.2), 0 4px 16px rgba(0, 0, 0, 0.35)",
        "jade-sm": "0 0 12px rgba(107, 213, 172, 0.32)",
      },
      backgroundImage: {
        "jade-glow": "radial-gradient(ellipse at top, rgba(107,213,172,0.16) 0%, transparent 60%)",
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
