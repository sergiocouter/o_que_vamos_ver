import { demoItems } from '../data/demo'
import { supabase } from '../lib/supabase'
import { averageRating, buildRatings, type PersonRating, type RatingRow } from '../lib/ratings'
import type { Household, LibraryItem, MediaType, SeasonProgress, WatchStatus } from '../types'

const STORAGE_KEY = 'oqvv-demo-library-v1'

type TitleRow = {
  id: string
  household_id: string
  tmdb_id: number | null
  media_type: MediaType
  title: string
  original_title: string | null
  overview: string | null
  poster_url: string | null
  backdrop_url: string | null
  release_year: number | null
  genres: string[] | null
  total_seasons: number | null
  total_episodes: number | null
  current_season: number | null
  watched_episodes: number | null
  season_progress: SeasonProgress[] | null
  status: WatchStatus
  notes: string | null
  recommended_by: string | null
  added_by: string | null
  added_at: string
  status_changed_at: string
  started_at: string | null
  watched_at: string | null
}

function fromRow(row: TitleRow, addedByName?: string, ratings: PersonRating[] = []): LibraryItem {
  return {
    id: row.id,
    householdId: row.household_id,
    tmdbId: row.tmdb_id ?? undefined,
    mediaType: row.media_type,
    title: row.title,
    originalTitle: row.original_title ?? undefined,
    overview: row.overview ?? '',
    posterUrl: row.poster_url ?? undefined,
    backdropUrl: row.backdrop_url ?? undefined,
    releaseYear: row.release_year ?? undefined,
    genres: row.genres ?? [],
    totalSeasons: row.total_seasons ?? undefined,
    totalEpisodes: row.total_episodes ?? undefined,
    currentSeason: row.current_season ?? undefined,
    watchedEpisodes: row.watched_episodes ?? undefined,
    seasonProgress: row.season_progress ?? undefined,
    status: row.status,
    rating: averageRating(ratings),
    ratings,
    notes: row.notes ?? undefined,
    recommendedBy: row.recommended_by ?? undefined,
    addedById: row.added_by ?? undefined,
    addedByName,
    addedAt: row.added_at,
    statusChangedAt: row.status_changed_at,
    startedAt: row.started_at ?? undefined,
    watchedAt: row.watched_at ?? undefined,
  }
}

function toRow(item: LibraryItem, householdId: string, userId?: string) {
  return {
    household_id: householdId,
    tmdb_id: item.tmdbId ?? null,
    media_type: item.mediaType,
    title: item.title,
    original_title: item.originalTitle ?? null,
    overview: item.overview,
    poster_url: item.posterUrl ?? null,
    backdrop_url: item.backdropUrl ?? null,
    release_year: item.releaseYear ?? null,
    genres: item.genres,
    total_seasons: item.totalSeasons ?? null,
    total_episodes: item.totalEpisodes ?? null,
    current_season: item.currentSeason ?? null,
    watched_episodes: item.watchedEpisodes ?? 0,
    season_progress: item.seasonProgress ?? [],
    status: item.status,
    notes: item.notes ?? null,
    recommended_by: item.recommendedBy ?? null,
    ...(userId ? { added_by: userId } : {}),
    added_at: item.addedAt,
    status_changed_at: item.statusChangedAt,
    started_at: item.startedAt ?? null,
    watched_at: item.watchedAt ?? null,
  }
}

// Demonstração: a pessoa é sempre "Sérgio" (id 'demo'); notas antigas viram notas dele.
export const DEMO_USER_ID = 'demo'

function withDemoRatings(item: LibraryItem): LibraryItem {
  const ratings = item.ratings ?? (item.rating ? [{ userId: DEMO_USER_ID, name: 'Sérgio', rating: item.rating }] : [])
  return { ...item, ratings, rating: averageRating(ratings) }
}

function getDemoItems(): LibraryItem[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoItems))
    return demoItems.map(withDemoRatings)
  }
  try {
    return (JSON.parse(stored) as LibraryItem[]).map(withDemoRatings)
  } catch {
    return demoItems.map(withDemoRatings)
  }
}

function setDemoItems(items: LibraryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export async function getHousehold(userId: string): Promise<Household | null> {
  if (!supabase) return { id: 'demo', name: 'Casa da família', inviteCode: 'DEMO26' }

  const { data, error } = await supabase
    .from('household_members')
    .select('households(id, name, invite_code)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const raw = data?.households as unknown as
    | { id: string; name: string; invite_code: string }
    | null
  return raw ? { id: raw.id, name: raw.name, inviteCode: raw.invite_code } : null
}

export async function createHousehold(name: string): Promise<Household> {
  if (!supabase) return { id: 'demo', name, inviteCode: 'DEMO26' }
  const { data, error } = await supabase.rpc('create_household', {
    household_name: name,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as {
    id: string
    name: string
    invite_code: string
  }
  return { id: row.id, name: row.name, inviteCode: row.invite_code }
}

export async function joinHousehold(inviteCode: string): Promise<Household> {
  if (!supabase)
    return {
      id: 'demo',
      name: 'Casa da família',
      inviteCode: inviteCode.replace(/\s+/g, '').toUpperCase(),
    }
  const { data, error } = await supabase.rpc('join_household', {
    code: inviteCode.replace(/\s+/g, '').toUpperCase(),
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as {
    id: string
    name: string
    invite_code: string
  }
  return { id: row.id, name: row.name, inviteCode: row.invite_code }
}

export async function listItems(householdId: string): Promise<LibraryItem[]> {
  if (!supabase) return getDemoItems()
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .eq('household_id', householdId)
    .order('status_changed_at', { ascending: false })
  if (error) throw error
  const rows = data as TitleRow[]
  let ratingRows: RatingRow[] = []
  if (rows.length) {
    const { data: ratingData, error: ratingsError } = await supabase
      .from('title_ratings')
      .select('title_id, user_id, rating, rated_at')
      .in('title_id', rows.map((row) => row.id))
    if (ratingsError) throw ratingsError
    ratingRows = ratingData as RatingRow[]
  }
  const profileIds = [
    ...new Set([
      ...rows.flatMap((row) => (row.added_by ? [row.added_by] : [])),
      ...ratingRows.map((row) => row.user_id),
    ]),
  ]
  const namesById = new Map<string, string>()

  if (profileIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', profileIds)
    if (profilesError) throw profilesError
    for (const profile of profiles as { id: string; display_name: string }[]) {
      namesById.set(profile.id, profile.display_name)
    }
  }

  const ratingsByTitle = buildRatings(ratingRows, namesById)
  return rows.map((row) =>
    fromRow(row, row.added_by ? namesById.get(row.added_by) : undefined, ratingsByTitle.get(row.id)),
  )
}

export async function addItem(
  item: LibraryItem,
  householdId: string,
  userId?: string,
  addedByName?: string,
): Promise<LibraryItem> {
  if (!supabase) {
    const saved = { ...item, id: crypto.randomUUID(), addedByName }
    setDemoItems([saved, ...getDemoItems()])
    return saved
  }
  const { data, error } = await supabase
    .from('titles')
    .insert(toRow(item, householdId, userId))
    .select()
    .single()
  if (error) throw error
  return fromRow(data as TitleRow, addedByName)
}

export async function updateItem(
  item: LibraryItem,
  householdId: string,
): Promise<LibraryItem> {
  if (!supabase) {
    const items = getDemoItems().map((entry) => (entry.id === item.id ? item : entry))
    setDemoItems(items)
    return item
  }
  const { data, error } = await supabase
    .from('titles')
    .update(toRow(item, householdId))
    .eq('id', item.id)
    .eq('household_id', householdId)
    .select()
    .single()
  if (error) throw error
  return fromRow(data as TitleRow, item.addedByName, item.ratings)
}

/** Grava (ou apaga, com `null`) a nota da própria pessoa. Na demonstração, a nota já vai em updateItem. */
export async function saveMyRating(titleId: string, userId: string, rating: number | null) {
  if (!supabase) return
  if (rating === null) {
    const { error } = await supabase.from('title_ratings').delete().eq('title_id', titleId).eq('user_id', userId)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('title_ratings')
    .upsert({ title_id: titleId, user_id: userId, rating, rated_at: new Date().toISOString() })
  if (error) throw error
}

export async function removeItem(itemId: string, householdId: string) {
  if (!supabase) {
    setDemoItems(getDemoItems().filter((item) => item.id !== itemId))
    return
  }
  const { error } = await supabase
    .from('titles')
    .delete()
    .eq('id', itemId)
    .eq('household_id', householdId)
  if (error) throw error
}

export function withNewStatus(item: LibraryItem, status: WatchStatus): LibraryItem {
  const now = new Date().toISOString()
  return {
    ...item,
    status,
    statusChangedAt: now,
    startedAt: status === 'watching' && !item.startedAt ? now : item.startedAt,
    watchedAt: status === 'watched' ? now : item.watchedAt,
  }
}
