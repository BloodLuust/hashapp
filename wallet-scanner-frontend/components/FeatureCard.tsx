import styles from './FeatureCard.module.scss'

type Props = {
  title: string
  description: string
  emoji?: string
}

export default function FeatureCard({ title, description, emoji = '✨' }: Props) {
  return (
    <div className={`${styles.card} p-6`}>
      <div className="flex items-start gap-4">
        <div className={styles.icon} aria-hidden>
          <span className="text-xl">{emoji}</span>
        </div>
        <div>
          <div className={`${styles.title} text-lg`}>{title}</div>
          <p className={`${styles.desc} mt-1 text-sm`}>{description}</p>
        </div>
      </div>
    </div>
  )
}

