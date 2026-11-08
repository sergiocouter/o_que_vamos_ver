const OFFLINE_MESSAGE = 'Sem conexão com a internet. Verifique a rede e tente de novo.'

/**
 * Texto para mostrar ao usuário a partir de qualquer erro capturado.
 * Os erros do Supabase chegam como objetos comuns com `message`, não como `Error`.
 */
export function errorMessage(reason: unknown, fallback: string): string {
  const message =
    typeof reason === 'string'
      ? reason
      : reason && typeof reason === 'object' && 'message' in reason
        ? (reason as { message: unknown }).message
        : null
  if (typeof message !== 'string' || !message.trim()) return fallback
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return OFFLINE_MESSAGE
  return message
}
