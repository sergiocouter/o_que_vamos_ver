import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { disableReminders, enableReminders, getPushSupport, isSubscribed, remindersAvailable, resyncReminders } from '../lib/push'

export function ReminderToggle() {
  const [support, setSupport] = useState(getPushSupport)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    isSubscribed()
      .then((subscribed) => {
        if (!active) return
        setEnabled(subscribed)
        if (subscribed) void resyncReminders().catch(() => undefined)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  if (!remindersAvailable || support === 'unsupported') return null

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (enabled) {
        await disableReminders()
        setEnabled(false)
      } else {
        await enableReminders()
        setEnabled(true)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível mudar o lembrete agora.')
    } finally {
      setSupport(getPushSupport())
      setBusy(false)
    }
  }

  const status = busy
    ? enabled ? 'Desativando...' : 'Ativando...'
    : error ??
      (support === 'needs-install'
        ? 'No iPhone, instale o app na tela de início para ativar.'
        : support === 'denied'
          ? 'Notificações bloqueadas. Libere nas configurações do navegador.'
          : enabled
            ? 'Ativado neste aparelho'
            : 'Uma sugestão da lista Tem que ver')

  return (
    <button
      className={`reminder-card ${enabled ? 'on' : ''}`}
      role="switch"
      aria-checked={enabled}
      onClick={toggle}
      disabled={busy || support === 'needs-install'}
    >
      <span>{enabled ? <Bell size={18} /> : <BellOff size={18} />}</span>
      <span><strong>Lembrete diário às 19h</strong><small>{status}</small></span>
      <span className="reminder-switch" aria-hidden="true" />
    </button>
  )
}
