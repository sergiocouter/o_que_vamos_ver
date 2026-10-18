import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runDailyReminders, type PushPayload, type ReminderStore, type SendResult, type Subscription } from './daily-run.ts'
import type { ReminderTitle } from './reminder.ts'

const NOW = new Date('2026-10-18T22:00:00Z')
const SITE = 'https://o-que-vamos-ver.netlify.app'

const sub = (id: string, userId: string): Subscription => ({ id, userId, endpoint: `https://push/${id}`, p256dh: 'p', auth: 'a' })
const title = (id: string, posterUrl: string | null = null): ReminderTitle => ({ id, title: `Título ${id}`, addedAt: '2026-08-29T12:00:00Z', posterUrl })

function memoryStore(overrides: Partial<ReminderStore> = {}, data: {
  subscriptions?: Subscription[]
  households?: Record<string, string>
  watchlists?: Record<string, ReminderTitle[]>
  sentToday?: string[]
} = {}) {
  const claimed: { householdId: string; titleId: string; sentOn: string }[] = []
  const deleted: string[] = []
  const store: ReminderStore = {
    listSubscriptions: async () => data.subscriptions ?? [],
    householdsByUser: async (userIds) => new Map(userIds.flatMap((id) => (data.households?.[id] ? [[id, data.households[id]] as const] : []))),
    hasReminder: async (householdId) => (data.sentToday ?? []).includes(householdId),
    listWatchlist: async (householdId) => data.watchlists?.[householdId] ?? [],
    recentTitleIds: async () => [],
    claimReminder: async (householdId, titleId, sentOn) => {
      claimed.push({ householdId, titleId, sentOn })
      return true
    },
    deleteSubscription: async (id) => {
      deleted.push(id)
    },
    ...overrides,
  }
  return { store, claimed, deleted }
}

function recorder(results: Record<string, SendResult> = {}) {
  const sent: { sub: Subscription; payload: PushPayload }[] = []
  const send = async (s: Subscription, payload: PushPayload) => {
    sent.push({ sub: s, payload })
    return results[s.id] ?? 'ok'
  }
  return { sent, send }
}

const base = { now: NOW, siteUrl: SITE, log: () => {}, random: () => 0 }

test('envia o mesmo título para todas as inscrições da casa', async () => {
  const { store, claimed } = memoryStore({}, {
    subscriptions: [sub('s1', 'u1'), sub('s2', 'u2')],
    households: { u1: 'h1', u2: 'h1' },
    watchlists: { h1: [title('t1')] },
  })
  const { sent, send } = recorder()
  const summary = await runDailyReminders({ ...base, store, send })

  assert.equal(sent.length, 2)
  assert.deepEqual(sent[0].payload, sent[1].payload)
  assert.equal(sent[0].payload.url, '/?titulo=t1')
  assert.equal(sent[0].payload.tag, 'lembrete-diario')
  assert.equal(sent[0].payload.body, 'Título t1 foi adicionado há 50 dias e ainda não foi visto. Que tal dar o play?')
  assert.deepEqual(claimed, [{ householdId: 'h1', titleId: 't1', sentOn: '2026-10-18' }])
  assert.equal(summary.sent, 2)
})

test('pula casa que já recebeu hoje', async () => {
  const { store } = memoryStore({}, {
    subscriptions: [sub('s1', 'u1')],
    households: { u1: 'h1' },
    watchlists: { h1: [title('t1')] },
    sentToday: ['h1'],
  })
  const { sent, send } = recorder()
  await runDailyReminders({ ...base, store, send })
  assert.equal(sent.length, 0)
})

test('pula casa com Tem que ver vazio', async () => {
  const { store, claimed } = memoryStore({}, { subscriptions: [sub('s1', 'u1')], households: { u1: 'h1' }, watchlists: { h1: [] } })
  const { sent, send } = recorder()
  await runDailyReminders({ ...base, store, send })
  assert.equal(sent.length, 0)
  assert.equal(claimed.length, 0)
})

test('pula casa quando insert do dia conflita', async () => {
  const { store } = memoryStore({ claimReminder: async () => false }, {
    subscriptions: [sub('s1', 'u1')],
    households: { u1: 'h1' },
    watchlists: { h1: [title('t1')] },
  })
  const { sent, send } = recorder()
  await runDailyReminders({ ...base, store, send })
  assert.equal(sent.length, 0)
})

test('remove inscrição em 410 e continua enviando', async () => {
  const { store, deleted } = memoryStore({}, {
    subscriptions: [sub('s1', 'u1'), sub('s2', 'u2')],
    households: { u1: 'h1', u2: 'h1' },
    watchlists: { h1: [title('t1')] },
  })
  const { sent, send } = recorder({ s1: 'gone' })
  const summary = await runDailyReminders({ ...base, store, send })
  assert.deepEqual(deleted, ['s1'])
  assert.deepEqual(sent.map((entry) => entry.sub.id), ['s1', 's2'])
  assert.equal(summary.removed, 1)
  assert.equal(summary.sent, 1)
})

test('ignora inscrição de usuário sem casa', async () => {
  const { store } = memoryStore({}, { subscriptions: [sub('s1', 'sem-casa')], households: {}, watchlists: {} })
  const { sent, send } = recorder()
  const summary = await runDailyReminders({ ...base, store, send })
  assert.equal(sent.length, 0)
  assert.equal(summary.households, 0)
})

test('erro em uma casa não interrompe as outras', async () => {
  const { store } = memoryStore({
    listWatchlist: async (householdId) => {
      if (householdId === 'h1') throw new Error('falhou')
      return [title('t2')]
    },
  }, {
    subscriptions: [sub('s1', 'u1'), sub('s2', 'u2')],
    households: { u1: 'h1', u2: 'h2' },
  })
  const { sent, send } = recorder()
  const summary = await runDailyReminders({ ...base, store, send })
  assert.deepEqual(sent.map((entry) => entry.sub.id), ['s2'])
  assert.ok(summary.failed >= 1)
})

test('monta image absoluta a partir da capa relativa', async () => {
  const poster = '/.netlify/functions/tmdb?action=image&size=w500&path=%2Fabc.jpg'
  const { store } = memoryStore({}, { subscriptions: [sub('s1', 'u1')], households: { u1: 'h1' }, watchlists: { h1: [title('t1', poster)] } })
  const { sent, send } = recorder()
  await runDailyReminders({ ...base, store, send })
  assert.equal(sent[0].payload.image, `${SITE}${poster}`)
})

test('sem capa não envia image', async () => {
  const { store } = memoryStore({}, { subscriptions: [sub('s1', 'u1')], households: { u1: 'h1' }, watchlists: { h1: [title('t1')] } })
  const { sent, send } = recorder()
  await runDailyReminders({ ...base, store, send })
  assert.equal('image' in sent[0].payload, false)
})

test('passa os lembretes recentes para o sorteio', async () => {
  let askedLimit = -1
  const { store, claimed } = memoryStore({
    recentTitleIds: async (_householdId, limit) => {
      askedLimit = limit
      return ['t1']
    },
  }, { subscriptions: [sub('s1', 'u1')], households: { u1: 'h1' }, watchlists: { h1: [title('t1'), title('t2')] } })
  const { send } = recorder()
  await runDailyReminders({ ...base, store, send })
  assert.equal(askedLimit, 2)
  assert.equal(claimed[0].titleId, 't2')
})
