import type { LibraryItem } from '../types'

export interface DailyRecommendation {
  item: LibraryItem
  reason: string
}

const MS_PER_DAY = 86_400_000

const daysSince = (value: string, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / MS_PER_DAY))

const localDayNumber = (date: Date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY)

function genrePreferences(items: LibraryItem[]) {
  const weights = new Map<string, number>()
  items
    .filter((item) => item.status === 'watched')
    .forEach((item) => {
      const ratingWeight = item.rating ?? 3
      item.genres.forEach((genre) => {
        weights.set(genre, (weights.get(genre) ?? 0) + ratingWeight)
      })
    })
  return weights
}

export function getDailyRecommendation(
  items: LibraryItem[],
  now = new Date(),
): DailyRecommendation | undefined {
  if (!items.length) return undefined

  const watchlist = items.filter((item) => item.status === 'watchlist')
  const watching = items.filter((item) => item.status === 'watching')
  const candidates = watchlist.length ? watchlist : watching.length ? watching : items
  const preferences = genrePreferences(items)
  const currentYear = now.getFullYear()

  const ranked = candidates
    .map((item) => {
      const waitingDays = daysSince(item.addedAt, now)
      const affinity = item.genres.reduce(
        (total, genre) => total + (preferences.get(genre) ?? 0),
        0,
      )
      const recentRelease = item.releaseYear && item.releaseYear >= currentYear - 1 ? 18 : 0
      const rating = item.status === 'watched' ? (item.rating ?? 0) * 12 : 0
      return {
        item,
        waitingDays,
        affinity,
        score: Math.min(waitingDays, 180) + affinity * 2 + recentRelease + rating,
      }
    })
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'pt-BR'))

  const rotation = ranked.slice(0, Math.min(5, ranked.length))
  const selected = rotation[localDayNumber(now) % rotation.length]

  let reason: string
  if (selected.item.status === 'watching') {
    reason = 'Já está em andamento — uma boa pedida para continuar hoje.'
  } else if (selected.item.status === 'watched') {
    reason = selected.item.rating
      ? `Levou ${selected.item.rating}/5 no termômetro da casa. Vale uma reprise.`
      : 'Já passou pelo sofá e entrou no rodízio para rever.'
  } else if (selected.waitingDays >= 30) {
    reason = `Está há ${selected.waitingDays} dias na lista. Hoje é um ótimo dia para desencalhar.`
  } else if (selected.affinity > 0) {
    reason = 'Combina com gêneros que vocês já curtiram por aqui.'
  } else if (selected.item.releaseYear && selected.item.releaseYear >= currentYear - 1) {
    reason = 'É uma das novidades da lista e ganhou o rodízio de hoje.'
  } else {
    reason = 'Foi a escolhida de hoje no rodízio da lista da casa.'
  }

  return { item: selected.item, reason }
}
