import { useState, type FormEvent } from 'react'
import { ArrowRight, Home, KeyRound, LoaderCircle } from 'lucide-react'
import { createHousehold, joinHousehold } from '../services/library'
import type { Household } from '../types'

interface HouseholdSetupProps {
  onReady: (household: Household) => void
}

export function HouseholdSetup({ onReady }: HouseholdSetupProps) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!mode) return
    setLoading(true)
    setError(null)
    try {
      const household =
        mode === 'create'
          ? await createHousehold(value.trim() || 'Nossa casa')
          : await joinHousehold(value)
      onReady(household)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível continuar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="setup-shell">
      <div className="setup-card">
        <span className="setup-icon"><Home size={28} /></span>
        <span className="eyebrow">PRIMEIRO ACESSO</span>
        <h1>Onde fica o seu sofá?</h1>
        <p className="muted">
          Crie a lista da sua casa ou entre na lista de alguém da família.
        </p>
        <div className="segmented setup-tabs">
          <button
            type="button"
            className={mode === 'create' ? 'active' : ''}
            onClick={() => {
              setMode('create')
              setValue('')
              setError(null)
            }}
          >
            Criar nova casa
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'active' : ''}
            onClick={() => {
              setMode('join')
              setValue('')
              setError(null)
            }}
          >
            Entrar com código
          </button>
        </div>
        {!mode && (
          <p className="setup-choice-hint">
            Se alguém da família já criou a casa, escolha <strong>Entrar com código</strong>.
          </p>
        )}
        {mode && (
          <form onSubmit={submit}>
            <label>
              {mode === 'create' ? 'Nome da nova casa' : 'Código do convite recebido'}
              <span className="input-with-icon">
                {mode === 'create' ? <Home size={18} /> : <KeyRound size={18} />}
                <input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={mode === 'create' ? 'Ex.: Casa Silva' : 'Ex.: SOFA26'}
                  autoCapitalize={mode === 'join' ? 'characters' : undefined}
                  required
                />
              </span>
            </label>
            {error && <p className="form-message">{error}</p>}
            <button className="primary-button" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : null}
              {mode === 'create' ? 'Criar casa' : 'Entrar na casa'} <ArrowRight size={18} />
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
