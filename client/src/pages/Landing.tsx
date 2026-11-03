import { useEffect } from 'react'
import { Substrate } from '../components/site/Substrate'
import { SiteHeader } from '../components/site/SiteHeader'
import { Hero } from '../components/site/SiteHero'
import {
  TrustStrip,
  Thesis,
  Method,
  Capabilities,
} from '../components/site/SiteSections'
import { Evidence, Engine, Limits, FAQ, FinalCTA } from '../components/site/SiteSectionsB'
import SiteFooter from '../components/site/SiteFooter'

/**
 * The marketing landing page.
 *
 * Assembled entirely from the `site/` components. There is no inline styling
 * and no bespoke CSS on this page: every element is Tailwind utilities, with
 * the only exceptions being the substrate layers and the footer wordmark,
 * both of which live in index.css because they cannot be expressed as classes.
 *
 * The document is already paper (see `body` in index.css), so this page no
 * longer toggles a class to get there — it only installs the reveal observer.
 */
export default function Landing() {
  useEffect(() => {
    // Reveal-on-scroll. Transform-only: if the observer never fires, content is
    // still visible, so a deep link or a stalled observer can never blank the
    // page. A hard timeout promotes everything after 1.2s regardless.
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    let io: IntersectionObserver | undefined

    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in')
              io?.unobserve(entry.target)
            }
          }
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
      )
      els.forEach((el) => io?.observe(el))
    }

    const fallback = window.setTimeout(() => {
      els.forEach((el) => el.classList.add('is-in'))
    }, 1200)

    return () => {
      window.clearTimeout(fallback)
      io?.disconnect()
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-clip bg-paper text-ink">
      <Substrate />

      <div className="relative z-[1]">
        <SiteHeader />
        <Hero />
        <TrustStrip />
        <Thesis />
        <Method />
        <Capabilities />
        <Evidence />
        <Engine />
        <Limits />
        <FAQ />
        <FinalCTA />
        <SiteFooter />
      </div>
    </div>
  )
}
