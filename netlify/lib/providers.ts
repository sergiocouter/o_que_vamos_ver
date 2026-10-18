type RawProvider = { provider_id: number; provider_name: string; display_priority?: number; logo_path?: string | null }

/** Um país dentro da resposta de `/watch/providers` do TMDB (dados do JustWatch). */
export type RawCountryProviders = {
  link?: string
  flatrate?: RawProvider[]
  rent?: RawProvider[]
  buy?: RawProvider[]
}

export type Provider = { id: number; name: string; logo: string | null }
export type WatchProviders = { link: string | null; flatrate: Provider[]; rent: Provider[]; buy: Provider[] }

// Variantes do mesmo serviço: "Netflix Standard with Ads", "Apple TV Amazon Channel".
const VARIANT_SUFFIX = /\s+(?:standard with ads|with ads|amazon channel)$/i

const logoUrl = (path?: string | null) =>
  path ? `/.netlify/functions/tmdb?action=image&size=w92&path=${encodeURIComponent(path)}` : null

function cleanList(list: RawProvider[] = []): Provider[] {
  const valid = list.filter((item) => typeof item.provider_name === 'string' && item.provider_name.trim())
  const names = new Set(valid.map((item) => item.provider_name.toLowerCase()))
  const seen = new Set<number>()
  return valid
    .filter((item) => {
      const base = item.provider_name.replace(VARIANT_SUFFIX, '')
      // A variante só some quando o serviço principal também aparece.
      return base === item.provider_name || !names.has(base.toLowerCase())
    })
    .sort((left, right) => (left.display_priority ?? 999) - (right.display_priority ?? 999))
    .filter((item) => !seen.has(item.provider_id) && seen.add(item.provider_id))
    .map((item) => ({ id: item.provider_id, name: item.provider_name, logo: logoUrl(item.logo_path) }))
}

export function normalizeProviders(country: RawCountryProviders | undefined): WatchProviders {
  return {
    link: country?.link ?? null,
    flatrate: cleanList(country?.flatrate),
    rent: cleanList(country?.rent),
    buy: cleanList(country?.buy),
  }
}
