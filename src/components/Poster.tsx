import { useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { normalizeTmdbImageUrl } from '../services/tmdb'

interface PosterProps {
  src?: string
  title: string
  className?: string
}

export function Poster({ src, title, className = '' }: PosterProps) {
  const [failedSrc, setFailedSrc] = useState<string>()
  const imageSrc = normalizeTmdbImageUrl(src)
  const showImage = imageSrc && failedSrc !== imageSrc

  return (
    <div className={`poster ${className}`}>
      {showImage ? (
        <img
          src={imageSrc}
          alt={`Capa de ${title}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : (
        <div className="poster-fallback">
          <Clapperboard size={30} />
          <span>{title}</span>
        </div>
      )}
    </div>
  )
}
