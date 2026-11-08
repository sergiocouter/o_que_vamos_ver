import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Film, LoaderCircle, RefreshCw } from 'lucide-react'
import { AuthScreen } from './components/AuthScreen'
import { HouseholdSetup } from './components/HouseholdSetup'
import { LibraryApp } from './components/LibraryApp'
import { errorMessage } from './lib/errors'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { getHousehold } from './services/library'
import type { Household } from './types'

const DEMO_HOUSEHOLD: Household = { id: 'demo', name: 'Casa da família', inviteCode: 'SOFA26' }

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [household, setHousehold] = useState<Household | null>(
    isSupabaseConfigured ? null : DEMO_HOUSEHOLD,
  )
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [demo, setDemo] = useState(!isSupabaseConfigured)
  // Falha ao buscar a casa (ex.: sem internet): não pode virar a tela de "Criar casa".
  const [householdError, setHouseholdError] = useState<string | null>(null)
  const [householdAttempt, setHouseholdAttempt] = useState(0)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(Boolean(data.session))
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setHousehold(null)
      setHouseholdError(null)
      setLoading(Boolean(nextSession))
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (demo) return
    if (!session) return
    getHousehold(session.user.id)
      .then((found) => {
        setHousehold(found)
        setHouseholdError(null)
      })
      .catch((reason: unknown) =>
        setHouseholdError(errorMessage(reason, 'Não foi possível carregar a sua casa.')),
      )
      .finally(() => setLoading(false))
  }, [demo, session, householdAttempt])

  function retryHousehold() {
    setHouseholdError(null)
    setLoading(true)
    setHouseholdAttempt((attempt) => attempt + 1)
  }

  async function signOut() {
    if (demo) {
      setDemo(false)
      setHousehold(null)
      return
    }
    await supabase?.auth.signOut()
  }

  function enterDemo() {
    setHousehold(DEMO_HOUSEHOLD)
    setDemo(true)
  }

  if (loading) {
    return <main className="app-loading"><span className="brand-mark"><Film size={23} /></span><LoaderCircle className="spin" size={24} /><p>Arrumando o sofá...</p></main>
  }

  if (!demo && !session) return <AuthScreen onDemo={enterDemo} />

  if (!demo && householdError) {
    return (
      <main className="app-loading">
        <span className="brand-mark"><Film size={23} /></span>
        <p>{householdError}</p>
        <button type="button" className="primary-button" onClick={retryHousehold}>
          <RefreshCw size={18} /> Tentar de novo
        </button>
      </main>
    )
  }

  if (!household) return <HouseholdSetup onReady={setHousehold} />

  const displayName = demo
    ? 'Sérgio'
    : String(session?.user.user_metadata.display_name ?? session?.user.user_metadata.full_name ?? session?.user.email?.split('@')[0] ?? 'Você')

  return (
    <LibraryApp
      household={household}
      userId={session?.user.id}
      displayName={displayName}
      isDemo={demo}
      onSignOut={signOut}
    />
  )
}

export default App
