import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", ".night"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        card: "var(--card)",
        mega: "var(--mega)",
        teal: "var(--teal)",
        lav: "var(--lav)",
        sticker: "var(--sticker)",
      },
      maxWidth: {
        zine: "1080px",
      },
      boxShadow: {
        zine: "4px 4px 0 var(--shadow)",
        "zine-sm": "3px 3px 0 var(--shadow)",
        "zine-press": "1px 1px 0 var(--shadow)",
      },
    },
  },
  plugins: [],
};

export default config;
