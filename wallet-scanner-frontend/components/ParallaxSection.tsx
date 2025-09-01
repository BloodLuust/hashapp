import dynamic from 'next/dynamic'
import { useMemo } from 'react'

const Parallax = dynamic(() => import('react-scroll-parallax').then(m => m.Parallax), { ssr: false })

export default function ParallaxSection() {
  const layers = useMemo(
    () => [
      { speed: -20, size: 220, color: 'bg-brand/20', x: 'left-6', y: 'top-4', blur: 'blur-[2px]' },
      { speed: -10, size: 140, color: 'bg-brand/30', x: 'right-10', y: 'top-20', blur: 'blur-[1px]' },
      { speed: -30, size: 180, color: 'bg-brand/10', x: 'left-1/3', y: 'bottom-10', blur: 'blur-[3px]' },
    ],
    []
  )

  return (
    <section id="learn-more" className="relative py-24">
      <div className="container mx-auto px-6">
        <h2 className="text-2xl font-bold">Smooth parallax visuals</h2>
        <p className="mt-3 max-w-2xl text-gray-600">
          Enhance the experience with subtle motion. This section uses a popular open‑source parallax library and is safe on SSR with dynamic imports.
        </p>
      </div>
      <div className="pointer-events-none relative h-72">
        {layers.map((l, i) => (
          <Parallax key={i} speed={l.speed}>
            <div
              className={`absolute ${l.x} ${l.y} ${l.color} ${l.blur}`}
              style={{ width: l.size, height: l.size, borderRadius: l.size / 3 }}
            />
          </Parallax>
        ))}
      </div>
    </section>
  )
}

