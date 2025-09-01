import type { CSSProperties } from 'react'
import styles from './Stars.module.scss'

type Props = { count?: number }

export default function Stars({ count = 120 }: Props) {
  const items = Array.from({ length: count }, (_, i) => {
    let seed = (i + 1) * 1103515245 + 12345
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2_147_483_647) / 2_147_483_647)

    const x = Math.round(rnd() * 100)
    const delay = (rnd() * 10).toFixed(2) + 's'
    const dur = (15 + rnd() * 20).toFixed(2) + 's'
    const tdelay = (rnd() * 6).toFixed(2) + 's'
    const tdur = (3 + rnd() * 5).toFixed(2) + 's'
    const s = (0.6 + rnd() * 1.2).toFixed(2)

    return {
      i,
      style: {
        ['--x' as any]: x + '%',
        ['--delay' as any]: delay,
        ['--dur' as any]: dur,
        ['--tdelay' as any]: tdelay,
        ['--tdur' as any]: tdur,
        ['--s' as any]: s,
      } as CSSProperties,
    }
  })

  return (
    <div className={styles.stars} aria-hidden>
      {items.map(d => <span key={d.i} className={styles.star} style={d.style} />)}
    </div>
  )
}

