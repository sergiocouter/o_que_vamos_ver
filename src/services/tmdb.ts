import type { MediaType, SearchResult } from '../types'

type TmdbSearchItem = {
  id: number
  media_type: 'movie' | 'tv' | 'person'
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
}

const imageUrl = (path?: string | null, size = 'w500') =>
  path
    ? `/.netlify/functions/tmdb?action=image&size=${size}&path=${encodeURIComponent(path)}`
    : undefined

export function normalizeTmdbImageUrl(src?: string) {
  if (!src) return undefined
  const match = src.match(
    /^https:\/\/image\.tmdb\.org\/t\/p\/(w\d+|original)(\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp))$/i,
  )
  return match ? imageUrl(match[2], match[1]) : src
}

export async function searchTitles(query: string): Promise<SearchResult[]> {
  const response = await fetch(
    `/.netlify/functions/tmdb?action=search&query=${encodeURIComponent(query)}`,
  )
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Não foi possível consultar o catálogo agora.')
  }
  const payload = (await response.json()) as { results: TmdbSearchItem[] }
  return payload.results
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map((item) => ({
      tmdbId: item.id,
      mediaType: item.media_type as 'movie' | 'tv',
      title: item.title ?? item.name ?? 'Sem título',
      originalTitle: item.original_title ?? item.original_name,
      overview: item.overview ?? '',
      posterUrl: imageUrl(item.poster_path),
      backdropUrl: imageUrl(item.backdrop_path, 'w1280'),
      releaseYear: Number(
        (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
      ) || undefined,
      genreIds: item.genre_ids ?? [],
      popularity: item.popularity,
    }))
}

type TmdbDetails = {
  number_of_seasons?: number
  number_of_episodes?: number
  genres?: { id: number; name: string }[]
  runtime?: number
  episode_run_time?: number[]
  seasons?: { season_number: number; name: string; episode_count: number }[]
}

export type TmdbTrailer = {
  key: string
  name: string
  site: 'YouTube'
  type: string
  official: boolean
}

export async function getTitleDetails(
  tmdbId: number,
  mediaType: Exclude<MediaType, 'reality'> | 'reality',
): Promise<TmdbDetails> {
  const remoteType = mediaType === 'movie' ? 'movie' : 'tv'
  const response = await fetch(
    `/.netlify/functions/tmdb?action=details&type=${remoteType}&id=${tmdbId}`,
  )
  if (!response.ok) return {}
  return (await response.json()) as TmdbDetails
}

export type WatchProvider = { id: number; name: string; logo: string | null }
export type WatchProviders = { link: string | null; flatrate: WatchProvider[]; rent: WatchProvider[]; buy: WatchProvider[] }

// Cartão e tela do título pedem o mesmo dado: uma consulta por título enquanto o app está aberto.
const providersCache = new Map<string, Promise<WatchProviders>>()

export function getWatchProviders(tmdbId: number, mediaType: MediaType): Promise<WatchProviders> {
  const remoteType = mediaType === 'movie' ? 'movie' : 'tv'
  const key = `${remoteType}:${tmdbId}`
  let request = providersCache.get(key)
  if (!request) {
    request = fetch(`/.netlify/functions/tmdb?action=providers&type=${remoteType}&id=${tmdbId}`).then((response) => {
      if (!response.ok) throw new Error('Não foi possível consultar onde assistir agora.')
      return response.json() as Promise<WatchProviders>
    })
    request.catch(() => providersCache.delete(key))
    providersCache.set(key, request)
  }
  return request
}

export async function getTitleTrailer(
  tmdbId: number,
  mediaType: MediaType,
  signal?: AbortSignal,
  season?: number,
): Promise<TmdbTrailer | null> {
  const remoteType = mediaType === 'movie' ? 'movie' : 'tv'
  const seasonQuery = season && remoteType === 'tv' ? `&season=${season}` : ''
  const response = await fetch(
    `/.netlify/functions/tmdb?action=videos&type=${remoteType}&id=${tmdbId}${seasonQuery}`,
    { signal },
  )
  if (!response.ok) throw new Error('Não foi possível carregar o trailer agora.')
  const payload = (await response.json()) as { trailer?: TmdbTrailer | null }
  return payload.trailer ?? null
}
