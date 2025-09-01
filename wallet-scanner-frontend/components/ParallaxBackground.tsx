import dynamic from 'next/dynamic'

const Parallax = dynamic(() => import('react-scroll-parallax').then(m => m.Parallax), { ssr: false })
const Rain = dynamic(() => import('./Rain'), { ssr: false })
const Stars = dynamic(() => import('./Stars'), { ssr: false })
const Clouds = dynamic(() => import('./Clouds'), { ssr: false })

export default function ParallaxBackground() {
  const layers = [
    { speed: -20, size: 360, color: 'bg-brand/20', x: 'left-10', y: 'top-8', blur: 'blur-[2px]' },
    { speed: -12, size: 240, color: 'bg-brand/30', x: 'right-14', y: 'top-24', blur: 'blur-[1px]' },
    { speed: -28, size: 300, color: 'bg-brand/10', x: 'left-1/3', y: 'bottom-16', blur: 'blur-[3px]' },
  ] as const

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Base gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-100 dark:from-midnight to-midnight2" />
      {/* Radial highlight at the top */}
      <div className="absolute inset-0 bg-radial-faded" />

      {/* Rain overlay: down in light, up in dark */}
      <Rain />

      {/* Stars in night mode, clouds in day mode */}
      <div className="hidden dark:block">
        <Stars />
      </div>
      <div className="block dark:hidden">
        <Clouds />
      </div>

      {/* Floating blobs that move at different speeds */}
      {layers.map((l, i) => (
        <Parallax key={i} speed={l.speed}>
          <div
            className={`absolute ${l.x} ${l.y} ${l.color} ${l.blur}`}
            style={{ width: l.size, height: l.size, borderRadius: l.size / 2 }}
          />
        </Parallax>
      ))}
    </div>
  )
}
