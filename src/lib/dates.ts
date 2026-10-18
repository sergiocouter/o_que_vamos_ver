import type { LibraryItem } from '../types'

export const dayDiff = (value: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000))

// "hoje", "ontem", "há 5 dias", "há 3 meses", "há 1 ano"
export function relativeTime(value: string) {
  const days = dayDiff(value)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 60) return `há ${days} dias`
  const months = Math.floor(days / 30)
  if (months < 12) return `há ${months} meses`
  const years = Math.floor(days / 365)
  return years === 1 ? 'há 1 ano' : `há ${years} anos`
}

// Verdadeiro quando o título trocou de categoria depois de entrar na lista.
export const wasMoved = (item: Pick<LibraryItem, 'addedAt' | 'statusChangedAt'>) =>
  new Date(item.statusChangedAt).getTime() - new Date(item.addedAt).getTime() > 60_000
