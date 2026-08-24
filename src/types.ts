export type WatchStatus = 'watchlist' | 'watching' | 'watched'
export type MediaType = 'movie' | 'tv' | 'reality'

export interface SeasonProgress {
  seasonNumber: number
  name: string
  episodeCount: number
  watchedEpisodes: number
  completed: boolean
}

export interface LibraryItem {
  id: string
  householdId?: string
  tmdbId?: number
  mediaType: MediaType
  title: string
  originalTitle?: string
  overview: string
  posterUrl?: string
  backdropUrl?: string
  releaseYear?: number
  genres: string[]
  totalSeasons?: number
  totalEpisodes?: number
  currentSeason?: number
  watchedEpisodes?: number
  seasonProgress?: SeasonProgress[]
  status: WatchStatus
  rating?: number
  notes?: string
  recommendedBy?: string
  addedById?: string
  addedByName?: string
  addedAt: string
  statusChangedAt: string
  startedAt?: string
  watchedAt?: string
}

export interface SearchResult {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  originalTitle?: string
  overview: string
  posterUrl?: string
  backdropUrl?: string
  releaseYear?: number
  genreIds: number[]
  popularity?: number
}

export interface Household {
  id: string
  name: string
  inviteCode: string
}

export const STATUS_LABELS: Record<WatchStatus, string> = {
  watchlist: 'Tem que ver',
  watching: 'Tô vendo',
  watched: 'Já vi',
}

export const MEDIA_LABELS: Record<MediaType, string> = {
  movie: 'Filme',
  tv: 'Série',
  reality: 'Reality',
}
