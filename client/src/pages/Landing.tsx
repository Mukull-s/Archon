import React from 'react'
import Navbar from '../components/Navbar'
import CinematicCursor from '../components/CinematicCursor'
import HeroSection from '../components/sections/HeroSection'
import ScrollStorySection from '../components/sections/ScrollStorySection'
import FeaturesSection from '../components/sections/FeaturesSection'
import TechMarquee from '../components/sections/TechMarquee'
import TrustedBySection from '../components/sections/TrustedBySection'
import CTASection from '../components/sections/CTASection'
import Footer from '../components/sections/Footer'

/* Subtle glow separator */
interface GlowDividerProps {
  intensity?: number
}

function GlowDivider({ intensity = 0.1 }: GlowDividerProps) {
  return (
    <div style={{
      height: '1px', margin: '0 auto', maxWidth: '50%',
      background: `linear-gradient(90deg, transparent, rgba(176,38,255,${intensity}), transparent)`,
    }} />
  )
}

export default function Landing() {
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <CinematicCursor />
      <Navbar />
      <HeroSection />
      <ScrollStorySection />
      <GlowDivider />
      <FeaturesSection />
      <TechMarquee />
      <TrustedBySection />
      <GlowDivider intensity={0.06} />
      <CTASection />
      <Footer />
    </div>
  )
}
