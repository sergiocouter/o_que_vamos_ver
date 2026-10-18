import { supabase } from './supabase'

export type PushSupport = 'unsupported' | 'needs-install' | 'denied' | 'default' | 'granted'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** O lembrete só existe quando há chave VAPID e Supabase (fora do modo demonstração). */
export const remindersAvailable = Boolean(vapidPublicKey && supabase)

export function getPushSupport(): PushSupport {
  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  // No iPhone o push só existe com o app instalado na tela de início.
  if (isIos && !standalone) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function base64UrlToBytes(value: string) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

async function readyRegistration() {
  const timeout = new Promise<never>((_, reject) =>
    window.setTimeout(() => reject(new Error('Não foi possível preparar as notificações. Recarregue o app e tente de novo.')), 10_000),
  )
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export async function isSubscribed() {
  if (getPushSupport() !== 'granted') return false
  const registration = await navigator.serviceWorker.getRegistration()
  return Boolean(await registration?.pushManager.getSubscription())
}

export async function enableReminders() {
  if (!supabase || !vapidPublicKey) throw new Error('Lembrete indisponível neste momento.')

  const permission = await Notification.requestPermission()
  if (permission === 'denied') throw new Error('Notificações bloqueadas. Libere nas configurações do navegador.')
  if (permission !== 'granted') throw new Error('Permissão não concedida. Toque de novo ou libere nas configurações.')

  const registration = await readyRegistration()
  let subscription: PushSubscription
  try {
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidPublicKey) }))
  } catch {
    throw new Error('Não foi possível ativar as notificações neste aparelho. Tente de novo mais tarde.')
  }

  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys?.p256dh,
    p_auth: keys?.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) {
    await subscription.unsubscribe().catch(() => undefined)
    throw new Error('Não foi possível ativar o lembrete agora. Tente de novo em instantes.')
  }

  await registration.showNotification('Lembrete ativado! 🍿', {
    body: 'Todo dia às 19h a gente sugere um título da lista Tem que ver.',
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    tag: 'lembrete-ativado',
  })
}

/**
 * Reenvia a inscrição já existente no aparelho para a conta logada: corrige o dono quando outra
 * conta usou o mesmo aparelho e recria a linha se o servidor a tiver apagado.
 */
export async function resyncReminders() {
  if (!supabase || getPushSupport() !== 'granted') return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const { endpoint, keys } = subscription.toJSON()
  await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys?.p256dh,
    p_auth: keys?.auth,
    p_user_agent: navigator.userAgent,
  })
}

export async function disableReminders() {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  // Mesmo se a remoção no banco falhar, a função diária apaga a inscrição quando o push voltar 410.
  await supabase?.rpc('delete_push_subscription', { p_endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}
