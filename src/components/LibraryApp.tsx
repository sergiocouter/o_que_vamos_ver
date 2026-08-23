import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  Download,
  Film,
  Flame,
  Home,
  KeyRound,
  ListFilter,
  LoaderCircle,
  LogOut,
  Menu,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Tv,
  Users,
  X,
} from 'lucide-react'
import { addItem, listItems, removeItem, updateItem } from '../services/library'
import { getDailyRecommendation } from '../lib/dailyRecommendation'
import {
  MEDIA_LABELS,
  STATUS_LABELS,
  type Household,
  type LibraryItem,
  type MediaType,
  type WatchStatus,
} from '../types'
import { AddTitleModal } from './AddTitleModal'
import { Poster } from './Poster'
import { TitleModal } from './TitleModal'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface LibraryAppProps {
  household: Household
  userId?: string
  displayName: string
  isDemo: boolean
  onSignOut: () => void
}

type View = 'all' | WatchStatus

const dayDiff = (value: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000))

const waitingLabel = (value: string) => {
  const days = dayDiff(value)
  if (days === 0) return 'Adicionado hoje'
  if (days === 1) return 'Há 1 dia na lista'
  return `Há ${days} dias na lista`
}

export function LibraryApp({ household, userId, displayName, isDemo, onSignOut }: LibraryAppProps) {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [view, setView] = useState<View>('all')
  const [mediaFilter, setMediaFilter] = useState<'all' | MediaType>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [recommendationNow, setRecommendationNow] = useState(() => new Date())

  useEffect(() => {
    let active = true
    listItems(household.id)
      .then((data) => active && setItems(data))
      .catch(() => showToast('Não foi possível carregar a lista.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [household.id])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    let timer: number
    const scheduleNextDay = () => {
      const now = new Date()
      const nextDay = new Date(now)
      nextDay.setHours(24, 0, 1, 0)
      timer = window.setTimeout(() => {
        setRecommendationNow(new Date())
        scheduleNextDay()
      }, nextDay.getTime() - now.getTime())
    }
    scheduleNextDay()
    return () => window.clearTimeout(timer)
  }, [])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }

  const counts = useMemo(
    () => ({
      all: items.length,
      watchlist: items.filter((item) => item.status === 'watchlist').length,
      watching: items.filter((item) => item.status === 'watching').length,
      watched: items.filter((item) => item.status === 'watched').length,
    }),
    [items],
  )

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return items
      .filter((item) => view === 'all' || item.status === view)
      .filter((item) => mediaFilter === 'all' || item.mediaType === mediaFilter)
      .filter((item) => !normalizedQuery || `${item.title} ${item.originalTitle ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      .sort((a, b) => new Date(b.statusChangedAt).getTime() - new Date(a.statusChangedAt).getTime())
  }, [items, mediaFilter, query, view])

  const dailyRecommendation = useMemo(
    () => getDailyRecommendation(items, recommendationNow),
    [items, recommendationNow],
  )

  async function handleAdd(item: LibraryItem) {
    const saved = await addItem(item, household.id, userId)
    setItems((current) => [saved, ...current])
    showToast(`${saved.title} entrou na lista!`)
  }

  async function handleSave(item: LibraryItem) {
    const saved = await updateItem(item, household.id)
    setItems((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)))
    showToast('Alterações salvas.')
  }

  async function handleDelete(item: LibraryItem) {
    await removeItem(item.id, household.id)
    setItems((current) => current.filter((entry) => entry.id !== item.id))
    setSelectedItem(null)
    showToast(`${item.title} foi removido.`)
  }

  async function installApp() {
    if (!installPrompt) {
      showToast('No celular, use “Adicionar à tela de início” no menu do navegador.')
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstallPrompt(null)
  }

  async function shareInvite() {
    const text = `Entre na nossa lista “${household.name}” com o código ${household.inviteCode}.`
    if (navigator.share) await navigator.share({ title: 'O que vamos ver?', text })
    else {
      await navigator.clipboard.writeText(household.inviteCode)
      showToast('Código de convite copiado!')
    }
  }

  const navItems: { id: View; label: string; icon: typeof Home }[] = [
    { id: 'all', label: 'Visão geral', icon: Home },
    { id: 'watchlist', label: 'Tem que ver', icon: Flame },
    { id: 'watching', label: 'Tô vendo', icon: Play },
    { id: 'watched', label: 'Já vi', icon: Check },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand"><span className="brand-mark"><Film size={21} /></span><span>O que vamos<br /><strong>ver?</strong></span></div>
        <button className="sidebar-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        <nav className="main-nav">
          <span className="nav-caption">MINHA LISTA</span>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setMenuOpen(false) }}>
              <Icon size={18} /><span>{label}</span><small>{counts[id]}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-family">
          <span className="nav-caption">NOSSA CASA</span>
          <button onClick={shareInvite}><Users size={18} /><span>{household.name}</span><Share2 size={15} /></button>
          <div className="invite-chip"><KeyRound size={14} /> convite: <strong>{household.inviteCode}</strong></div>
        </div>
        <div className="sidebar-spacer" />
        <button className="install-card" onClick={installApp}><span><Download size={18} /></span><span><strong>Instalar aplicativo</strong><small>Tenha a lista sempre à mão</small></span></button>
        <div className="user-card">
          <span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{displayName}</strong><small>{isDemo ? 'modo demonstração' : 'membro da casa'}</small></span>
          <button className="icon-button" onClick={onSignOut} aria-label="Sair"><LogOut size={17} /></button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button icon-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <label className="global-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na sua lista..." /></label>
          <button className="primary-button add-button" onClick={() => setShowAdd(true)}><Plus size={19} /><span>Adicionar título</span></button>
        </header>

        <div className="content-inner">
          <section className="welcome-row">
            <div><span className="eyebrow">{household.name.toUpperCase()}</span><h1>Oi, {displayName.split(' ')[0]}! O que vamos ver?</h1><p>Seu catálogo familiar, sem perder nenhuma boa indicação.</p></div>
            <div className="mini-avatars" title="Lista compartilhada"><span>{displayName.slice(0, 1).toUpperCase()}</span><span>+</span><small>lista da casa</small></div>
          </section>

          <section className="dashboard-cards">
            <article className="insight-card main-insight">
              <div><span className="insight-icon"><Sparkles size={19} /></span><span className="eyebrow light">INDICAÇÃO DO DIA</span><h2>{dailyRecommendation ? dailyRecommendation.item.title : loading ? 'Escolhendo a indicação de hoje...' : 'Sua lista está pronta para novas histórias.'}</h2><p>{dailyRecommendation?.reason ?? (loading ? 'Um instante enquanto olhamos a lista da casa.' : 'Adicione um título que alguém indicou.')}</p><button onClick={() => dailyRecommendation ? setSelectedItem(dailyRecommendation.item) : setShowAdd(true)}>{dailyRecommendation ? 'Ver indicação' : 'Adicionar agora'} <Play size={15} /></button></div>
              {dailyRecommendation?.item.posterUrl ? <div className="daily-pick-poster"><Poster src={dailyRecommendation.item.posterUrl} title={dailyRecommendation.item.title} /></div> : <div className="insight-art"><span className="art-disc" /><Clapperboard size={54} /></div>}
            </article>
            <article className="stat-card"><span className="stat-icon warm"><Flame size={20} /></span><span><strong>{counts.watchlist}</strong><small>na fila</small></span><p>{counts.watchlist ? 'Escolham o próximo!' : 'Fila zerada'}</p></article>
            <article className="stat-card"><span className="stat-icon purple"><Play size={20} /></span><span><strong>{counts.watching}</strong><small>em andamento</small></span><p>{counts.watching ? 'Tem história rolando' : 'Nada em andamento'}</p></article>
            <article className="stat-card"><span className="stat-icon green"><Check size={20} /></span><span><strong>{counts.watched}</strong><small>já vistos</small></span><p>{counts.watched ? 'Memórias do sofá' : 'Comecem a assistir'}</p></article>
          </section>

          <section className="library-section">
            <div className="library-heading"><div><h2>{view === 'all' ? 'Nossa lista' : STATUS_LABELS[view]}</h2><p>{filteredItems.length} {filteredItems.length === 1 ? 'título encontrado' : 'títulos encontrados'}</p></div><div className="view-actions"><ListFilter size={17} /><select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as 'all' | MediaType)}><option value="all">Todos os tipos</option><option value="movie">Filmes</option><option value="tv">Séries</option><option value="reality">Realitys</option></select><ChevronDown size={15} /></div></div>

            <div className="quick-tabs">
              {navItems.map(({ id, label }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}<span>{counts[id]}</span></button>)}
            </div>

            {loading ? (
              <div className="loading-state"><LoaderCircle className="spin" size={28} /> Carregando a lista...</div>
            ) : filteredItems.length ? (
              <div className="title-grid">
                {filteredItems.map((item) => {
                  const progress = item.totalEpisodes ? Math.min(100, Math.round(((item.watchedEpisodes ?? 0) / item.totalEpisodes) * 100)) : 0
                  return (
                    <article className="title-card" key={item.id} onClick={() => setSelectedItem(item)}>
                      <div className="poster-wrap">
                        <Poster src={item.posterUrl} title={item.title} />
                        <span className={`status-badge ${item.status}`}>{item.status === 'watchlist' ? <Flame size={12} /> : item.status === 'watching' ? <Play size={12} /> : <Check size={12} />}{STATUS_LABELS[item.status]}</span>
                        {item.rating && <span className="card-rating"><Star size={12} fill="currentColor" /> {item.rating}</span>}
                      </div>
                      <div className="title-card-copy">
                        <span className="media-line">{MEDIA_LABELS[item.mediaType]} {item.releaseYear ? `· ${item.releaseYear}` : ''}</span>
                        <h3>{item.title}</h3>
                        {item.status === 'watching' && item.mediaType !== 'movie' ? <div className="card-progress"><span><span style={{ width: `${progress}%` }} /></span><small>{item.watchedEpisodes ?? 0}/{item.totalEpisodes ?? '?'} eps.</small></div> : <p className={dayDiff(item.addedAt) > 60 && item.status === 'watchlist' ? 'waiting-too-long' : ''}><Clock3 size={13} /> {waitingLabel(item.statusChangedAt)}</p>}
                      </div>
                    </article>
                  )
                })}
                <button className="add-card" onClick={() => setShowAdd(true)}><span><Plus size={24} /></span><strong>Adicionar outro</strong><small>Filme, série ou reality</small></button>
              </div>
            ) : (
              <div className="empty-library"><span><Tv size={30} /></span><h3>Nada por aqui ainda</h3><p>{query ? 'Tente buscar outro nome ou limpar os filtros.' : 'Salve uma indicação para ela não escapar.'}</p><button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={18} /> Adicionar título</button></div>
            )}
          </section>
          <footer className="app-footer"><span><Film size={15} /> Feito para o sofá de casa.</span><span>Dados de catálogo fornecidos por TMDB.</span></footer>
        </div>
      </main>

      <nav className="mobile-nav">
        {navItems.slice(0, 2).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={20} /><span>{label}</span></button>)}
        <button className="mobile-add" onClick={() => setShowAdd(true)}><Plus size={25} /></button>
        {navItems.slice(2).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={20} /><span>{label}</span></button>)}
      </nav>

      {showAdd && <AddTitleModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {selectedItem && <TitleModal item={selectedItem} onClose={() => setSelectedItem(null)} onSave={handleSave} onDelete={handleDelete} />}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  )
}
