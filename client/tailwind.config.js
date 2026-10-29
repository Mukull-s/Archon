/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /* ══ PLATE & PAPER ══════════════════════════════════════════════════
         The marketing-site palette. Namespaced under `paper`, `plate`, `ink`,
         and `sig` so it can never collide with the dark application palette
         (`surface`, `accent`, `status`) that the dashboard still uses.

         The rule of the system: the page is a sheet of instrument paper; the
         product is a plate printed onto it. Colour is a measurement — emerald
         for what is proven, signal red for what is refused. Nothing glows.
         ═════════════════════════════════════════════════════════════════ */
      colors: {
        paper: {
          DEFAULT: '#f4f1e9',   // the sheet
          2: '#faf8f2',         // raised card on the sheet
          3: '#ece7db',         // recessed band
        },
        plate: {
          DEFAULT: '#17181c',   // the printed product surface
          2: '#1e2026',
          3: '#25282f',
        },
        rule: {
          DEFAULT: '#d8d3c5',   // hairline
          2: '#e5e0d3',
          strong: '#c2bcab',    // the heavier structural rule
        },
        ink: {
          DEFAULT: '#15161a',   // primary text
          2: '#4a4b52',         // body
          3: '#81806f',         // muted / mono annotations
        },
        forest: '#12362d',
        emerald: '#0d6b4f',
        mint: '#25d0a0',
        sig: '#e2462f',         // signal red — refusal, risk
        amber: '#b87a12',
      },

      fontFamily: {
        /* the marketing type system */
        sans: ["'Instrument Sans'", "system-ui", "'Segoe UI'", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Consolas", "monospace"],
        /* kept for the dashboard */
        heading: ["'Instrument Sans'", "system-ui", "sans-serif"],
        body: ["'Instrument Sans'", "system-ui", "sans-serif"],
      },

      /* the editorial scale used on the landing page */
      fontSize: {
        'display': ['74px', { lineHeight: '0.96', letterSpacing: '-0.042em' }],
        'display-lg': ['46px', { lineHeight: '1.06', letterSpacing: '-0.036em' }],
        'sec': ['42px', { lineHeight: '1.06', letterSpacing: '-0.038em' }],
        'eyebrow': ['9.5px', { lineHeight: '1', letterSpacing: '0.19em' }],
        'mono-note': ['8.5px', { lineHeight: '1.5', letterSpacing: '0.16em' }],
        'mono-micro': ['7.5px', { lineHeight: '1.4', letterSpacing: '0.16em' }],
      },

      maxWidth: {
        site: '1328px',
        prose: '58ch',
      },

      borderRadius: {
        /* The system's own radius. Anything not on this scale is written as an
           explicit `rounded-[3px]` at the call site, which is why the legacy
           sm/md/lg/pill overrides — all pointing at now-deleted variables —
           have been removed rather than repointed. */
        plate: '4px',
        DEFAULT: '0.25rem',
        xl: '0.75rem',
      },

      spacing: {
        site: '56px',
        unit: "4px",
        sidebar_width: "240px",
        container_gap: "16px",
        gutter: "12px",
        margin_mobile: "16px",
        margin_desktop: "24px",
      },

      boxShadow: {
        plate: '0 26px 50px -34px rgba(18,54,45,.55), 0 1px 0 rgba(255,255,255,.05) inset',
        dossier: '0 1px 0 rgba(255,255,255,.6) inset, 0 22px 44px -34px rgba(18,54,45,.34)',
        cta: '0 22px 44px -38px rgba(18,54,45,.4)',
      },

      keyframes: {
        /* the registration grid drifts on a very long cycle — alive, not busy */
        subDrift: {
          '0%': { backgroundPosition: '0 0, 0 0, 0 0, 0 0' },
          '100%': { backgroundPosition: '28px 28px, 28px 28px, 140px 140px, 140px 140px' },
        },
        spinMark: {
          to: { transform: 'rotate(360deg)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        dpanelIn: {
          from: { opacity: '0', transform: 'translateY(9px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'sub-drift': 'subDrift 60s linear infinite',
        'spin-mark': 'spinMark 5s linear infinite',
        'pulse-dot': 'pulseDot 2.4s ease-in-out infinite',
        'dpanel-in': 'dpanelIn .42s cubic-bezier(.22,.61,.36,1) both',
      },
    },
  },
  plugins: [],
}
