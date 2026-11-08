// Botão voltar: cada tela vira um passo no histórico do navegador e o voltar sempre volta UM nível.
// Cada passo guarda a tela inteira (lista + janela aberta), então o voltar só reaplica o passo
// anterior. Um passo extra ("guard") segura o primeiro voltar na tela inicial.
//
// root → guard (Visão geral) → [lista filtrada] → [janela] → [janela] ...

import type { SearchResult, WatchStatus } from '../types'

export type View = 'all' | WatchStatus

export type Overlay =
  | { kind: 'title'; titleId: string }
  /** `preset`: etapa "Como vamos salvar?". `from`: de onde a prévia veio (a busca ou um parecido). */
  | { kind: 'add'; preset?: SearchResult; from: 'search' | 'similar' }
  | { kind: 'menu' }

export interface Screen {
  view: View
  overlay: Overlay | null
}

type Mark = 'root' | 'guard' | 'step'
type Entry = Screen & { oqvv: Mark }

const VIEWS: readonly View[] = ['all', 'watchlist', 'watching', 'watched']
export const HOME: Screen = { view: 'all', overlay: null }

/** Lê a tela guardada num passo do histórico (aceita passos antigos e estados desconhecidos). */
export function screenFromState(state: unknown, search = ''): Screen {
  const entry = (state ?? {}) as Partial<Entry> & { kind?: string }
  const view = VIEWS.includes(entry.view as View) ? (entry.view as View) : 'all'
  if (entry.overlay && typeof entry.overlay === 'object') return { view, overlay: entry.overlay }
  // Versão anterior do app: { oqvv: 'overlay', kind: 'title' } com ?titulo=<id> na URL.
  const legacyTitle = new URLSearchParams(search).get('titulo')
  if ((entry.oqvv as string) === 'overlay' && entry.kind === 'title' && legacyTitle) {
    return { view, overlay: { kind: 'title', titleId: legacyTitle } }
  }
  return { view, overlay: null }
}

/**
 * Como trocar de lista sem empilhar à toa: da Visão geral para uma lista filtrada empilha; entre
 * filtradas substitui; de uma filtrada para a Visão geral volta (o passo da Visão geral já existe).
 */
export function planViewChange(current: View, target: View): 'none' | 'push' | 'replace' | 'back' {
  if (current === target) return 'none'
  if (target === 'all') return 'back'
  return current === 'all' ? 'push' : 'replace'
}

/** Quantos passos fecham a janela de "Adicionar" inteira (busca + "Como vamos salvar?"). */
export function stepsToCloseAdd(overlay: Overlay): number {
  return overlay.kind === 'add' && overlay.preset && overlay.from === 'search' ? 2 : 1
}

const urlFor = (screen: Screen) =>
  `${window.location.pathname}${screen.overlay?.kind === 'title' ? `?titulo=${encodeURIComponent(screen.overlay.titleId)}` : ''}`

const currentEntry = () => (window.history.state ?? {}) as Partial<Entry>

export const isOnRootEntry = () => currentEntry().oqvv === 'root'
export const currentScreen = () => screenFromState(window.history.state, window.location.search)

/**
 * Ao abrir o app: raiz + guard (+ o título aberto por /?titulo=<id>, vindo da notificação).
 * Num recarregamento a pilha já existe: devolve a tela do passo atual.
 */
export function setupBackNavigation(initialTitleId: string | null): Screen {
  const mark = currentEntry().oqvv as string | undefined
  if (mark === 'guard' || mark === 'step' || mark === 'overlay') {
    const screen = currentScreen()
    if (mark === 'overlay') replaceScreen(screen)
    return screen
  }
  const path = window.location.pathname
  window.history.replaceState({ oqvv: 'root', ...HOME } satisfies Entry, '', path)
  window.history.pushState({ oqvv: 'guard', ...HOME } satisfies Entry, '', path)
  if (!initialTitleId) return HOME
  const screen: Screen = { view: 'all', overlay: { kind: 'title', titleId: initialTitleId } }
  pushScreen(screen)
  return screen
}

export function pushScreen(screen: Screen) {
  window.history.pushState({ oqvv: 'step', ...screen } satisfies Entry, '', urlFor(screen))
}

/** Troca a tela do passo atual (mantém o tipo do passo: guard continua guard). */
export function replaceScreen(screen: Screen) {
  const mark = currentEntry().oqvv
  const oqvv: Mark = mark === 'guard' || mark === 'root' ? mark : 'step'
  window.history.replaceState({ oqvv, ...screen } satisfies Entry, '', urlFor(screen))
}

/** Recoloca o guard depois do primeiro voltar na tela inicial. */
export function restoreGuard() {
  window.history.pushState({ oqvv: 'guard', ...HOME } satisfies Entry, '', window.location.pathname)
}
