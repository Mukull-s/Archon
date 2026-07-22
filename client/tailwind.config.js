/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "#131316",
        surface: "#131316",
        "surface-dim": "#131316",
        "surface-bright": "#39393c",
        "surface-container-lowest": "#0e0e11",
        "surface-container-low": "#1b1b1e",
        "surface-container": "#1f1f22",
        "surface-container-high": "#2a2a2d",
        "surface-container-highest": "#353437",
        "on-surface": "#e4e1e5",
        "on-surface-variant": "#c8c5ca",
        outline: "#919095",
        "outline-variant": "#47464a",
        primary: "#c8c6c8",
        "on-primary": "#313032",
        "primary-container": "#09090b",
        "on-primary-container": "#7a787b",
        secondary: "#adc6ff",
        "on-secondary": "#002e6a",
        "secondary-container": "#0566d9",
        "on-secondary-container": "#e6ecff",
        tertiary: "#ddb7ff",
        "tertiary-container": "#120027",
        error: "#ffb4ab",
        "error-container": "#93000a",
      },
      borderRadius: {
        sm: "0.125rem", // 2px
        DEFAULT: "0.25rem", // 4px
        md: "0.375rem", // 6px
        lg: "0.5rem", // 8px
        xl: "0.75rem", // 12px
      },
      spacing: {
        unit: "4px",
        sidebar_width: "240px",
        container_gap: "16px",
        gutter: "12px",
        margin_mobile: "16px",
        margin_desktop: "24px",
      },
      fontFamily: {
        heading: ["Geist", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
