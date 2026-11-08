import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getTitleTrailer, type TmdbTrailer } from '../services/tmdb'
import type { MediaType } from '../types'

interface TrailerFrameProps {
  trailer: TmdbTrailer
  title: string
}

/** Vídeo do YouTube embutido + link para abrir no app do YouTube. */
export function TrailerFrame({ trailer, title }: TrailerFrameProps) {
  return (
    <>
      <div className="trailer-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?rel=0`}
          title={`${trailer.name} — ${title}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="trailer-actions">
        <span>{trailer.name}</span>
        <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} target="_blank" rel="noopener noreferrer">
          Abrir no YouTube <ExternalLink size={13} />
        </a>
      </div>
    </>
  )
}

interface PreviewTrailerProps {
  tmdbId: number
  mediaType: MediaType
  title: string
}

/** Trailer da prévia antes de adicionar: só aparece quando existe (sem estado de carregando ou erro). */
export function PreviewTrailer({ tmdbId, mediaType, title }: PreviewTrailerProps) {
  const [found, setFound] = useState<{ key: string; trailer: TmdbTrailer | null } | null>(null)
  const requestKey = `${mediaType === 'movie' ? 'movie' : 'tv'}:${tmdbId}`

  useEffect(() => {
    const controller = new AbortController()
    getTitleTrailer(tmdbId, mediaType, controller.signal)
      .then((trailer) => setFound({ key: requestKey, trailer }))
      .catch(() => undefined)
    return () => controller.abort()
  }, [mediaType, requestKey, tmdbId])

  const trailer = found?.key === requestKey ? found.trailer : null
  if (!trailer) return null
  return (
    <section className="preview-trailer" aria-label="Trailer">
      <TrailerFrame trailer={trailer} title={title} />
    </section>
  )
}
