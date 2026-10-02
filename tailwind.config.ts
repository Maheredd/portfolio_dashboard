import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#0d1320", panel: "#141c2e", raise: "#1b2540", line: "#26324d", mute: "#8b97b3",
                gain: "#2bd48a", loss: "#ff5c6c", amber: "#f5b544" },
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
