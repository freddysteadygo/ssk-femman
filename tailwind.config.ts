import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Södertälje SK — ljust tema i klubbens blå/gula färger
        ssk: {
          gold: "#f7d13c", // sidbakgrund (SSK-gul)
          goldSoft: "#fbe7a0", // mjukare gul (hover/sektioner)
          cream: "#fffdf7", // kort/paneler
          navy: "#122a6b", // header/footer
          ink: "#16213e", // text
          muted: "#5c6373", // sekundär text
          line: "#e6d489", // kanter
          blue: "#1b3fb0", // primär accent (knappar/länkar/vald)
          blueDark: "#152f86",
          yellow: "#ffd21e", // highlight

          // Legacy-namn så äldre klasser mappar mot nya temat:
          black: "#122a6b", // → navy (mörka chips/avatar på ljus botten)
          dark: "#122a6b", // → navy (header/footer)
          card: "#fffdf7", // → cream
          line2: "#e6d489",
          orange: "#1b3fb0", // → blå accent
          orangeDark: "#152f86",
        },
      },
    },
  },
  plugins: [],
};

export default config;
