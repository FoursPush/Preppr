import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        nvg: {
          orange: "#FF6F39",
          purple: "#7A78FF",
          lime: "#C7FF6A",
          "off-white": "#FCFAEF",
          offwhite: "#FCFAEF",
          "off-black": "#141414",
          offblack: "#141414",
          yellow: "#FFC412",
          green: "#00A653",
          lavender: "#CBCCFE",
          "light-blue": "#BADDFD",
          lightblue: "#BADDFD",
          canvas: "#E8EBFF",
          surface: "#1A1A1C",
          "surface-light": "#F5F3E6",
          border: "#26262A",
        },
        brand: {
          50: "#f5f6ff",
          100: "#ebedff",
          500: "#7A78FF",
          600: "#6360FF",
          700: "#4D4AE6",
          900: "#1E1C59",
        },
        dark: {
          950: "#0C0C0D",
          900: "#141414",
          850: "#1A1A1C",
          800: "#222226",
          700: "#2C2C32",
          600: "#3D3D45",
        },
      },
      fontFamily: {
        heading: [
          '"Neue Montreal"',
          '"PP Neue Montreal"',
          '"Space Grotesk"',
          '"Plus Jakarta Sans"',
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        body: [
          '"Neue Haas Grotesk"',
          '"Neue Haas Grotesk Text"',
          '"Plus Jakarta Sans"',
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
        squircle: "28px",
      },
      boxShadow: {
        neo: "0 8px 30px rgba(0, 0, 0, 0.12)",
        "neo-sm": "0 4px 14px rgba(0, 0, 0, 0.08)",
        "neo-lime": "0 10px 30px -5px rgba(199, 255, 106, 0.35)",
        "neo-orange": "0 10px 30px -5px rgba(255, 111, 57, 0.35)",
        "neo-purple": "0 10px 30px -5px rgba(122, 120, 255, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
