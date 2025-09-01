import type { CSSProperties } from 'react'
import styles from './Rain.module.scss'

type Props = {
  /** Number of drops to render */
  count?: number
}

export default function Rain({ count = 80 }: Props) {
  // Use deterministic pseudo-random positions so hydration stays consistent.
  // Simple LCG seeded by index.
  const drops = Array.from({ length: count }, (_, i) => {
    let seed = (i + 1) * 9301 + 49297
    seed = (seed % 233280)
    const rnd = (seed: number) => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280)

    const x = Math.round(rnd(seed) * 100) // percentage across the screen
    const delay = (rnd(seed) * 4).toFixed(2) + 's'
    const dur = (4 + rnd(seed) * 4).toFixed(2) + 's'
    const scale = (0.7 + rnd(seed) * 0.8).toFixed(2)

    return {
      i,
      style: {
        ['--x' as any]: x + '%',
        ['--delay' as any]: delay,
        ['--dur' as any]: dur,
        ['--scale' as any]: scale,
      } as CSSProperties,
    }
  })

  return (
    <div className={styles.rain} aria-hidden>
      {drops.map(d => (
        <span key={d.i} className={styles.drop} style={d.style} />
      ))}
    </div>
  )
}

