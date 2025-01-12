/** @type {import('tailwindcss').Config} */
const { nextui } = require("@nextui-org/react");
const plugin = require('tailwindcss/plugin');

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2563eb', // blue-600
          50: '#eff6ff',     // blue-50
          900: '#1e3a8a'     // blue-900
        }
      }
    },
  },
  darkMode: "class",
  plugins: [
    nextui(),
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.shadow-brand': {
          'text-shadow': '0 0 30px rgba(219,234,254,0.3)'
        }
      })
    })
  ]
}
