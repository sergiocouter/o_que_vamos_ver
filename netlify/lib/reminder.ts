export type ReminderTitle = {
  id: string
  title: string
  addedAt: string
  posterUrl: string | null
}

const MS_PER_DAY = 86_400_000
const brasiliaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data `YYYY-MM-DD` no fuso de Brasília. */
export function brasiliaDate(date: Date) {
  return brasiliaFormatter.format(date)
}

/**
 * Sorteia um título sem repetir os `N - 1` lembretes mais recentes (N = tamanho da lista),
 * o que faz o rodízio passar por todos antes de repetir.
 * `recentTitleIds` vem do mais recente para o mais antigo.
 */
export function pickReminderTitle(
  watchlist: ReminderTitle[],
  recentTitleIds: string[],
  random: () => number = Math.random,
): ReminderTitle | null {
  if (!watchlist.length) return null
  const excluded = new Set(recentTitleIds.slice(0, watchlist.length - 1))
  const candidates = watchlist.filter((item) => !excluded.has(item.id))
  const pool = candidates.length ? candidates : watchlist
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

export function buildReminderMessage(item: Pick<ReminderTitle, 'title' | 'addedAt'>, now: Date) {
  const days = Math.max(
    0,
    Math.round((Date.parse(brasiliaDate(now)) - Date.parse(brasiliaDate(new Date(item.addedAt)))) / MS_PER_DAY),
  )
  const when = days === 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`
  return {
    title: 'O que vamos ver hoje? 🍿',
    body: `${item.title} foi adicionado ${when} e ainda não foi visto. Que tal dar o play?`,
  }
}
