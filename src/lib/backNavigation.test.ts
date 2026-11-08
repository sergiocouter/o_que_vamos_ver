import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planViewChange, screenFromState, stepsToCloseAdd } from './backNavigation.ts'

const result = { tmdbId: 1, mediaType: 'movie' as const, title: 'Filme', overview: '', genreIds: [] }

test('lê a tela guardada no passo do histórico', () => {
  const overlay = { kind: 'title', titleId: 'abc' }
  assert.deepEqual(screenFromState({ oqvv: 'step', view: 'watched', overlay }), { view: 'watched', overlay })
  assert.deepEqual(screenFromState({ oqvv: 'guard', view: 'all', overlay: null }), { view: 'all', overlay: null })
})

test('estado vazio ou desconhecido vira a Visão geral', () => {
  assert.deepEqual(screenFromState(null), { view: 'all', overlay: null })
  assert.deepEqual(screenFromState({ view: 'qualquer' }), { view: 'all', overlay: null })
})

test('aceita o passo de título da versão anterior do app', () => {
  assert.deepEqual(screenFromState({ oqvv: 'overlay', kind: 'title' }, '?titulo=xyz'), {
    view: 'all',
    overlay: { kind: 'title', titleId: 'xyz' },
  })
  assert.deepEqual(screenFromState({ oqvv: 'overlay', kind: 'add' }, ''), { view: 'all', overlay: null })
})

test('trocar de lista: empilha só ao sair da Visão geral', () => {
  assert.equal(planViewChange('all', 'all'), 'none')
  assert.equal(planViewChange('all', 'watchlist'), 'push')
  assert.equal(planViewChange('watchlist', 'watched'), 'replace')
  assert.equal(planViewChange('watched', 'all'), 'back')
})

test('fechar "Adicionar": dois passos quando a prévia veio da busca', () => {
  assert.equal(stepsToCloseAdd({ kind: 'add', from: 'search' }), 1)
  assert.equal(stepsToCloseAdd({ kind: 'add', from: 'search', preset: result }), 2)
  assert.equal(stepsToCloseAdd({ kind: 'add', from: 'similar', preset: result }), 1)
  assert.equal(stepsToCloseAdd({ kind: 'title', titleId: 'a' }), 1)
})
