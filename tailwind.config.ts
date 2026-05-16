import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
      colors: {
        axiel: {
          // Core — Organic Minimal Quiet Luxury
          primary:     "#0F1A2E",
          green:       "#0F6E56",
          greenDark:   "#085041",
          greenLight:  "#E1F5EE",
          greenBorder: "#9FE1CB",
          greenSoft:   "#F0FAF6",
          sidebar:     "#F4F3EF",
          background:  "#FAFAF8",
          surface:     "#FFFFFF",
          amber:       "#FAEEDA",
          amberText:   "#633806",
          text: {
            primary:   "#0F1A2E",
            secondary: "#6B6A66",
            muted:     "#A09E98",
          },

          // Backward-compatible aliases
          secondary:  "#0F6E56",
          ink:        "#0F1A2E",
          soft:       "#FAFAF8",
          line:       "#E8E6E2",
          blue:       "#0F1A2E",
          blueDark:   "#071529",
          blueSoft:   "#F0FAF6",
          gold:       "#0F6E56",

          state: {
            success: "#0F6E56",
            warning: "#F2C94C",
            error:   "#EB5757",
          },
        },
      },
      backgroundImage: {
        "axiel-calm": "linear-gradient(135deg, #F0FAF6, #FAFAF8)",
      },
      boxShadow: {
        soft: "0 24px 80px rgba(11, 31, 58, 0.08)",
        "axiel-button": "0 12px 28px rgba(11, 31, 58, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
