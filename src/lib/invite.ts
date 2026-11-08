// Convite por link: /?convite=<código>. O código fica guardado no aparelho para sobreviver ao
// login com Google e à confirmação de e-mail, que saem do app e voltam.

const PARAM = 'convite'
const STORAGE_KEY = 'oqvv:convite'

/** Código limpo (sem espaços, maiúsculo) ou null quando não parece um código de convite. */
export function normalizeInviteCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').replace(/\s+/g, '').toUpperCase()
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null
}

/** Lê o convite da URL e devolve a URL sem ele (mantendo os outros parâmetros). */
export function readInviteFromUrl(href: string): { code: string | null; cleanedUrl: string } | null {
  const url = new URL(href)
  if (!url.searchParams.has(PARAM)) return null
  const code = normalizeInviteCode(url.searchParams.get(PARAM))
  url.searchParams.delete(PARAM)
  return { code, cleanedUrl: `${url.pathname}${url.search}${url.hash}` }
}

export function inviteLink(code: string, origin: string = window.location.origin): string {
  return `${origin}/?${PARAM}=${encodeURIComponent(code)}`
}

/** Ao abrir o app: guarda o convite da URL e tira o parâmetro da barra de endereço. */
export function capturePendingInvite() {
  const found = readInviteFromUrl(window.location.href)
  if (!found) return
  if (found.code) {
    try {
      window.localStorage.setItem(STORAGE_KEY, found.code)
    } catch {
      // Sem armazenamento (ex.: navegação privada): a pessoa ainda pode digitar o código.
    }
  }
  window.history.replaceState(window.history.state, '', found.cleanedUrl)
}

export function getPendingInvite(): string | null {
  try {
    return normalizeInviteCode(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nada a limpar.
  }
}
