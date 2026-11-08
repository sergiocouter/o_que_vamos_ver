import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickSimilar, SIMILAR_LIMIT, type RawSimilarItem } from './similar.ts'

const item = (id: number, extra: Partial<RawSimilarItem> = {}): RawSimilarItem => ({ id, title: `Título ${id}`, poster_path: `/p${id}.jpg`, ...extra })

test('usa as recomendações quando existem', () => {
  const result = pickSimilar('movie', 1, [item(2), item(3)], [item(9)])
  assert.deepEqual(result.map((entry) => entry.id), [2, 3])
})

test('cai para os semelhantes quando não há recomendações', () => {
  const result = pickSimilar('movie', 1, [], [item(9), item(8)])
  assert.deepEqual(result.map((entry) => entry.id), [9, 8])
})

test('marca o tipo pedido quando o TMDB não informa media_type', () => {
  const result = pickSimilar('tv', 1, [item(2, { name: 'Série', title: undefined })], [])
  assert.equal(result[0].media_type, 'tv')
})

test('mantém o media_type informado e descarta pessoas', () => {
  const result = pickSimilar('movie', 1, [item(2, { media_type: 'tv' }), item(3, { media_type: 'person' })], [])
  assert.deepEqual(result.map((entry) => [entry.id, entry.media_type]), [[2, 'tv']])
})

test('tira o próprio título, repetidos, adultos e itens sem capa', () => {
  const result = pickSimilar(
    'movie',
    1,
    [item(1), item(2), item(2), item(3, { adult: true }), item(4, { poster_path: null })],
    [],
  )
  assert.deepEqual(result.map((entry) => entry.id), [2])
})

test(`limita a ${SIMILAR_LIMIT} títulos`, () => {
  const many = Array.from({ length: 30 }, (_, index) => item(index + 10))
  assert.equal(pickSimilar('movie', 1, many, []).length, SIMILAR_LIMIT)
})
