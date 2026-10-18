import { createClient } from '@supabase/supabase-js'
import type { ReminderStore } from './daily-run.ts'

/** Acesso ao banco do lembrete diário com a chave de serviço (ignora RLS). */
export function createStore(url: string, serviceKey: string): ReminderStore {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  return {
    async listSubscriptions() {
      const { data, error } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth')
      if (error) throw error
      return data.map((row) => ({ id: row.id, userId: row.user_id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }))
    },
    async householdsByUser(userIds) {
      if (!userIds.length) return new Map()
      const { data, error } = await db.from('household_members').select('user_id, household_id').in('user_id', userIds)
      if (error) throw error
      return new Map(data.map((row) => [row.user_id as string, row.household_id as string]))
    },
    async hasReminder(householdId, sentOn) {
      const { data, error } = await db
        .from('daily_reminders')
        .select('id')
        .eq('household_id', householdId)
        .eq('sent_on', sentOn)
        .limit(1)
      if (error) throw error
      return data.length > 0
    },
    async listWatchlist(householdId) {
      const { data, error } = await db
        .from('titles')
        .select('id, title, added_at, poster_url')
        .eq('household_id', householdId)
        .eq('status', 'watchlist')
      if (error) throw error
      return data.map((row) => ({ id: row.id, title: row.title, addedAt: row.added_at, posterUrl: row.poster_url }))
    },
    async recentTitleIds(householdId, limit) {
      const { data, error } = await db
        .from('daily_reminders')
        .select('title_id')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data.flatMap((row) => (row.title_id ? [row.title_id as string] : []))
    },
    async claimReminder(householdId, titleId, sentOn) {
      const { error } = await db.from('daily_reminders').insert({ household_id: householdId, title_id: titleId, sent_on: sentOn })
      if (error?.code === '23505') return false
      if (error) throw error
      return true
    },
    async deleteSubscription(id) {
      const { error } = await db.from('push_subscriptions').delete().eq('id', id)
      if (error) throw error
    },
  }
}
