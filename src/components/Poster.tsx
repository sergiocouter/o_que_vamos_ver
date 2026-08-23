import { Clapperboard } from 'lucide-react'

interface PosterProps {
  src?: string
  title: string
  className?: string
}

export function Poster({ src, title, className = '' }: PosterProps) {
  return (
    <div className={`poster ${className}`}>
      {src ? (
        <img src={src} alt={`Capa de ${title}`} loading="lazy" />
      ) : (
        <div className="poster-fallback">
          <Clapperboard size={30} />
          <span>{title}</span>
        </div>
      )}
    </div>
  )
}
