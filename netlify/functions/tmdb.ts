import type { Config } from '@netlify/functions'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
const IMAGE_SIZES = new Set(['w185', 'w342', 'w500', 'w780', 'w1280', 'original'])

type TmdbVideo = {
  key?: string
  name?: string
  site?: string
  type?: string
  official?: boolean
  iso_639_1?: string
  published_at?: string
}

function json(body: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
    },
  })
}

function pickTrailer(videos: TmdbVideo[]) {
  const candidates = videos
    .filter(
      (video) =>
        video.site === 'YouTube' &&
        typeof video.key === 'string' &&
        /^[A-Za-z0-9_-]{6,20}$/.test(video.key),
    )
    .map((video) => ({
      video,
      score:
        (video.type === 'Trailer' ? 100 : video.type === 'Teaser' ? 50 : 10) +
        (video.official ? 20 : 0) +
        (video.iso_639_1 === 'pt' ? 10 : video.iso_639_1 === 'en' ? 5 : 0),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(right.video.published_at ?? '').localeCompare(String(left.video.published_at ?? '')),
    )

  const selected = candidates[0]?.video
  return selected
    ? {
        key: selected.key,
        name: selected.name ?? 'Trailer oficial',
        site: 'YouTube' as const,
        type: selected.type ?? 'Trailer',
        official: Boolean(selected.official),
      }
    : null
}

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  if (action === 'image') {
    const path = url.searchParams.get('path')
    const size = url.searchParams.get('size') ?? 'w500'
    if (!path || !/^\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(path) || !IMAGE_SIZES.has(size)) {
      return json({ error: 'Imagem inválida.' }, 400)
    }

    try {
      const response = await fetch(`${TMDB_IMAGE_BASE_URL}/${size}${path}`)
      if (!response.ok || !response.body) return json({ error: 'Imagem não encontrada.' }, response.status)

      return new Response(response.body, {
        status: 200,
        headers: {
          'content-type': response.headers.get('content-type') ?? 'image/jpeg',
          'cache-control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400',
        },
      })
    } catch {
      return json({ error: 'Não foi possível carregar a imagem.' }, 502)
    }
  }

  const token = process.env.TMDB_API_TOKEN
  if (!token) return json({ error: 'A chave do catálogo ainda não foi configurada no Netlify.' }, 503)

  if (action === 'videos') {
    const type = url.searchParams.get('type')
    const id = url.searchParams.get('id')
    if (!['movie', 'tv'].includes(type ?? '') || !/^\d+$/.test(id ?? '')) {
      return json({ error: 'Título inválido.' }, 400)
    }

    try {
      const responses = await Promise.allSettled(
        ['pt-BR', 'en-US'].map(async (language) => {
          const endpoint = new URL(`${TMDB_BASE_URL}/${type}/${id}/videos`)
          endpoint.searchParams.set('language', language)
          const response = await fetch(endpoint, {
            headers: {
              accept: 'application/json',
              authorization: `Bearer ${token}`,
            },
          })
          if (!response.ok) return [] as TmdbVideo[]
          const payload = (await response.json()) as { results?: TmdbVideo[] }
          return payload.results ?? []
        }),
      )

      const uniqueVideos = new Map<string, TmdbVideo>()
      const availableVideos = responses.flatMap((response) =>
        response.status === 'fulfilled' ? response.value : [],
      )
      if (!responses.some((response) => response.status === 'fulfilled')) {
        return json({ error: 'Não foi possível carregar o trailer.' }, 502)
      }
      for (const video of availableVideos) {
        if (video.key) uniqueVideos.set(video.key, video)
      }
      return json(
        { trailer: pickTrailer([...uniqueVideos.values()]) },
        200,
        'public, max-age=300, s-maxage=86400',
      )
    } catch {
      return json({ error: 'Não foi possível carregar o trailer.' }, 502)
    }
  }

  let endpoint: URL

  if (action === 'search') {
    const query = url.searchParams.get('query')?.trim()
    if (!query || query.length < 2) return json({ error: 'Digite pelo menos 2 caracteres.' }, 400)
    endpoint = new URL(`${TMDB_BASE_URL}/search/multi`)
    endpoint.searchParams.set('query', query.slice(0, 120))
    endpoint.searchParams.set('include_adult', 'false')
    endpoint.searchParams.set('language', 'pt-BR')
    endpoint.searchParams.set('page', '1')
  } else if (action === 'details') {
    const type = url.searchParams.get('type')
    const id = url.searchParams.get('id')
    if (!['movie', 'tv'].includes(type ?? '') || !/^\d+$/.test(id ?? '')) {
      return json({ error: 'Título inválido.' }, 400)
    }
    endpoint = new URL(`${TMDB_BASE_URL}/${type}/${id}`)
    endpoint.searchParams.set('language', 'pt-BR')
  } else {
    return json({ error: 'Ação inválida.' }, 400)
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json()
    if (!response.ok) return json({ error: 'O catálogo externo não respondeu como esperado.' }, response.status)
    return json(data, 200, 'public, max-age=300, s-maxage=86400')
  } catch {
    return json({ error: 'Não foi possível acessar o catálogo externo.' }, 502)
  }
}

export const config: Config = {
  method: 'GET',
}
