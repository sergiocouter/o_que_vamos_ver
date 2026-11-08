// Nota de cada pessoa: uma linha por pessoa e título em `title_ratings`; a nota da casa é a média.

export interface PersonRating {
  userId: string
  name: string
  rating: number
}

export type RatingRow = { title_id: string; user_id: string; rating: number; rated_at: string }

/** Média com uma casa decimal; `undefined` quando ninguém deu nota. */
export function averageRating(ratings: readonly PersonRating[]): number | undefined {
  if (!ratings.length) return undefined
  const sum = ratings.reduce((total, entry) => total + entry.rating, 0)
  return Math.round((sum / ratings.length) * 10) / 10
}

export const formatRating = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** Notas agrupadas por título, com o nome de cada pessoa, da mais antiga para a mais recente. */
export function buildRatings(rows: readonly RatingRow[], namesById: ReadonlyMap<string, string>) {
  const byTitle = new Map<string, PersonRating[]>()
  const sorted = [...rows].sort((a, b) => a.rated_at.localeCompare(b.rated_at))
  for (const row of sorted) {
    const list = byTitle.get(row.title_id) ?? []
    list.push({ userId: row.user_id, name: namesById.get(row.user_id) ?? 'Alguém', rating: row.rating })
    byTitle.set(row.title_id, list)
  }
  return byTitle
}

/** Lista de notas com a minha aplicada (`null` apaga). As notas das outras pessoas não mudam. */
export function withMyRating(
  ratings: readonly PersonRating[],
  userId: string,
  name: string,
  rating: number | null,
): PersonRating[] {
  const exists = ratings.some((entry) => entry.userId === userId)
  if (rating === null) return ratings.filter((entry) => entry.userId !== userId)
  if (exists) return ratings.map((entry) => (entry.userId === userId ? { ...entry, rating } : entry))
  return [...ratings, { userId, name, rating }]
}
