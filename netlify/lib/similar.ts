// "Parecidos com este": recomendações do TMDB (quem viu também viu) e, sem elas,
// os títulos semelhantes (mesmo gênero e tema).

export const SIMILAR_LIMIT = 12

export type RawSimilarItem = {
  id: number
  media_type?: string
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
  popularity?: number
  adult?: boolean
}

export type SimilarItem = RawSimilarItem & { media_type: 'movie' | 'tv' }

function clean(type: 'movie' | 'tv', sourceId: number, items: RawSimilarItem[]): SimilarItem[] {
  const seen = new Set<string>()
  const result: SimilarItem[] = []
  for (const item of items) {
    const mediaType = item.media_type ?? type
    if (mediaType !== 'movie' && mediaType !== 'tv') continue
    if (item.adult || !item.poster_path) continue
    if (mediaType === type && item.id === sourceId) continue
    const key = `${mediaType}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ ...item, media_type: mediaType })
  }
  return result
}

export function pickSimilar(
  type: 'movie' | 'tv',
  sourceId: number,
  recommendations: RawSimilarItem[],
  similar: RawSimilarItem[],
): SimilarItem[] {
  const recommended = clean(type, sourceId, recommendations)
  const chosen = recommended.length ? recommended : clean(type, sourceId, similar)
  return chosen.slice(0, SIMILAR_LIMIT)
}
