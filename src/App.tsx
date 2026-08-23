import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Film, LoaderCircle } from 'lucide-react'
import { AuthScreen } from './components/AuthScreen'
import { HouseholdSetup } from './components/HouseholdSetup'
import { LibraryApp } from './components/LibraryApp'
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

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(Boolean(data.session))
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setHousehold(null)
      setLoading(Boolean(nextSession))
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (demo) return
    if (!session) return
    getHousehold(session.user.id)
      .then(setHousehold)
      .finally(() => setLoading(false))
  }, [demo, session])

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
