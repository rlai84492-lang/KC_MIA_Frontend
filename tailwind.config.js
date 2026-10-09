/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "'Helvetica Neue'", "Arial", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"]
      },
      colors: {
        // Reference "Mia CRM" theme tokens
        kc: {
          bg: "#FAF6F0",
          panel2: "#F7EFEA",
          ink: "#2B1A21",
          ink2: "#6E5B63",
          ink3: "#A3929A",
          line: "#F1E2E2",
          accentSoft: "#F7DFE6",
          goldSoft: "#F4E8D2",
          side: "#FBF7F2",
          deep: "#3E0F20",
          rose: "#B8336A"
        },
        mia: {
          50: "#fbf5f6",
          100: "#f6e8eb",
          200: "#edcfd6",
          300: "#dfaab8",
          400: "#c77b90",
          500: "#a94d69",
          600: "#8b3150",
          700: "#7a1f3d",
          800: "#641b34",
          900: "#52182d"
        },
        gold: {
          400: "#d9b76c",
          500: "#c9a15a",
          600: "#aa823f"
        }
      }
    }
  },
  plugins: []
};