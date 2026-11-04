import { useEffect, useRef } from 'react'

const COLORS = ['#ff5e7e', '#ffd23f', '#3ec1d3', '#7b6cf6', '#4ade80', '#ff8a3d']
const GRAVITY = 0.3
const DRAG = 0.985
const DURATION = 4500
const FADE = 1000

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  angle: number
  spin: number
  /** фаза переворота: прямоугольник сжимается по высоте, как вращающийся листок */
  flip: number
  flipSpeed: number
  color: string
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

// Залп конфетти из нижних углов экрана к центру. Новый залп — новый key у компонента.
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dpr = window.devicePixelRatio || 1
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const perSide = Math.min(150, Math.round(width / 5))
    const particles: Particle[] = []
    for (const side of [1, -1])
      for (let i = 0; i < perSide; i++) {
        const angle = rand(50, 80) * (Math.PI / 180)
        // Скорость, с которой частица долетает до 50–110% высоты экрана.
        const speed = Math.sqrt(2 * GRAVITY * height * rand(0.5, 1.1)) * 1.15
        const size = rand(6, 11)
        particles.push({
          x: side === 1 ? 0 : width,
          y: height,
          vx: side * Math.cos(angle) * speed,
          vy: -Math.sin(angle) * speed,
          w: size,
          h: size * rand(0.4, 0.7),
          angle: rand(0, Math.PI * 2),
          spin: rand(-0.2, 0.2),
          flip: rand(0, Math.PI * 2),
          flipSpeed: rand(0.05, 0.15),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        })
      }

    const start = performance.now()
    let last = start
    let frame = requestAnimationFrame(function draw(now) {
      // Шаг в кадрах по 60 Гц: на экранах 120 Гц скорость та же.
      const dt = Math.min((now - last) / (1000 / 60), 3)
      last = now
      const elapsed = now - start
      ctx.clearRect(0, 0, width, height)
      ctx.globalAlpha = Math.min(1, (DURATION - elapsed) / FADE)
      let visible = 0
      for (const p of particles) {
        p.vx *= DRAG ** dt
        p.vy = p.vy * DRAG ** dt + GRAVITY * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.angle += p.spin * dt
        p.flip += p.flipSpeed * dt
        if (p.y > height + 20) continue
        visible++
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.scale(1, Math.cos(p.flip))
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      if (visible && elapsed < DURATION) frame = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, width, height)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} className="confetti" aria-hidden="true" />
}
