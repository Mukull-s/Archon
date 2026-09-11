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
        // Semantic Token Bridge (Phase 1)
        bg: {
          base: "var(--color-bg-base)",
        },
        surface: {
          DEFAULT: "var(--color-surface-base)",
          base: "var(--color-surface-base)",
          elevated: "var(--color-surface-elevated)",
          subtle: "var(--color-surface-subtle)",
          dim: "#131316",
          bright: "#39393c",
          "container-lowest": "#0e0e11",
          "container-low": "#1b1b1e",
          container: "#1f1f22",
          "container-high": "#2a2a2d",
          "container-highest": "#353437",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          default: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
        },
        status: {
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          error: "var(--color-error)",
          info: "var(--color-info)",
        },

        // Legacy / Stitch / Existing Token Compatibility (Preserved for zero regression)
        background: "#131316",
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
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
        DEFAULT: "0.25rem", // 4px
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
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
