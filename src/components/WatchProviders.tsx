import { useEffect, useState } from 'react'
import { ExternalLink, LoaderCircle } from 'lucide-react'
import type { MediaType } from '../types'
import { getWatchProviders, type WatchProvider, type WatchProviders } from '../services/tmdb'

interface ProvidersProps {
  tmdbId: number
  mediaType: MediaType
}

type ProvidersState = { key: string; data?: WatchProviders; error?: boolean }

/** `undefined` enquanto carrega. */
function useWatchProviders(tmdbId: number, mediaType: MediaType) {
  const key = `${mediaType}:${tmdbId}`
  const [state, setState] = useState<ProvidersState | null>(null)

  useEffect(() => {
    let active = true
    getWatchProviders(tmdbId, mediaType)
      .then((data) => active && setState({ key, data }))
      .catch(() => active && setState({ key, error: true }))
    return () => { active = false }
  }, [key, mediaType, tmdbId])

  return state?.key === key ? state : undefined
}

function ProviderLogo({ provider }: { provider: WatchProvider }) {
  return provider.logo
    ? <img src={provider.logo} alt={provider.name} title={provider.name} loading="lazy" />
    : <span className="provider-fallback" title={provider.name}>{provider.name.slice(0, 1)}</span>
}

/** Logos dos streamings de assinatura no cartão da lista (até 3). */
export function CardProviders({ tmdbId, mediaType }: ProvidersProps) {
  const providers = useWatchProviders(tmdbId, mediaType)?.data?.flatrate.slice(0, 3) ?? []
  if (!providers.length) return null
  return (
    <span className="card-providers">
      {providers.map((provider) => <ProviderLogo key={provider.id} provider={provider} />)}
    </span>
  )
}

/** Seção "Onde assistir" na tela do título. */
export function WatchProvidersSection({ tmdbId, mediaType }: ProvidersProps) {
  const state = useWatchProviders(tmdbId, mediaType)
  const groups = state?.data
    ? ([
        ['Assinatura', state.data.flatrate],
        ['Alugar', state.data.rent],
        ['Comprar', state.data.buy],
      ] as const).filter(([, list]) => list.length)
    : []

  return (
    <section className="providers-section">
      <div className="section-heading-line">
        <h3>Onde assistir</h3>
        <span>BRASIL</span>
      </div>
      {!state ? (
        <div className="trailer-state"><LoaderCircle className="spin" size={20} /> Procurando nos streamings...</div>
      ) : state.error ? (
        <div className="trailer-state">Não foi possível consultar onde assistir agora.</div>
      ) : !groups.length ? (
        <div className="trailer-state">Não encontramos este título em streamings no Brasil.</div>
      ) : (
        <>
          {groups.map(([label, list]) => (
            <div className="provider-group" key={label}>
              <h4>{label}</h4>
              <div className="provider-list">
                {list.map((provider) => (
                  <span className="provider" key={provider.id}>
                    <ProviderLogo provider={provider} />
                    <small>{provider.name}</small>
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="providers-footer">
            {state.data?.link && (
              <a className="providers-link" href={state.data.link} target="_blank" rel="noopener noreferrer">
                Ver opções <ExternalLink size={13} />
              </a>
            )}
            <small>Dados: JustWatch</small>
          </div>
        </>
      )}
    </section>
  )
}
