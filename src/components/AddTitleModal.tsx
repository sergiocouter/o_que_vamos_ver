import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, LoaderCircle, Plus, Search, X } from 'lucide-react'
import { getTitleDetails, searchTitles } from '../services/tmdb'
import type { LibraryItem, MediaType, SearchResult, WatchStatus } from '../types'
import { MEDIA_LABELS, STATUS_LABELS } from '../types'
import { Poster } from './Poster'

interface AddTitleModalProps {
  onClose: () => void
  onAdd: (item: LibraryItem) => Promise<void>
}

export function AddTitleModal({ onClose, onAdd }: AddTitleModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [mediaType, setMediaType] = useState<MediaType>('movie')
  const [status, setStatus] = useState<WatchStatus>('watchlist')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function search(event: FormEvent) {
    event.preventDefault()
    if (query.trim().length < 2) return
    setLoading(true)
    setError(null)
    try {
      setResults(await searchTitles(query.trim()))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível buscar.')
    } finally {
      setLoading(false)
    }
  }

  function choose(result: SearchResult) {
    setSelected(result)
    setMediaType(result.mediaType === 'movie' ? 'movie' : 'tv')
  }

  async function confirm() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const details = await getTitleDetails(selected.tmdbId, mediaType)
      const now = new Date().toISOString()
      await onAdd({
        id: crypto.randomUUID(),
        tmdbId: selected.tmdbId,
        mediaType,
        title: selected.title,
        originalTitle: selected.originalTitle,
        overview: selected.overview,
        posterUrl: selected.posterUrl,
        backdropUrl: selected.backdropUrl,
        releaseYear: selected.releaseYear,
        genres: details.genres?.map((genre) => genre.name) ?? [],
        totalSeasons: details.number_of_seasons,
        totalEpisodes: details.number_of_episodes,
        watchedEpisodes: 0,
        seasonProgress: details.seasons
          ?.filter((season) => season.season_number > 0)
          .map((season) => ({
            seasonNumber: season.season_number,
            name: season.name,
            episodeCount: season.episode_count,
            watchedEpisodes: 0,
            completed: false,
          })),
        status,
        addedAt: now,
        statusChangedAt: now,
        startedAt: status === 'watching' ? now : undefined,
        watchedAt: status === 'watched' ? now : undefined,
      })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal add-modal" role="dialog" aria-modal="true" aria-labelledby="add-title-heading">
        <header className="modal-header">
          <div>
            <span className="eyebrow">NOVO NA LISTA</span>
            <h2 id="add-title-heading">{selected ? 'Como vamos salvar?' : 'O que vocês querem ver?'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </header>

        {selected ? (
          <div className="selected-title-step">
            <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Voltar à busca</button>
            <div className="selected-title-summary">
              <Poster src={selected.posterUrl} title={selected.title} />
              <div>
                <h3>{selected.title}</h3>
                <p className="muted">{selected.releaseYear ?? 'Ano não informado'}</p>
                <p className="clamped-overview">{selected.overview || 'Sem sinopse disponível.'}</p>
              </div>
            </div>
            <fieldset>
              <legend>Que tipo de título é?</legend>
              <div className="choice-grid three">
                {(selected.mediaType === 'movie' ? ['movie'] : ['tv', 'reality']).map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={mediaType === type ? 'active' : ''}
                    onClick={() => setMediaType(type as MediaType)}
                  >
                    {mediaType === type && <Check size={16} />} {MEDIA_LABELS[type as MediaType]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Em qual lista?</legend>
              <div className="choice-grid three">
                {(['watchlist', 'watching', 'watched'] as WatchStatus[]).map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={status === value ? 'active' : ''}
                    onClick={() => setStatus(value)}
                  >
                    {status === value && <Check size={16} />} {STATUS_LABELS[value]}
                  </button>
                ))}
              </div>
            </fieldset>
            {error && <p className="form-message">{error}</p>}
            <button className="primary-button full-button" onClick={confirm} disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}
              Adicionar à lista
            </button>
          </div>
        ) : (
          <>
            <form className="modal-search" onSubmit={search}>
              <Search size={19} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busque por filme, série ou reality..."
              />
              <button className="primary-button" disabled={loading || query.trim().length < 2}>
                {loading ? <LoaderCircle className="spin" size={18} /> : 'Buscar'}
              </button>
            </form>
            {error && <p className="form-message modal-message">{error}</p>}
            <div className="search-results">
              {!loading && results.length === 0 && !error && (
                <div className="empty-search">
                  <span className="empty-search-icon"><Search size={28} /></span>
                  <h3>Procure no catálogo</h3>
                  <p>Digite o nome e nós buscamos capa, sinopse, ano e temporadas.</p>
                </div>
              )}
              {results.map((result) => (
                <button className="search-result" key={`${result.mediaType}-${result.tmdbId}`} onClick={() => choose(result)}>
                  <Poster src={result.posterUrl} title={result.title} />
                  <span className="search-result-copy">
                    <strong>{result.title}</strong>
                    <small>{result.mediaType === 'movie' ? 'Filme' : 'Série / Reality'} · {result.releaseYear ?? '—'}</small>
                    <span>{result.overview || 'Sem sinopse disponível.'}</span>
                  </span>
                  <Plus size={20} />
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
