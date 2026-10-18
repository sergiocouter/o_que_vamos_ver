// Botão voltar do celular: cada janela aberta por cima da lista (título, busca, menu) vira um passo
// no histórico, e um passo extra ("guard") segura o primeiro voltar na tela inicial.

export type OverlayKind = 'title' | 'add' | 'menu'

type HistoryMark = { oqvv?: 'root' | 'guard' | 'overlay'; kind?: OverlayKind }

const currentMark = () => (window.history.state ?? {}) as HistoryMark

export const isOnOverlayEntry = () => currentMark().oqvv === 'overlay'
export const isOnRootEntry = () => currentMark().oqvv === 'root'

/**
 * Ao abrir o app: raiz + guard (+ o passo do título, quando aberto por /?titulo=<id>, já com o
 * parâmetro na URL para sobreviver a um recarregamento antes de a lista chegar).
 * Num recarregamento a estrutura já existe e fica como está.
 */
export function setupBackNavigation(initialTitleId: string | null) {
  const mark = currentMark().oqvv
  if (mark === 'guard' || mark === 'overlay') return
  const path = window.location.pathname
  window.history.replaceState({ oqvv: 'root' }, '', path)
  window.history.pushState({ oqvv: 'guard' }, '', path)
  if (initialTitleId) pushOverlay('title', `?titulo=${encodeURIComponent(initialTitleId)}`)
}

export function pushOverlay(kind: OverlayKind, search = '') {
  window.history.pushState({ oqvv: 'overlay', kind }, '', `${window.location.pathname}${search}`)
}

/** Recoloca o guard depois do primeiro voltar na tela inicial. */
export function restoreGuard() {
  window.history.pushState({ oqvv: 'guard' }, '', window.location.pathname)
}
