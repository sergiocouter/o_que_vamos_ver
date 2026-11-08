const OFFLINE_MESSAGE = 'Sem conexão com a internet. Verifique a rede e tente de novo.'
const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Saia e entre de novo.'
const DUPLICATE_TITLE_MESSAGE = 'Esse título já está na lista da casa.'

// Código do Postgres para `raise exception` sem código próprio: são os avisos
// em português escritos nas funções do banco (ex.: "Você já participa de uma casa.").
const USER_FACING_DB_CODE = 'P0001'
const SESSION_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303'])

const NETWORK_PATTERN = /failed to fetch|networkerror|load failed|network request failed/i

/**
 * Texto seguro para mostrar ao usuário a partir de qualquer erro capturado.
 *
 * Só passa adiante mensagens escritas para o usuário: avisos das funções do banco
 * e os `Error` lançados pelo próprio app. Erros técnicos (SQL, permissões, nomes de
 * tabela, bugs) viram `fallback` e ficam apenas no console.
 */
export function errorMessage(reason: unknown, fallback: string): string {
  const friendly = friendlyMessage(reason)
  if (friendly) return friendly
  console.error(reason)
  return fallback
}

function friendlyMessage(reason: unknown): string | null {
  if (!reason || typeof reason !== 'object') return null
  const { message, code } = reason as { message?: unknown; code?: unknown }
  if (typeof message !== 'string' || !message.trim()) return null

  if (NETWORK_PATTERN.test(message)) return OFFLINE_MESSAGE

  // Erro do Supabase/Postgres: vem com `code`.
  if (typeof code === 'string' && code) {
    if (code === USER_FACING_DB_CODE) return message
    if (SESSION_CODES.has(code)) return SESSION_EXPIRED_MESSAGE
    if (code === '23505' && message.includes('titles_')) return DUPLICATE_TITLE_MESSAGE
    return null
  }

  // `Error` lançado pelo próprio app (sempre em português). TypeError e afins são bugs.
  if (Object.getPrototypeOf(reason) === Error.prototype) return message
  return null
}
