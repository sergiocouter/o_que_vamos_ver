import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorMessage } from './errors.ts'

// errorMessage registra os erros técnicos no console; silencia nos testes.
console.error = () => {}

test('mostra o aviso escrito na função do banco (raise exception)', () => {
  const error = { message: 'Você já participa de uma casa.', code: 'P0001', details: null, hint: null }
  assert.equal(errorMessage(error, 'fallback'), 'Você já participa de uma casa.')
})

test('esconde erros técnicos do banco', () => {
  const ambiguous = { message: 'column reference "invite_code" is ambiguous', code: '42702' }
  const rls = { message: 'new row violates row-level security policy for table "titles"', code: '42501' }
  const otherDuplicate = { message: 'duplicate key value violates unique constraint "households_invite_code_key"', code: '23505' }
  assert.equal(errorMessage(ambiguous, 'fallback'), 'fallback')
  assert.equal(errorMessage(rls, 'fallback'), 'fallback')
  assert.equal(errorMessage(otherDuplicate, 'fallback'), 'fallback')
})

test('traduz título repetido e sessão expirada', () => {
  const duplicate = {
    message: 'duplicate key value violates unique constraint "titles_household_id_tmdb_id_media_type_key"',
    code: '23505',
  }
  assert.equal(errorMessage(duplicate, 'fallback'), 'Esse título já está na lista da casa.')
  assert.match(errorMessage({ message: 'JWT expired', code: 'PGRST303' }, 'fallback'), /sessão expirou/)
})

test('mostra a mensagem de um Error do próprio app', () => {
  assert.equal(errorMessage(new Error('Código de convite não encontrado.'), 'fallback'), 'Código de convite não encontrado.')
})

test('esconde bugs de JavaScript', () => {
  assert.equal(errorMessage(new TypeError("Cannot read properties of undefined (reading 'id')"), 'fallback'), 'fallback')
})

test('troca falha de rede por um texto amigável', () => {
  assert.match(errorMessage({ message: 'TypeError: Failed to fetch', code: '' }, 'fallback'), /Sem conexão/)
  assert.match(errorMessage(new TypeError('Load failed'), 'fallback'), /Sem conexão/)
})

test('usa o texto padrão quando não há mensagem', () => {
  assert.equal(errorMessage(undefined, 'fallback'), 'fallback')
  assert.equal(errorMessage('texto solto', 'fallback'), 'fallback')
  assert.equal(errorMessage({ message: '' }, 'fallback'), 'fallback')
  assert.equal(errorMessage({ code: '42702' }, 'fallback'), 'fallback')
})
