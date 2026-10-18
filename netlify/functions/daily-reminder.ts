import type { Config } from '@netlify/functions'
import webpush from 'web-push'
import { runDailyReminders, type SendResult } from '../lib/daily-run.ts'
import { createStore } from '../lib/supabase-store.ts'

// Lembrete diário: 22h UTC = 19h em Brasília.
export const config: Config = {
  schedule: '0 22 * * *',
}

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const

export default async function handler() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name])
  if (missing.length) {
    console.error(`Lembrete diário não configurado. Faltam as variáveis: ${missing.join(', ')}`)
    return new Response('Lembrete diário não configurado.', { status: 500 })
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)

  const summary = await runDailyReminders({
    store: createStore(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!),
    async send(sub, payload): Promise<SendResult> {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 4 * 3600, urgency: 'normal' },
        )
        return 'ok'
      } catch (error) {
        const status = error instanceof webpush.WebPushError ? error.statusCode : undefined
        if (status === 404 || status === 410) return 'gone'
        console.error(`Falha ao enviar para a inscrição ${sub.id}: ${status ?? ''} ${error instanceof Error ? error.message : String(error)}`)
        return 'error'
      }
    },
    now: new Date(),
    siteUrl: process.env.URL ?? 'https://o-que-vamos-ver.netlify.app',
    log: (message) => console.error(message),
  })

  console.log(
    `Lembrete diário: ${summary.households} casa(s), ${summary.sent} enviado(s), ${summary.removed} inscrição(ões) removida(s), ${summary.failed} falha(s).`,
  )
  return new Response(JSON.stringify(summary), { headers: { 'content-type': 'application/json' } })
}
