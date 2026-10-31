import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArchonMark } from './Substrate'
import { Wrap } from './primitives'
import { useAuthStore } from '../../stores/authStore'

/**
 * The maker's plate.
 *
 * Design decisions, all of them deliberate:
 *
 *  • The ground is PAPER, not void. The page ends on the material it began on,
 *    so the footer reads as the bottom of the same sheet rather than a slab
 *    bolted underneath it.
 *  • The wordmark is SOLID INK, enormous, and clipped at the baseline by the
 *    footer's own overflow. It reads as stamped into the sheet.
 *  • It is sized to its ink. "ARCHON" in Instrument Sans 600 at -.05em has
 *    letter widths summing to 3.9350 × font-size, so the six letters exactly
 *    fill the gutters with no flex spreading. That measurement is the reason
 *    the previous version looked detached.
 *  • Each letter is a hover target wired to a capability from the product.
 *  • The canvas behind is a measurement field, not a dot grid: nodes sit on a
 *    jittered lattice and the pointer lights nearby ones and draws measuring
 *    ticks between them.
 */

const LINK_GROUPS = [
  {
    heading: 'Product',
    links: [
      { label: 'Analyze a repo', to: '/dashboard' },
      { label: 'Overview', to: '/dashboard' },
      { label: 'File explorer', to: '/dashboard' },
      { label: 'Architecture', to: '/dashboard' },
      { label: 'Impact analysis', to: '/dashboard' },
    ],
  },
  {
    heading: 'Method',
    links: [
      { label: 'The four stages', to: '/#method' },
      { label: 'Evidence & refusal', to: '/#evidence' },
      { label: 'Engine internals', to: '/#engine' },
      { label: 'Known limits', to: '/#limits' },
      { label: 'Questions', to: '/#faq' },
    ],
  },
  {
    heading: 'Developers',
    links: [
      { label: 'Documentation', to: '/docs', tag: 'NEW' },
      { label: 'Quickstart', to: '/docs' },
      { label: 'API reference', to: '/docs' },
      { label: 'Self-hosting', to: '/docs' },
      { label: 'Limits & plans', to: '/pricing' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Why Archon', to: '/#thesis' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Privacy', to: '/pricing' },
      { label: 'Terms', to: '/pricing' },
      { label: 'Status', to: '/#limits' },
    ],
  },
]

/** Each letter of the wordmark, with the capability it reveals on hover. */
const LETTERS: { letter: string; value: string }[] = [
  { letter: 'A', value: 'AST parse · 1.3s / 400 files' },
  { letter: 'R', value: 'Reverse graph · 0 unresolved' },
  { letter: 'C', value: 'Citation · file + line' },
  { letter: 'H', value: 'Hop count · depth 5' },
  { letter: 'O', value: 'Only proven answers ship' },
  { letter: 'N', value: 'No guess on ambiguity' },
]

/**
 * The constellation. A deterministic, pointer-reacting measurement field.
 *
 * Drawn on a jittered lattice so it reads as an instrument graticule rather
 * than a halftone. Proximity to the cursor eases each node's `near` value,
 * which drives node radius, edge brightness and the ruler ticks. A seeded LCG
 * keeps the layout identical across reloads and resizes.
 */
function FooterField() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let W = 0
    let H = 0
    let raf = 0
    let t = 0
    type Node = { x: number; y: number; r: number; kind: 'dim' | 'mint' | 'sig'; ph: number; near: number }
    let nodes: Node[] = []
    const mouse = { x: -1e4, y: -1e4, on: false }

    const rnd = (seed: number) => () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    const build = () => {
      const r = rnd(20261023)
      nodes = []
      const gap = 40
      const cols = Math.ceil(W / gap) + 2
      const rows = Math.ceil(H / gap) + 2
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (r() > 0.66) continue
          const kindRoll = r()
          nodes.push({
            x: x * gap + (r() - 0.5) * 15,
            y: y * gap + (r() - 0.5) * 15,
            r: kindRoll > 0.965 ? 2.4 : kindRoll > 0.86 ? 1.5 : 1.0,
            kind: kindRoll > 0.965 ? 'sig' : kindRoll > 0.86 ? 'mint' : 'dim',
            ph: r() * Math.PI * 2,
            near: 0,
          })
        }
      }
    }

    const size = () => {
      const rect = canvas.getBoundingClientRect()
      // Tolerate being called before layout has settled.
      if (rect.width < 2 || rect.height < 2) return
      W = rect.width
      H = rect.height
      canvas.width = Math.max(1, W * dpr)
      canvas.height = Math.max(1, H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()
    }

    const COL = {
      dim: [21, 22, 26] as const,
      mint: [13, 107, 79] as const,
      sig: [226, 70, 47] as const,
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      t += 0.008
      const yOf = (n: Node) => n.y + (reduce ? 0 : Math.sin(t + n.ph) * 1.6)

      for (const n of nodes) {
        const dx = n.x - mouse.x
        const dy = yOf(n) - mouse.y
        const d = Math.sqrt(dx * dx + dy * dy)
        const target = mouse.on && d < 210 ? 1 - d / 210 : 0
        n.near += (target - n.near) * 0.16
      }

      // lattice edges, brighter near the pointer
      ctx.lineWidth = 0.7
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        const ay = yOf(a)
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d2 = dx * dx + dy * dy
          if (d2 > 2401) continue
          const falloff = 1 - Math.sqrt(d2) / 49
          const alpha = falloff * 0.22 + Math.max(a.near, b.near) * 0.55 * falloff
          if (alpha < 0.012) continue
          ctx.strokeStyle =
            Math.max(a.near, b.near) > 0.12
              ? `rgba(13,107,79,${alpha.toFixed(3)})`
              : `rgba(21,22,26,${alpha.toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(a.x, ay)
          ctx.lineTo(b.x, yOf(b))
          ctx.stroke()
        }
      }

      // ruler ticks radiating from the pointer — the "measuring" gesture
      if (mouse.on) {
        ctx.lineWidth = 0.8
        for (const n of nodes) {
          if (n.near < 0.22) continue
          const ny = yOf(n)
          const ang = Math.atan2(ny - mouse.y, n.x - mouse.x)
          const len = 9 + n.near * 5
          ctx.strokeStyle = `rgba(13,107,79,${(n.near * 0.5).toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(n.x + Math.cos(ang) * 4, ny + Math.sin(ang) * 4)
          ctx.lineTo(n.x - Math.cos(ang) * len, ny - Math.sin(ang) * len)
          ctx.stroke()
        }
      }

      for (const n of nodes) {
        const ny = yOf(n)
        const c = COL[n.kind]
        const rr = n.r + n.near * 2.2
        const al = (n.kind === 'dim' ? 0.42 : 0.85) + n.near * 0.15
        ctx.beginPath()
        ctx.arc(n.x, ny, rr, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`
        ctx.fill()

        if (n.near > 0.3 && n.kind !== 'dim') {
          ctx.beginPath()
          ctx.arc(n.x, ny, rr + 4.5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(n.near * 0.42).toFixed(3)})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    const loop = () => {
      draw()
      raf = requestAnimationFrame(loop)
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.on = true
    }
    const onLeave = () => {
      mouse.on = false
      mouse.x = -1e4
      mouse.y = -1e4
    }

    // The canvas is pointer-events-none so it never intercepts clicks on the
    // links. Bind to the document instead, translating the canvas coordinate
    // space from its own bounding rect — a pointer anywhere over the page then
    // drives the field.
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null
    ro?.observe(canvas)
    size()
    window.addEventListener('resize', size)
    if (reduce) draw()
    else loop()

    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', size)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      aria-hidden="true"
    />
  )
}

export default function SiteFooter() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-rule-strong bg-gradient-to-b from-paper-3 via-paper-2 to-paper-3 text-ink">
      {/* a single bright edge: the plate has a light source */}
      <div className="absolute inset-x-0 top-0 h-[1.5px] bg-[linear-gradient(90deg,transparent,#0d6b4f_22%,#25d0a0_50%,#0d6b4f_78%,transparent)] opacity-60" aria-hidden="true" />

      <FooterField />

      <Wrap className="relative z-[3] pt-14">
        <div className="grid grid-cols-2 gap-7 md:grid-cols-3 md:gap-9 lg:grid-cols-5 lg:gap-11">
          <div className="col-span-2 lg:col-span-1">
            <Link to="/" className="mb-4 flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.025em] text-ink">
              <ArchonMark size={23} className="text-emerald" />
              Archon
            </Link>
            <p className="mb-5 max-w-[31ch] text-[13px] leading-[1.66] text-ink-2">
              Codebase intelligence that cites its sources, or declines to answer.
            </p>
            <div className="mb-1.5 flex gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
              STRUCTURAL ENGINE <b className="font-medium text-ink">deterministic</b>
            </div>
            <div className="mb-1.5 font-mono text-[9px] uppercase leading-[1.7] tracking-[0.14em] text-ink-3">
              RETRIEVAL <b className="font-medium text-ink">voyage-code-4 · 512-dim</b>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
              STORE <b className="font-medium text-ink">postgres + pgvector</b>
            </div>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <div className="mb-4 font-mono text-[9px] uppercase tracking-[0.19em] text-ink-3">
                {group.heading}
              </div>
              {group.links.map((link) => (
                <Link
                  key={`${group.heading}-${link.label}`}
                  to={link.to}
                  className="group flex items-center gap-2 py-[5px] text-[13.5px] text-ink-2 transition-colors hover:text-ink"
                >
                  <span className="h-px w-0 flex-none bg-emerald transition-all duration-200 group-hover:w-3" />
                  {link.label}
                  {link.tag && (
                    <span className="rounded-[2px] border border-emerald/35 px-1 py-px font-mono text-[8px] tracking-[0.12em] text-emerald">
                      {link.tag}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* legal row sits ABOVE the wordmark, so the wordmark is the last
            element and can be cut by the footer's own bottom edge */}
        <div className="relative z-[3] mt-11 flex flex-wrap items-center justify-between gap-5 border-t border-rule-strong pt-4">
          <div className="font-mono text-[9.5px] tracking-[0.11em] text-ink-3">
            © 2026 ARCHON · CODEBASE INTELLIGENCE
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <span className="flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.11em] text-ink-2">
              <i className="block h-[5px] w-[5px] animate-pulse-dot rounded-full bg-emerald" />
              All systems nominal
            </span>
            <Link to="/#limits" className="font-mono text-[9.5px] tracking-[0.11em] text-ink-3 transition-colors hover:text-ink">
              Limits
            </Link>
            <Link to="/#faq" className="font-mono text-[9.5px] tracking-[0.11em] text-ink-3 transition-colors hover:text-ink">
              FAQ
            </Link>
            {/* Reflects the session, like the header: an authenticated visitor
                is offered their account, not another sign-in. */}
            {isAuthenticated ? (
              <Link to="/history" className="font-mono text-[9.5px] tracking-[0.11em] text-ink-3 transition-colors hover:text-ink">
                Your repositories
              </Link>
            ) : (
              <Link to="/auth" className="font-mono text-[9.5px] tracking-[0.11em] text-ink-3 transition-colors hover:text-ink">
                Sign in
              </Link>
            )}
          </div>
        </div>

        {/* the wordmark: last element, clipped by the footer edge */}
        <div className="relative mt-7 border-t border-rule-strong pt-5">
          <div className="absolute left-0 top-3.5 z-[4] flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.17em] text-ink-3 max-md:hidden">
            <i className="block h-[5px] w-[5px] rounded-full bg-emerald shadow-[0_0_0_3px_rgba(13,107,79,.15)]" />
            Trace a letter
          </div>
          <div className="foot-mark" role="list" aria-label="Archon">
            {LETTERS.map(({ letter, value }) => (
              <span
                key={letter}
                role="listitem"
                tabIndex={0}
                className="group relative block cursor-default transition-[transform,color] duration-300 hover:text-forest"
              >
                {letter}
                <span className="pointer-events-none absolute bottom-full left-0 mb-2.5 flex translate-y-[5px] items-baseline gap-2.5 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.13em] text-emerald opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  <b className="font-medium tracking-[0.13em] text-ink">{letter}</b>
                  <span className="font-medium normal-case tracking-[0.02em] text-ink">{value}</span>
                </span>
                <span className="absolute bottom-[-2px] left-1/2 h-0 w-px bg-emerald transition-[height] duration-300 group-hover:h-6" />
              </span>
            ))}
          </div>
        </div>
      </Wrap>
    </footer>
  )
}
