import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorMessage } from './errors.ts'

test('mostra a mensagem de um erro do Supabase (objeto comum)', () => {
  const error = { message: 'Você já participa de uma casa.', code: 'P0001', details: null, hint: null }
  assert.equal(errorMessage(error, 'fallback'), 'Você já participa de uma casa.')
})

test('mostra a mensagem de um Error', () => {
  assert.equal(errorMessage(new Error('Código de convite não encontrado.'), 'fallback'), 'Código de convite não encontrado.')
})

test('troca falha de rede por um texto amigável', () => {
  assert.match(errorMessage({ message: 'TypeError: Failed to fetch' }, 'fallback'), /Sem conexão/)
  assert.match(errorMessage(new TypeError('Load failed'), 'fallback'), /Sem conexão/)
})

test('usa o texto padrão quando não há mensagem', () => {
  assert.equal(errorMessage(undefined, 'fallback'), 'fallback')
  assert.equal(errorMessage({ message: '' }, 'fallback'), 'fallback')
  assert.equal(errorMessage({ code: '42702' }, 'fallback'), 'fallback')
})
