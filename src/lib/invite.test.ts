import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inviteLink, normalizeInviteCode, readInviteFromUrl } from './invite.ts'

test('normaliza o código do convite', () => {
  assert.equal(normalizeInviteCode(' ab 12 cd '), 'AB12CD')
  assert.equal(normalizeInviteCode('A1B2C3'), 'A1B2C3')
})

test('recusa o que não parece um código', () => {
  assert.equal(normalizeInviteCode(null), null)
  assert.equal(normalizeInviteCode(''), null)
  assert.equal(normalizeInviteCode('ABC'), null)
  assert.equal(normalizeInviteCode('<script>'), null)
  assert.equal(normalizeInviteCode('A'.repeat(13)), null)
})

test('lê o convite e limpa a URL mantendo os outros parâmetros', () => {
  assert.deepEqual(readInviteFromUrl('https://app.test/?convite=ab12cd&titulo=1#x'), {
    code: 'AB12CD',
    cleanedUrl: '/?titulo=1#x',
  })
  assert.deepEqual(readInviteFromUrl('https://app.test/?convite=ab12cd'), { code: 'AB12CD', cleanedUrl: '/' })
})

test('convite inválido é removido da URL sem ser guardado', () => {
  assert.deepEqual(readInviteFromUrl('https://app.test/?convite=%3Cx%3E'), { code: null, cleanedUrl: '/' })
})

test('sem convite na URL não mexe em nada', () => {
  assert.equal(readInviteFromUrl('https://app.test/?titulo=1'), null)
})

test('monta o link do convite', () => {
  assert.equal(inviteLink('AB12CD', 'https://o-que-vamos-ver.netlify.app'), 'https://o-que-vamos-ver.netlify.app/?convite=AB12CD')
})
