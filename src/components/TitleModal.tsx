import { useEffect, useState } from 'react'
import { CalendarDays, Check, Flame, Play, Save, Star, Trash2, X } from 'lucide-react'
import { MEDIA_LABELS, STATUS_LABELS, type LibraryItem, type WatchStatus } from '../types'
import { withNewStatus } from '../services/library'
import { Poster } from './Poster'

interface TitleModalProps {
  item: LibraryItem
  onClose: () => void
  onSave: (item: LibraryItem) => Promise<void>
  onDelete: (item: LibraryItem) => Promise<void>
}

const dateLabel = (value?: string) =>
  value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value)) : '—'

export function TitleModal({ item, onClose, onSave, onDelete }: TitleModalProps) {
  const [draft, setDraft] = useState(item)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    onClose()
  }

  function setStatus(status: WatchStatus) {
    setDraft((current) => withNewStatus(current, status))
  }

  const progress = draft.totalEpisodes
    ? Math.min(100, Math.round(((draft.watchedEpisodes ?? 0) / draft.totalEpisodes) * 100))
    : 0

  function updateSeason(seasonNumber: number, watchedEpisodes: number) {
    const nextSeasons = (draft.seasonProgress ?? []).map((season) =>
      season.seasonNumber === seasonNumber
        ? {
            ...season,
            watchedEpisodes: Math.max(0, Math.min(watchedEpisodes, season.episodeCount)),
            completed: watchedEpisodes >= season.episodeCount,
          }
        : season,
    )
    const totalWatched = nextSeasons.reduce((sum, season) => sum + season.watchedEpisodes, 0)
    const latestStarted = [...nextSeasons].reverse().find((season) => season.watchedEpisodes > 0)
    setDraft({
      ...draft,
      seasonProgress: nextSeasons,
      watchedEpisodes: totalWatched,
      currentSeason: latestStarted?.seasonNumber ?? draft.currentSeason,
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        <div className="detail-hero" style={draft.backdropUrl ? { backgroundImage: `linear-gradient(90deg, rgba(18,17,22,.98) 0%, rgba(18,17,22,.72) 55%, rgba(18,17,22,.35)), url(${draft.backdropUrl})` } : undefined}>
          <Poster src={draft.posterUrl} title={draft.title} className="detail-poster" />
          <div className="detail-title-copy">
            <span className="eyebrow light">{MEDIA_LABELS[draft.mediaType]} · {draft.releaseYear ?? 'ANO NÃO INFORMADO'}</span>
            <h2 id="detail-title">{draft.title}</h2>
            {draft.originalTitle && draft.originalTitle !== draft.title && <p>{draft.originalTitle}</p>}
            <div className="genre-row">{draft.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-main">
            <section>
              <h3>Onde está na lista?</h3>
              <div className="status-choice">
                {(['watchlist', 'watching', 'watched'] as WatchStatus[]).map((status) => (
                  <button key={status} className={draft.status === status ? 'active' : ''} onClick={() => setStatus(status)}>
                    {status === 'watchlist' ? <Flame size={17} /> : status === 'watching' ? <Play size={17} /> : <Check size={17} />}
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </section>

            {draft.mediaType !== 'movie' && (
              <section>
                <div className="section-heading-line">
                  <h3>Progresso</h3><span>{progress}% concluído</span>
                </div>
                <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                <div className="progress-inputs">
                  <label>Temporada atual<input type="number" min="0" max={draft.totalSeasons ?? 99} value={draft.currentSeason ?? 0} onChange={(event) => setDraft({ ...draft, currentSeason: Number(event.target.value) })} /></label>
                  <label>Episódios vistos<input type="number" min="0" max={draft.totalEpisodes ?? 9999} value={draft.watchedEpisodes ?? 0} onChange={(event) => setDraft({ ...draft, watchedEpisodes: Number(event.target.value) })} /></label>
                  <span className="total-seasons">de {draft.totalSeasons ?? '?'} temp. · {draft.totalEpisodes ?? '?'} eps.</span>
                </div>
                {(draft.seasonProgress?.length ?? 0) > 0 && (
                  <div className="season-list">
                    {draft.seasonProgress?.map((season) => (
                      <div className="season-row" key={season.seasonNumber}>
                        <button
                          className={season.completed ? 'complete' : ''}
                          onClick={() => updateSeason(season.seasonNumber, season.completed ? 0 : season.episodeCount)}
                          aria-label={season.completed ? `Marcar ${season.name} como não concluída` : `Concluir ${season.name}`}
                        >
                          <Check size={13} />
                        </button>
                        <span><strong>{season.name}</strong><small>{season.watchedEpisodes} de {season.episodeCount} episódios</small></span>
                        <input
                          aria-label={`Episódios vistos em ${season.name}`}
                          type="number"
                          min="0"
                          max={season.episodeCount}
                          value={season.watchedEpisodes}
                          onChange={(event) => updateSeason(season.seasonNumber, Number(event.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section>
              <h3>Termômetro da casa</h3>
              <p className="muted small">O quanto vocês gostaram?</p>
              <div className="rating-control">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button key={rating} className={(draft.rating ?? 0) >= rating ? 'active' : ''} onClick={() => setDraft({ ...draft, rating })} aria-label={`${rating} de 5`}>
                    <Star size={25} fill={(draft.rating ?? 0) >= rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
                <strong>{draft.rating ? `${draft.rating}/5` : 'Ainda sem nota'}</strong>
              </div>
            </section>

            <section>
              <h3>Notas da família</h3>
              <textarea value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="O que vale lembrar? Sem spoilers, de preferência..." rows={3} />
            </section>
          </div>
          <aside className="detail-aside">
            <h3>Sobre</h3>
            <p>{draft.overview || 'Sem sinopse disponível.'}</p>
            <div className="date-timeline">
              <span><CalendarDays size={17} /><span><small>Entrou na lista</small>{dateLabel(draft.addedAt)}</span></span>
              {draft.startedAt && <span><Play size={17} /><span><small>Começamos</small>{dateLabel(draft.startedAt)}</span></span>}
              {draft.watchedAt && <span><Check size={17} /><span><small>Terminamos</small>{dateLabel(draft.watchedAt)}</span></span>}
            </div>
            {draft.recommendedBy && <p className="recommended-by">Indicação de <strong>{draft.recommendedBy}</strong></p>}
          </aside>
        </div>
        <footer className="modal-footer">
          {confirmDelete ? (
            <span className="delete-confirm">Remover da lista? <button onClick={() => onDelete(draft)}>Sim, remover</button><button onClick={() => setConfirmDelete(false)}>Cancelar</button></span>
          ) : (
            <button className="danger-link" onClick={() => setConfirmDelete(true)}><Trash2 size={17} /> Remover</button>
          )}
          <button className="primary-button" onClick={save} disabled={saving}><Save size={17} /> {saving ? 'Salvando...' : 'Salvar alterações'}</button>
        </footer>
      </section>
    </div>
  )
}
