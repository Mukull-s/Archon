import React, { useRef, useEffect } from 'react'

interface GridScanProps {
  lineColor?: string
  scanColor?: string
  dotColor?: string
  bgColor?: string
  scanSpeed?: number
  gridSpacing?: number
}

export default function GridScan({
  lineColor = 'rgba(124, 58, 237, 0.25)',
  scanColor = 'rgba(6, 182, 212, 0.6)',
  dotColor = 'rgba(124, 58, 237, 0.5)',
  bgColor = 'transparent',
  scanSpeed = 1.5,
  gridSpacing = 60,
}: GridScanProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, W, H)
      }

      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      for (let y = 0; y < H; y += gridSpacing) {
        const fade = Math.sin((y / H) * Math.PI) * 0.7 + 0.3
        ctx.globalAlpha = fade
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      for (let x = 0; x < W; x += gridSpacing) {
        const fade = Math.sin((x / W) * Math.PI) * 0.7 + 0.3
        ctx.globalAlpha = fade * 0.6
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      for (let x = 0; x < W; x += gridSpacing) {
        for (let y = 0; y < H; y += gridSpacing) {
          const distFromCenter = Math.hypot(x - W / 2, y - H / 2)
          const maxDist = Math.hypot(W / 2, H / 2)
          const pulse = Math.sin(timeRef.current * 1.5 + distFromCenter * 0.02) * 0.3 + 0.7
          const alpha = (1 - distFromCenter / maxDist) * 0.6 * pulse

          ctx.globalAlpha = alpha
          ctx.fillStyle = dotColor
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const scanY = ((timeRef.current * scanSpeed * 40) % (H + 80)) - 40
      const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30)
      scanGrad.addColorStop(0, 'transparent')
      scanGrad.addColorStop(0.4, scanColor.replace('0.6', '0.1'))
      scanGrad.addColorStop(0.5, scanColor)
      scanGrad.addColorStop(0.6, scanColor.replace('0.6', '0.1'))
      scanGrad.addColorStop(1, 'transparent')

      ctx.globalAlpha = 1
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, scanY - 30, W, 60)

      ctx.strokeStyle = scanColor.replace('0.6', '0.9')
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.moveTo(0, scanY)
      ctx.lineTo(W, scanY)
      ctx.stroke()

      timeRef.current += 0.016
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [lineColor, scanColor, dotColor, bgColor, scanSpeed, gridSpacing])

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      display: 'block', pointerEvents: 'none',
    }} />
  )
}
