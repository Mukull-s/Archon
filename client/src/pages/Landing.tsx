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
import LightPillar from '../components/backgrounds/LightPillars'

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
    <div id="landing-wrapper" style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: '#050308', overflowX: 'hidden' }}>
      {/* Global 3D WebGL background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <LightPillar
          topColor="#B026FF"
          bottomColor="#D98CFF"
          intensity={1.2}
          rotationSpeed={0.25}
          glowAmount={0.003}
          pillarWidth={3.0}
          pillarHeight={0.4}
          noiseIntensity={0.4}
          pillarRotation={20}
          interactive={true}
          mixBlendMode="screen"
          quality="high"
        />
      </div>

      {/* Global ambient radial background overlay for visual contrast */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 20%, rgba(5,3,8,0.85) 100%)',
      }} />

      {/* Main scrolling content layer */}
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
    </div>
  )
}
