import forms from "@tailwindcss/forms";

/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08090c",
        graphite: "#101317",
        steel: "#181d23",
        bone: "#ece6dc",
        sand: "#b8ab96",
        ember: "#d8a14c",
        mist: "#9ca7b5",
        line: "rgba(255,255,255,0.08)"
      },
      boxShadow: {
        frame: "0 30px 120px rgba(0, 0, 0, 0.35)"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"]
      }
    }
  },
  plugins: [forms]
};

export default config;
