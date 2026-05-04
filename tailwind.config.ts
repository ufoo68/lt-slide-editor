import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#161616",
        paper: "#f7f5ef",
        line: "#d8d4ca",
        mint: "#2f7d6d",
        coral: "#ca5c46",
        steel: "#3f5f7f"
      },
      boxShadow: {
        panel: "0 10px 28px rgba(22, 22, 22, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
