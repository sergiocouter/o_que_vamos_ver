import { brasiliaDate, buildReminderMessage, pickReminderTitle, type ReminderTitle } from './reminder.ts'

export type Subscription = { id: string; userId: string; endpoint: string; p256dh: string; auth: string }

export type PushPayload = { title: string; body: string; url: string; image?: string; tag: 'lembrete-diario' }

export interface ReminderStore {
  listSubscriptions(): Promise<Subscription[]>
  householdsByUser(userIds: string[]): Promise<Map<string, string>>
  hasReminder(householdId: string, sentOn: string): Promise<boolean>
  listWatchlist(householdId: string): Promise<ReminderTitle[]>
  recentTitleIds(householdId: string, limit: number): Promise<string[]>
  /** Grava o lembrete do dia; `false` quando outra execução já gravou (conflito). */
  claimReminder(householdId: string, titleId: string, sentOn: string): Promise<boolean>
  deleteSubscription(id: string): Promise<void>
}

/** `gone`: o serviço de push avisou que a inscrição não existe mais (404/410). */
export type SendResult = 'ok' | 'gone' | 'error'

export interface DailyRunDeps {
  store: ReminderStore
  send(sub: Subscription, payload: PushPayload): Promise<SendResult>
  now: Date
  siteUrl: string
  log(message: string): void
  random?: () => number
}

const absoluteUrl = (siteUrl: string, url: string | null) =>
  !url ? undefined : url.startsWith('/') ? `${siteUrl}${url}` : url

/** Sorteia e envia o lembrete do dia para cada casa com aparelhos inscritos. */
export async function runDailyReminders({ store, send, now, siteUrl, log, random }: DailyRunDeps) {
  const summary = { households: 0, sent: 0, removed: 0, failed: 0 }
  const sentOn = brasiliaDate(now)

  const subscriptions = await store.listSubscriptions()
  const householdOf = await store.householdsByUser([...new Set(subscriptions.map((sub) => sub.userId))])
  const byHousehold = new Map<string, Subscription[]>()
  for (const sub of subscriptions) {
    const householdId = householdOf.get(sub.userId)
    if (!householdId) continue
    byHousehold.set(householdId, [...(byHousehold.get(householdId) ?? []), sub])
  }

  for (const [householdId, subs] of byHousehold) {
    summary.households++
    try {
      if (await store.hasReminder(householdId, sentOn)) continue
      const watchlist = await store.listWatchlist(householdId)
      const recent = watchlist.length ? await store.recentTitleIds(householdId, watchlist.length) : []
      const picked = pickReminderTitle(watchlist, recent, random)
      if (!picked) continue
      if (!(await store.claimReminder(householdId, picked.id, sentOn))) continue

      const image = absoluteUrl(siteUrl, picked.posterUrl)
      const payload: PushPayload = {
        ...buildReminderMessage(picked, now),
        url: `/?titulo=${picked.id}`,
        tag: 'lembrete-diario',
        ...(image ? { image } : {}),
      }

      for (const sub of subs) {
        const result = await send(sub, payload)
        if (result === 'ok') summary.sent++
        else if (result === 'gone') {
          await store.deleteSubscription(sub.id)
          summary.removed++
        } else summary.failed++
      }
    } catch (error) {
      summary.failed++
      log(`Casa ${householdId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return summary
}
