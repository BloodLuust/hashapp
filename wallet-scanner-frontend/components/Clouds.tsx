import type { CSSProperties } from 'react'
import styles from './Clouds.module.scss'

type Props = { count?: number }

export default function Clouds({ count = 6 }: Props) {
  const items = Array.from({ length: count }, (_, i) => {
    let seed = (i + 7) * 1337 + 42
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff)

    const y = Math.round(10 + rnd() * 70) // 10%..80%
    const delay = (rnd() * 20).toFixed(2) + 's'
    const dur = (50 + rnd() * 40).toFixed(2) + 's'
    const w = Math.round(200 + rnd() * 240)
    const h = Math.round(90 + rnd() * 100)

    return {
      i,
      style: {
        ['--y' as any]: y + '%',
        ['--delay' as any]: delay,
        ['--dur' as any]: dur,
        ['--w' as any]: w + 'px',
        ['--h' as any]: h + 'px',
      } as CSSProperties,
    }
  })

  return (
    <div className={styles.clouds} aria-hidden>
      {items.map(d => <span key={d.i} className={styles.cloud} style={d.style} />)}
    </div>
  )
}

