import { Star } from 'lucide-react'

interface StarsProps {
  value: number
  size?: number
}

/** Cinco estrelas só para leitura, preenchidas até a nota. */
export function Stars({ value, size = 12 }: StarsProps) {
  return (
    <span className="stars" role="img" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((position) => (
        <Star key={position} size={size} fill={value >= position ? 'currentColor' : 'none'} className={value >= position ? 'on' : ''} />
      ))}
    </span>
  )
}
