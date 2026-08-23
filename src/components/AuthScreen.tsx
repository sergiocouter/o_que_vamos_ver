import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Film, LoaderCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface AuthScreenProps {
  onDemo: () => void
}

export function AuthScreen({ onDemo }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleGoogleLogin() {
    if (!supabase) return
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setLoading(false)
      setMessage('Não foi possível abrir o login do Google.')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setMessage(null)
    const result =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: name.trim() || email.split('@')[0] } },
          })
    setLoading(false)
    if (result.error) {
      setMessage(
        result.error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : result.error.message,
      )
      return
    }
    if (mode === 'signup' && !result.data.session) {
      setMessage('Conta criada! Confira seu e-mail para confirmar o acesso.')
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual" aria-label="Apresentação">
        <div className="auth-brand">
          <span className="brand-mark"><Film size={22} /></span>
          <span>O que vamos ver?</span>
        </div>
        <div className="auth-copy">
          <span className="eyebrow light">NOSSA LISTA, NOSSO SOFÁ</span>
          <h1>A dúvida acaba antes do play.</h1>
          <p>
            Tudo o que a família quer assistir, organizado e sempre à mão.
          </p>
          <div className="floating-cards" aria-hidden="true">
            <div className="float-poster poster-one"><span>FILME</span></div>
            <div className="float-poster poster-two"><span>SÉRIE</span></div>
            <div className="float-poster poster-three"><span>REALITY</span></div>
          </div>
        </div>
        <p className="auth-quote">“Agora ninguém vai esquecer aquela indicação boa.”</p>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="mobile-brand"><Film size={20} /> O que vamos ver?</span>
          <div>
            <span className="eyebrow">BEM-VINDO AO SOFÁ</span>
            <h2>{mode === 'signin' ? 'Entre na sua casa' : 'Crie seu acesso'}</h2>
            <p className="muted">
              {mode === 'signin'
                ? 'Use seu e-mail e senha para abrir a lista da família.'
                : 'Depois você poderá criar uma casa ou entrar com um convite.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <button type="button" className="google-button" onClick={handleGoogleLogin} disabled={loading}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.7 4.7 0 0 1-2 3v2.8h3.5c2-1.9 2.7-4.6 2.7-7.9Z"/>
                <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.8-2.4l-3.5-2.7c-1 .7-2.2 1-3.3 1a6 6 0 0 1-5.6-4.1H2.8v2.8A10.3 10.3 0 0 0 12 22Z"/>
                <path fill="#FBBC05" d="M6.4 13.8a6.2 6.2 0 0 1 0-3.6V7.4H2.8a10.2 10.2 0 0 0 0 9.2l3.6-2.8Z"/>
                <path fill="#EA4335" d="M12 6.1c1.6 0 3 .5 4.1 1.6l3.1-3A10 10 0 0 0 2.8 7.4l3.6 2.8A6 6 0 0 1 12 6Z"/>
              </svg>
              Continuar com Google
            </button>
            <div className="auth-divider"><span>ou entre com e-mail</span></div>
            {mode === 'signup' && (
              <label>
                Como podemos te chamar?
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              E-mail
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@email.com"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Senha
              <span className="password-field">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="No mínimo 8 caracteres"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="icon-button password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {message && <p className="form-message">{message}</p>}
            <button className="primary-button auth-submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={19} /> : null}
              {mode === 'signin' ? 'Entrar' : 'Criar conta'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'signin' ? 'Ainda não tem acesso?' : 'Já tem uma conta?'}{' '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}>
              {mode === 'signin' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
          <button className="demo-link" onClick={onDemo}>Explorar com dados de demonstração</button>
        </div>
      </section>
    </main>
  )
}
