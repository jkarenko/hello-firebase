const { nextui } = require("@nextui-org/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    nextui({
      themes: {
        light: {
          layout: {
            spacingUnit: 4, // 4px
            disabledOpacity: 0.5,
            radius: {
              small: "0.25rem",
              medium: "0.5rem",
              large: "0.75rem",
            },
          },
          colors: {
            // Semantic tokens
            background: {
              DEFAULT: "#ffffff",
              100: "#f3f4f6",
              200: "#e5e7eb",
            },
            foreground: {
              DEFAULT: "#11181C",
              50: "#687076",
              100: "#11181C",
            },
            divider: {
              DEFAULT: "#e5e7eb",
            },
            danger: {
              DEFAULT: "#dc2626",
              50: "#fef2f2",
              foreground: "#ffffff",
            },
            success: {
              DEFAULT: "#16a34a",
              50: "#f0fdf4",
              foreground: "#ffffff",
            },
            primary: {
              50: "#F0F1FE",
              100: "#E1E3FD",
              200: "#C4C7FB",
              300: "#A6ABF9",
              400: "#898FF7",
              500: "#6366f1",
              600: "#4f46e5",
              700: "#372D9C",
              800: "#2B236F",
              900: "#1F1941",
              DEFAULT: "#6366f1",
              foreground: "#ffffff",
            },
            focus: {
              DEFAULT: "#6366f1",
            },
          },
        },
        dark: {
          layout: {
            spacingUnit: 4,
            disabledOpacity: 0.5,
            radius: {
              small: "0.25rem",
              medium: "0.5rem",
              large: "0.75rem",
            },
          },
          colors: {
            background: {
              DEFAULT: "#27272a",
              100: "#18181b",
              200: "#09090b",
            },
            foreground: {
              DEFAULT: "#ECEDEE",
              50: "#9BA1A6",
              100: "#ECEDEE",
            },
            divider: {
              DEFAULT: "#27272a",
            },
            danger: {
              DEFAULT: "#dc2626",
              50: "#450a0a",
              foreground: "#ffffff",
            },
            success: {
              DEFAULT: "#16a34a",
              50: "#052e16",
              foreground: "#ffffff",
            },
            primary: {
              50: "#1F1941",
              100: "#2B236F",
              200: "#372D9C",
              300: "#4338CA",
              400: "#4f46e5",
              500: "#6366f1",
              600: "#898FF7",
              700: "#A6ABF9",
              800: "#C4C7FB",
              900: "#E1E3FD",
              DEFAULT: "#6366f1",
              foreground: "#ffffff",
            },
            focus: {
              DEFAULT: "#6366f1",
            },
          },
        },
      },
      layout: {
        // Base layout tokens
        fontSize: {
          tiny: "0.75rem",
          small: "0.875rem",
          medium: "1rem",
          large: "1.125rem",
        },
        lineHeight: {
          tiny: "1rem",
          small: "1.25rem",
          medium: "1.5rem",
          large: "1.75rem",
        },
      },
    }),
  ],
};
