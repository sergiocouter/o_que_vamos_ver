import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { getSimilarTitles } from '../services/tmdb'
import type { LibraryItem, MediaType, SearchResult } from '../types'
import { Poster } from './Poster'

interface SimilarTitlesProps {
  tmdbId: number
  mediaType: MediaType
  /** Título da casa correspondente à sugestão, se ela já estiver na lista. */
  findInList: (result: SearchResult) => LibraryItem | undefined
  onOpenItem: (item: LibraryItem) => void
  onPreview: (result: SearchResult) => void
}

type SimilarState = { key: string; results: SearchResult[] }

/** "Parecidos com este": só aparece quando há sugestões (sem estado de carregando ou erro). */
export function SimilarTitles({ tmdbId, mediaType, findInList, onOpenItem, onPreview }: SimilarTitlesProps) {
  const key = `${mediaType === 'movie' ? 'movie' : 'tv'}:${tmdbId}`
  const [state, setState] = useState<SimilarState | null>(null)

  useEffect(() => {
    let active = true
    getSimilarTitles(tmdbId, mediaType)
      .then((results) => active && setState({ key, results }))
      .catch(() => active && setState({ key, results: [] }))
    return () => { active = false }
  }, [key, mediaType, tmdbId])

  const results = state?.key === key ? state.results : []
  if (!results.length) return null

  return (
    <section className="similar-section">
      <div className="section-heading-line">
        <h3>Parecidos com este</h3>
      </div>
      <div className="similar-row">
        {results.map((result) => {
          const inList = findInList(result)
          return (
            <button
              type="button"
              key={`${result.mediaType}-${result.tmdbId}`}
              className="similar-card"
              onClick={() => (inList ? onOpenItem(inList) : onPreview(result))}
              aria-label={inList ? `${result.title} — já está na lista` : `${result.title} — ver e adicionar`}
            >
              <span className="poster-wrap">
                <Poster src={result.posterUrl} title={result.title} />
                {inList && <span className="similar-badge"><Check size={11} /> Na lista</span>}
              </span>
              <strong>{result.title}</strong>
              <small>{result.releaseYear ?? '—'}</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}
