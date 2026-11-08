import { useEffect, useMemo, useRef, useState } from 'react'
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
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react'
import { addItem, DEMO_USER_ID, listItems, removeItem, saveMyRating, updateItem } from '../services/library'
import { getDailyRecommendation } from '../lib/dailyRecommendation'
import { clearPendingInvite, getPendingInvite, inviteLink } from '../lib/invite'
import { formatRating } from '../lib/ratings'
import { dayDiff, relativeTime, wasMoved } from '../lib/dates'
import {
  isOnRootEntry,
  planViewChange,
  pushScreen,
  replaceScreen,
  restoreGuard,
  screenFromState,
  setupBackNavigation,
  stepsToCloseAdd,
  type Screen,
  type View,
} from '../lib/backNavigation'
import {
  MEDIA_LABELS,
  STATUS_LABELS,
  type Household,
  type LibraryItem,
  type MediaType,
  type SearchResult,
  type WatchStatus,
} from '../types'
import { AddTitleModal } from './AddTitleModal'
import { Poster } from './Poster'
import { ReminderToggle } from './ReminderToggle'
import { TitleModal } from './TitleModal'
import { Stars } from './Stars'
import { CardProviders } from './WatchProviders'

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

const addedLabel = (value: string) => {
  const when = relativeTime(value)
  return when === 'hoje' || when === 'ontem' ? `Entrou ${when}` : `Na lista ${when}`
}

export function LibraryApp({ household, userId, displayName, isDemo, onSignOut }: LibraryAppProps) {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [mediaFilter, setMediaFilter] = useState<'all' | MediaType>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(() => {
    const pending = getPendingInvite()
    return pending && pending !== household.inviteCode
      ? `Esse convite é de outra casa. Você já participa da ${household.name}.`
      : null
  })
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [recommendationNow, setRecommendationNow] = useState(() => new Date())
  // Tela atual = passo atual do histórico (lista + janela aberta). Notificação: /?titulo=<id>.
  const [screen, setScreen] = useState<Screen>(() =>
    setupBackNavigation(new URLSearchParams(window.location.search).get('titulo')),
  )
  const { view, overlay } = screen
  const selectedItem = overlay?.kind === 'title' ? items.find((item) => item.id === overlay.titleId) ?? null : null
  const menuOpen = overlay?.kind === 'menu'
  const lastRootBack = useRef(0)
  // Ação para depois de um voltar (ex.: fechar o menu e então trocar de lista).
  const afterPop = useRef<((screen: Screen) => void) | null>(null)
  const librarySection = useRef<HTMLElement>(null)

  // Link de convite aberto por quem já tem casa: descarta e, se for de outra casa, avisa.
  const showsInviteNotice = useRef(toast !== null)
  useEffect(() => {
    if (!showsInviteNotice.current) {
      clearPendingInvite()
      return
    }
    // Descarta só quando o aviso some: se o app recarregar antes (instalação ou atualização do
    // service worker), o aviso aparece de novo.
    const timer = window.setTimeout(() => {
      clearPendingInvite()
      setToast(null)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Voltar = reaplicar a tela do passo anterior.
    const onPopState = (event: PopStateEvent) => {
      if (isOnRootEntry()) {
        // Tela inicial: o 1º voltar avisa; o 2º em até 2s sai do app.
        if (Date.now() - lastRootBack.current < 2000) {
          window.history.back()
          return
        }
        lastRootBack.current = Date.now()
        restoreGuard()
        setScreen({ view: 'all', overlay: null })
        showToast('Toque em voltar de novo para sair')
        return
      }
      const next = screenFromState(event.state, window.location.search)
      setScreen(next)
      const after = afterPop.current
      afterPop.current = null
      after?.(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Título que não existe mais (removido, ou link antigo de notificação): volta um nível.
  const missingTitle = !loading && overlay?.kind === 'title' && !selectedItem
  useEffect(() => {
    if (missingTitle) window.history.back()
  }, [missingTitle])

  useEffect(() => {
    let active = true
    listItems(household.id)
      .then((data) => {
        if (!active) return
        setItems(data)
      })
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

  /** Abre uma tela nova por cima (um nível a mais no voltar). */
  function go(next: Screen) {
    pushScreen(next)
    setScreen(next)
  }

  /** Troca a tela atual sem criar nível. */
  function swap(next: Screen) {
    replaceScreen(next)
    setScreen(next)
  }

  function openTitle(item: LibraryItem) {
    go({ view, overlay: { kind: 'title', titleId: item.id } })
  }

  function openAdd() {
    go({ view, overlay: { kind: 'add', from: 'search' } })
  }

  /** Resultado da busca escolhido: "Como vamos salvar?" vira um nível (o voltar volta à busca). */
  function selectForAdd(result: SearchResult) {
    go({ view, overlay: { kind: 'add', from: 'search', preset: result } })
  }

  function backToSearch() {
    if (overlay?.kind !== 'add') return
    if (overlay.from === 'search') window.history.back()
    else swap({ view, overlay: { kind: 'add', from: 'search' } })
  }

  /** Sugestão nova de "Parecidos com este": prévia de "Adicionar" por cima do título. */
  function previewSimilar(result: SearchResult) {
    go({ view, overlay: { kind: 'add', from: 'similar', preset: result } })
  }

  function findInList(result: SearchResult) {
    const isMovie = result.mediaType === 'movie'
    return items.find((item) => item.tmdbId === result.tmdbId && (item.mediaType === 'movie') === isMovie)
  }

  function openMenu() {
    go({ view, overlay: { kind: 'menu' } })
  }

  /** X, fundo, Esc e ações que fecham: volta um nível ("Adicionar" fecha a janela inteira). */
  function closeOverlay() {
    if (!overlay) return
    window.history.go(-stepsToCloseAdd(overlay))
  }

  /** Troca de lista: da Visão geral empilha, entre filtradas substitui, para a Visão geral volta. */
  function changeView(target: View, from: View = view) {
    const plan = planViewChange(from, target)
    if (plan === 'push') go({ view: target, overlay: null })
    else if (plan === 'replace') swap({ view: target, overlay: null })
    else if (plan === 'back') window.history.back()
  }

  /** Menu do celular: fecha (voltar) e só então troca de lista. No computador ele fica sempre à vista. */
  function selectFromMenu(target: View) {
    if (!menuOpen) {
      changeView(target)
      return
    }
    afterPop.current = (screenAfter) => changeView(target, screenAfter.view)
    window.history.back()
  }

  /** Cartões de resumo: abrem a lista filtrada e rolam até ela. */
  function showList(target: WatchStatus) {
    changeView(target)
    window.requestAnimationFrame(() => librarySection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

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
    const saved = await addItem(item, household.id, userId, displayName)
    setItems((current) => [saved, ...current])
    showToast(`${saved.title} entrou na lista!`)
  }

  const me = { id: userId ?? DEMO_USER_ID, name: displayName }

  async function handleSave(item: LibraryItem) {
    const before = items.find((entry) => entry.id === item.id)?.ratings?.find((entry) => entry.userId === me.id)?.rating
    const after = item.ratings?.find((entry) => entry.userId === me.id)?.rating
    if (before !== after) await saveMyRating(item.id, me.id, after ?? null)
    const saved = await updateItem(item, household.id)
    setItems((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)))
    showToast('Alterações salvas.')
  }

  async function handleDelete(item: LibraryItem) {
    await removeItem(item.id, household.id)
    // Sem fechar aqui: o título some da lista e a tela volta um nível sozinha (missingTitle).
    setItems((current) => current.filter((entry) => entry.id !== item.id))
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
    const link = inviteLink(household.inviteCode)
    const text = `Entre na nossa lista “${household.name}” no O que vamos ver: ${link}`
    if (navigator.share) {
      await navigator.share({ title: 'O que vamos ver?', text }).catch(() => undefined)
      return
    }
    try {
      await navigator.clipboard.writeText(link)
      showToast('Link de convite copiado!')
    } catch {
      showToast(`Código de convite: ${household.inviteCode}`)
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
        <button className="sidebar-close icon-button" onClick={closeOverlay} aria-label="Fechar menu"><X size={20} /></button>
        <nav className="main-nav">
          <span className="nav-caption">MINHA LISTA</span>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => selectFromMenu(id)}>
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
        {!isDemo && <ReminderToggle />}
        <button className="install-card" onClick={installApp}><span><Download size={18} /></span><span><strong>Instalar aplicativo</strong><small>Tenha a lista sempre à mão</small></span></button>
        <div className="user-card">
          <span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{displayName}</strong><small>{isDemo ? 'modo demonstração' : 'membro da casa'}</small></span>
          <button className="icon-button" onClick={onSignOut} aria-label="Sair"><LogOut size={17} /></button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-overlay" onClick={closeOverlay} aria-label="Fechar menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button icon-button" onClick={openMenu} aria-label="Abrir menu"><Menu size={21} /></button>
          <label className="global-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na sua lista..." /></label>
          <button className="primary-button add-button" onClick={openAdd}><Plus size={19} /><span>Adicionar título</span></button>
        </header>

        <div className="content-inner">
          <section className="welcome-row">
            <div><span className="eyebrow">{household.name.toUpperCase()}</span><h1>Oi, {displayName.split(' ')[0]}! O que vamos ver?</h1><p>Seu catálogo familiar, sem perder nenhuma boa indicação.</p></div>
            <div className="mini-avatars" title="Lista compartilhada"><span>{displayName.slice(0, 1).toUpperCase()}</span><span>+</span><small>lista da casa</small></div>
          </section>

          <section className="dashboard-cards">
            <article className="insight-card main-insight">
              <div><span className="insight-icon"><Sparkles size={19} /></span><span className="eyebrow light">INDICAÇÃO DO DIA</span><h2>{dailyRecommendation ? dailyRecommendation.item.title : loading ? 'Escolhendo a indicação de hoje...' : 'Sua lista está pronta para novas histórias.'}</h2><p>{dailyRecommendation?.reason ?? (loading ? 'Um instante enquanto olhamos a lista da casa.' : 'Adicione um título que alguém indicou.')}</p><button onClick={() => dailyRecommendation ? openTitle(dailyRecommendation.item) : openAdd()}>{dailyRecommendation ? 'Ver indicação' : 'Adicionar agora'} <Play size={15} /></button></div>
              {dailyRecommendation?.item.posterUrl ? <div className="daily-pick-poster"><Poster src={dailyRecommendation.item.posterUrl} title={dailyRecommendation.item.title} /></div> : <div className="insight-art"><span className="art-disc" /><Clapperboard size={54} /></div>}
            </article>
            <article className="stat-card" role="button" tabIndex={0} onClick={() => showList('watchlist')} onKeyDown={(event) => event.key === 'Enter' && showList('watchlist')} aria-label={`Ver ${counts.watchlist} títulos na fila`}><span className="stat-icon warm"><Flame size={20} /></span><span><strong>{counts.watchlist}</strong><small>na fila</small></span><p>{counts.watchlist ? 'Escolham o próximo!' : 'Fila zerada'}</p></article>
            <article className="stat-card" role="button" tabIndex={0} onClick={() => showList('watching')} onKeyDown={(event) => event.key === 'Enter' && showList('watching')} aria-label={`Ver ${counts.watching} títulos em andamento`}><span className="stat-icon purple"><Play size={20} /></span><span><strong>{counts.watching}</strong><small>em andamento</small></span><p>{counts.watching ? 'Tem história rolando' : 'Nada em andamento'}</p></article>
            <article className="stat-card" role="button" tabIndex={0} onClick={() => showList('watched')} onKeyDown={(event) => event.key === 'Enter' && showList('watched')} aria-label={`Ver ${counts.watched} títulos já vistos`}><span className="stat-icon green"><Check size={20} /></span><span><strong>{counts.watched}</strong><small>já vistos</small></span><p>{counts.watched ? 'Memórias do sofá' : 'Comecem a assistir'}</p></article>
          </section>

          <section className="library-section" ref={librarySection}>
            <div className="library-heading"><div><h2>{view === 'all' ? 'Nossa lista' : STATUS_LABELS[view]}</h2><p>{filteredItems.length} {filteredItems.length === 1 ? 'título encontrado' : 'títulos encontrados'}</p></div><div className="view-actions"><ListFilter size={17} /><select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as 'all' | MediaType)}><option value="all">Todos os tipos</option><option value="movie">Filmes</option><option value="tv">Séries</option><option value="reality">Realitys</option></select><ChevronDown size={15} /></div></div>

            <div className="quick-tabs">
              {navItems.map(({ id, label }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}>{label}<span>{counts[id]}</span></button>)}
            </div>

            {loading ? (
              <div className="loading-state"><LoaderCircle className="spin" size={28} /> Carregando a lista...</div>
            ) : filteredItems.length ? (
              <div className="title-grid">
                {filteredItems.map((item) => {
                  const progress = item.totalEpisodes ? Math.min(100, Math.round(((item.watchedEpisodes ?? 0) / item.totalEpisodes) * 100)) : 0
                  return (
                    <article className="title-card" key={item.id} onClick={() => openTitle(item)}>
                      <div className="poster-wrap">
                        <Poster src={item.posterUrl} title={item.title} />
                        <span className={`status-badge ${item.status}`}>{item.status === 'watchlist' ? <Flame size={12} /> : item.status === 'watching' ? <Play size={12} /> : <Check size={12} />}{STATUS_LABELS[item.status]}</span>
                      </div>
                      <div className="title-card-copy">
                        <div className="card-meta">
                          <span className="media-line">{MEDIA_LABELS[item.mediaType]} {item.releaseYear ? `· ${item.releaseYear}` : ''}</span>
                          {item.tmdbId && <CardProviders tmdbId={item.tmdbId} mediaType={item.mediaType} />}
                        </div>
                        <h3>{item.title}</h3>
                        {item.addedByName && <span className="added-by-line"><UserRoundPlus size={12} /> {item.addedByName.split(' ')[0]}</span>}
                        {item.rating !== undefined && item.ratings?.length ? (
                          <div className="card-ratings">
                            <span className="card-average"><Star size={11} fill="currentColor" /> {formatRating(item.rating)} <small>média</small></span>
                            {item.ratings.slice(0, 3).map((entry) => (
                              <span className="card-person" key={entry.userId}><span>{entry.name.split(' ')[0]}</span><Stars value={entry.rating} size={10} /></span>
                            ))}
                            {item.ratings.length > 3 && <small className="card-more">+{item.ratings.length - 3}</small>}
                          </div>
                        ) : null}
                        {item.status === 'watching' && item.mediaType !== 'movie' && <div className="card-progress"><span><span style={{ width: `${progress}%` }} /></span><small>{item.watchedEpisodes ?? 0}/{item.totalEpisodes ?? '?'} eps.</small></div>}
                        <p className={dayDiff(item.addedAt) > 60 && item.status === 'watchlist' ? 'waiting-too-long' : ''}><Clock3 size={13} /> {addedLabel(item.addedAt)}</p>
                        {wasMoved(item) && <p className={`moved-line ${item.status}`}>{item.status === 'watchlist' ? <Flame size={12} /> : item.status === 'watching' ? <Play size={12} /> : <Check size={12} />} {STATUS_LABELS[item.status]} {relativeTime(item.statusChangedAt)}</p>}
                      </div>
                    </article>
                  )
                })}
                <button className="add-card" onClick={openAdd}><span><Plus size={24} /></span><strong>Adicionar outro</strong><small>Filme, série ou reality</small></button>
              </div>
            ) : (
              <div className="empty-library"><span><Tv size={30} /></span><h3>Nada por aqui ainda</h3><p>{query ? 'Tente buscar outro nome ou limpar os filtros.' : 'Salve uma indicação para ela não escapar.'}</p><button className="primary-button" onClick={openAdd}><Plus size={18} /> Adicionar título</button></div>
            )}
          </section>
          <footer className="app-footer"><span><Film size={15} /> Feito para o sofá de casa.</span><span>Dados de catálogo fornecidos por TMDB.</span></footer>
        </div>
      </main>

      <nav className="mobile-nav">
        {navItems.slice(0, 2).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><Icon size={20} /><span>{label}</span></button>)}
        <button className="mobile-add" onClick={openAdd}><Plus size={25} /></button>
        {navItems.slice(2).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}><Icon size={20} /><span>{label}</span></button>)}
      </nav>

      {overlay?.kind === 'add' && (
        <AddTitleModal
          selection={overlay.preset ?? null}
          onSelect={selectForAdd}
          onBackToSearch={backToSearch}
          onClose={closeOverlay}
          onAdd={handleAdd}
        />
      )}
      {selectedItem && (
        <TitleModal
          key={selectedItem.id}
          item={selectedItem}
          onClose={closeOverlay}
          onSave={handleSave}
          onDelete={handleDelete}
          findInList={findInList}
          onOpenItem={openTitle}
          onPreview={previewSimilar}
          me={me}
        />
      )}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  )
}
