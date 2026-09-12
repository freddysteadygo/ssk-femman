import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Södertälje SK — svartvit/orange profil
        ssk: {
          black: "#111214",
          dark: "#1b1d21",
          card: "#23262b",
          orange: "#f26522",
          orangeDark: "#d4521a",
          line: "#33373d",
          muted: "#9aa1ab",
        },
      },
    },
  },
  plugins: [],
};

export default config;
