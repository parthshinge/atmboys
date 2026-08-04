import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        saffron: {
          50: "#fff8ed",
          100: "#feefd3",
          500: "#f5820a",
          600: "#e6690a",
          700: "#c04f0b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
