/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cinzel"', 'serif'],
      },
      keyframes: {
        "enter-from-right": { from: { transform: "translateX(200px)", opacity: 0 }, to: { transform: "translateX(0)", opacity: 1 } },
        "enter-from-left": { from: { transform: "translateX(-200px)", opacity: 0 }, to: { transform: "translateX(0)", opacity: 1 } },
        "exit-to-right": { from: { transform: "translateX(0)", opacity: 1 }, to: { transform: "translateX(200px)", opacity: 0 } },
        "exit-to-left": { from: { transform: "translateX(0)", opacity: 1 }, to: { transform: "translateX(-200px)", opacity: 0 } },
        "scale-in": { from: { transform: "scale(0.96)", opacity: 0 }, to: { transform: "scale(1)", opacity: 1 } },
        "scale-out": { from: { transform: "scale(1)", opacity: 1 }, to: { transform: "scale(0.96)", opacity: 0 } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "fade-out": { from: { opacity: 1 }, to: { opacity: 0 } },
      },
      animation: {
        "enter-from-right": "enter-from-right 0.15s ease",
        "enter-from-left": "enter-from-left 0.15s ease",
        "exit-to-right": "exit-to-right 0.15s ease",
        "exit-to-left": "exit-to-left 0.15s ease",
        "scale-in": "scale-in 0.12s ease-out",
        "scale-out": "scale-out 0.12s ease-in",
        "fade-in": "fade-in 0.12s ease",
        "fade-out": "fade-out 0.12s ease",
      },
    },
  },
  plugins: [],
}

