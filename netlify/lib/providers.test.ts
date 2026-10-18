import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProviders, type RawCountryProviders } from './providers.ts'

const raw = (id: number, name: string, priority: number, logo: string | null = `/logo${id}.png`) => ({
  provider_id: id,
  provider_name: name,
  display_priority: priority,
  logo_path: logo,
})

test('sem dados do país devolve listas vazias', () => {
  assert.deepEqual(normalizeProviders(undefined), { link: null, flatrate: [], rent: [], buy: [] })
})

test('mantém o link da página de onde assistir', () => {
  assert.equal(normalizeProviders({ link: 'https://www.themoviedb.org/tv/1/watch?locale=BR' }).link, 'https://www.themoviedb.org/tv/1/watch?locale=BR')
})

test('ordena pela prioridade do JustWatch', () => {
  const result = normalizeProviders({ flatrate: [raw(2, 'Disney Plus', 5), raw(1, 'Netflix', 1)] })
  assert.deepEqual(result.flatrate.map((p) => p.name), ['Netflix', 'Disney Plus'])
})

test('remove a variante com anúncios quando o serviço principal está na lista', () => {
  const result = normalizeProviders({ flatrate: [raw(8, 'Netflix', 1), raw(1796, 'Netflix Standard with Ads', 2)] })
  assert.deepEqual(result.flatrate.map((p) => p.name), ['Netflix'])
})

test('remove o canal da Amazon quando o serviço principal está na lista', () => {
  const result = normalizeProviders({ flatrate: [raw(350, 'Apple TV', 1), raw(2243, 'Apple TV Amazon Channel', 2)] })
  assert.deepEqual(result.flatrate.map((p) => p.name), ['Apple TV'])
})

test('mantém o canal da Amazon quando é a única forma de assistir naquele serviço', () => {
  const result = normalizeProviders({ flatrate: [raw(1, 'Claro tv+', 1), raw(2, 'Filmelier Plus Amazon Channel', 2)] })
  assert.deepEqual(result.flatrate.map((p) => p.name), ['Claro tv+', 'Filmelier Plus Amazon Channel'])
})

test('remove provedores repetidos', () => {
  const result = normalizeProviders({ buy: [raw(2, 'Apple TV Store', 1), raw(2, 'Apple TV Store', 1)] })
  assert.equal(result.buy.length, 1)
})

test('logo passa pelo proxy de imagens do app', () => {
  const [provider] = normalizeProviders({ rent: [raw(10, 'Amazon Video', 1, '/abc.jpg')] }).rent
  assert.deepEqual(provider, { id: 10, name: 'Amazon Video', logo: '/.netlify/functions/tmdb?action=image&size=w92&path=%2Fabc.jpg' })
})

test('sem logo devolve null', () => {
  assert.equal(normalizeProviders({ rent: [raw(10, 'Loja', 1, null)] }).rent[0].logo, null)
})

test('ignora entradas sem nome', () => {
  const result = normalizeProviders({ flatrate: [{ provider_id: 3, display_priority: 1 }] } as RawCountryProviders)
  assert.equal(result.flatrate.length, 0)
})
