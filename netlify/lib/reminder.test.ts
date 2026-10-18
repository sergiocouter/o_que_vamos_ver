import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brasiliaDate, buildReminderMessage, pickReminderTitle, type ReminderTitle } from './reminder.ts'

const title = (id: string): ReminderTitle => ({ id, title: id.toUpperCase(), addedAt: '2026-01-01T12:00:00Z', posterUrl: null })
const first = () => 0

test('pickReminderTitle devolve null para lista vazia', () => {
  assert.equal(pickReminderTitle([], ['a']), null)
})

test('pickReminderTitle nunca repete até esgotar', () => {
  const watchlist = ['a', 'b', 'c', 'd'].map(title)
  const recent: string[] = []
  for (let day = 0; day < 4; day++) {
    const picked = pickReminderTitle(watchlist, recent, first)
    assert.ok(picked)
    recent.unshift(picked.id)
  }
  assert.equal(new Set(recent).size, 4)
})

test('pickReminderTitle volta a sortear entre todos depois de esgotar', () => {
  const watchlist = ['a', 'b', 'c'].map(title)
  // Os 2 mais recentes (N - 1) ficam de fora; o terceiro mais antigo já pode voltar.
  assert.equal(pickReminderTitle(watchlist, ['c', 'b', 'a'], first)?.id, 'a')
})

test('pickReminderTitle ignora ids recentes que saíram da lista', () => {
  const watchlist = ['a', 'b'].map(title)
  // Só o primeiro recente (N - 1 = 1) conta, e ele nem está mais na lista.
  assert.equal(pickReminderTitle(watchlist, ['x', 'y', 'a'], first)?.id, 'a')
})

test('pickReminderTitle sorteia entre todos quando tudo está excluído', () => {
  assert.equal(pickReminderTitle([title('a')], ['a'], first)?.id, 'a')
})

test('pickReminderTitle usa o random para escolher entre os candidatos', () => {
  const watchlist = ['a', 'b', 'c'].map(title)
  assert.equal(pickReminderTitle(watchlist, [], () => 0.99)?.id, 'c')
  assert.equal(pickReminderTitle(watchlist, [], () => 0.5)?.id, 'b')
})

test('buildReminderMessage com 50 dias na lista', () => {
  const now = new Date('2026-10-18T22:00:00Z')
  const message = buildReminderMessage({ title: 'Vikings', addedAt: '2026-08-29T15:00:00-03:00' }, now)
  assert.equal(message.title, 'O que vamos ver hoje? 🍿')
  assert.equal(message.body, 'Vikings foi adicionado há 50 dias e ainda não foi visto. Que tal dar o play?')
})

test('buildReminderMessage adicionado hoje', () => {
  const now = new Date('2026-10-18T22:00:00Z')
  const message = buildReminderMessage({ title: 'Vikings', addedAt: '2026-10-18T09:00:00-03:00' }, now)
  assert.equal(message.body, 'Vikings foi adicionado hoje e ainda não foi visto. Que tal dar o play?')
})

test('buildReminderMessage adicionado ontem', () => {
  const now = new Date('2026-10-18T22:00:00Z')
  const message = buildReminderMessage({ title: 'Vikings', addedAt: '2026-10-17T09:00:00-03:00' }, now)
  assert.equal(message.body, 'Vikings foi adicionado ontem e ainda não foi visto. Que tal dar o play?')
})

test('buildReminderMessage conta dias em Brasília', () => {
  // Em UTC as duas datas cairiam no dia 18; em Brasília são 17 e 18.
  const now = new Date('2026-10-18T22:00:00Z')
  const message = buildReminderMessage({ title: 'Vikings', addedAt: '2026-10-17T23:30:00-03:00' }, now)
  assert.equal(message.body, 'Vikings foi adicionado ontem e ainda não foi visto. Que tal dar o play?')
})

test('brasiliaDate usa o fuso de São Paulo perto da meia-noite UTC', () => {
  assert.equal(brasiliaDate(new Date('2026-10-19T01:30:00Z')), '2026-10-18')
})
