import assert from 'node:assert/strict'
import { test } from 'node:test'
import { averageRating, buildRatings, formatRating, withMyRating } from './ratings.ts'

test('média com uma casa decimal; sem notas não tem média', () => {
  assert.equal(averageRating([]), undefined)
  assert.equal(averageRating([{ userId: 'a', name: 'A', rating: 5 }]), 5)
  assert.equal(averageRating([{ userId: 'a', name: 'A', rating: 5 }, { userId: 'b', name: 'B', rating: 4 }]), 4.5)
  assert.equal(
    averageRating([
      { userId: 'a', name: 'A', rating: 5 },
      { userId: 'b', name: 'B', rating: 4 },
      { userId: 'c', name: 'C', rating: 4 },
    ]),
    4.3,
  )
})

test('formata a nota em português', () => {
  assert.equal(formatRating(4.5), '4,5')
  assert.equal(formatRating(4), '4')
})

test('junta notas com os nomes, pessoa sem perfil vira "Alguém", mais antigas primeiro', () => {
  const rows = [
    { title_id: 't1', user_id: 'b', rating: 3, rated_at: '2026-11-02T00:00:00Z' },
    { title_id: 't1', user_id: 'a', rating: 5, rated_at: '2026-11-01T00:00:00Z' },
    { title_id: 't2', user_id: 'x', rating: 4, rated_at: '2026-11-01T00:00:00Z' },
  ]
  const names = new Map([['a', 'Sérgio Couter'], ['b', 'Priscila']])
  const byTitle = buildRatings(rows, names)
  assert.deepEqual(byTitle.get('t1'), [
    { userId: 'a', name: 'Sérgio Couter', rating: 5 },
    { userId: 'b', name: 'Priscila', rating: 3 },
  ])
  assert.deepEqual(byTitle.get('t2'), [{ userId: 'x', name: 'Alguém', rating: 4 }])
})

test('aplica, troca e apaga a minha nota sem mexer nas outras', () => {
  const others = [{ userId: 'b', name: 'Priscila', rating: 3 }]
  const mine = withMyRating(others, 'a', 'Sérgio', 5)
  assert.deepEqual(mine, [...others, { userId: 'a', name: 'Sérgio', rating: 5 }])
  assert.deepEqual(withMyRating(mine, 'a', 'Sérgio', 2), [...others, { userId: 'a', name: 'Sérgio', rating: 2 }])
  assert.deepEqual(withMyRating(mine, 'a', 'Sérgio', null), others)
})
