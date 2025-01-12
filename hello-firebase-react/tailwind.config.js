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
              DEFAULT: "#ffffff",
              100: "#f3f4f6",
              200: "#e8e8e8",
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
              50: "#e6f8fb",
              100: "#ccf1f7",
              200: "#99e3ef",
              300: "#66d5e7",
              400: "#33c7df",
              500: "#09b6d1",
              600: "#0892a7",
              700: "#066d7d",
              800: "#044954",
              900: "#02242a",
              DEFAULT: "#09b6d1",
              foreground: "#ffffff",
            },
            focus: {
              DEFAULT: "#09b6d1",
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
              200: "#18181b",
              100: "#27272a",
              DEFAULT: "#333338",
            },
            foreground: {
              DEFAULT: "#ECEDEE",
              50: "#9BA1A6",
              100: "#ECEDEE",
            },
            divider: {
              DEFAULT: "#333338",
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
              900: "#e6f8fb",
              800: "#ccf1f7",
              700: "#99e3ef",
              600: "#66d5e7",
              500: "#33c7df",
              400: "#09b6d1",
              300: "#0892a7",
              200: "#066d7d",
              100: "#044954",
              50: "#02242a",
              DEFAULT: "#09b6d1",
              foreground: "#ffffff",
            },
            focus: {
              DEFAULT: "#09b6d1",
            },
          },
        },
      },
      layout: {
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
