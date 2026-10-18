# Lembrete diário — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notificação push diária às 19h (Brasília) com um título sorteado da lista "Tem que ver" de cada casa.

**Architecture:** Netlify Scheduled Function (`daily-reminder`) lê inscrições e títulos no Supabase com service role, sorteia por casa via lógica pura testável e envia com `web-push` (VAPID). O app inscreve o aparelho por RPC; um `push-sw.js` importado pelo service worker gerado exibe a notificação e trata o toque.

**Tech Stack:** React 19 + Vite 8 + vite-plugin-pwa 1.3 (generateSW), Netlify Functions v2 (Node 22), Supabase (Postgres + RLS), `web-push` 3.6.7, `node --test` (Node ≥ 22 com type stripping).

**Spec:** `docs/superpowers/specs/2026-10-18-lembrete-diario-design.md`

## Global Constraints

- Não quebrar o que existe: lint (`npm run lint`), build (`npm run build`) e o fluxo atual do PWA (`registerType: 'autoUpdate'`, `generateSW`) seguem iguais; CSP do `netlify.toml` não muda.
- Cron: `0 22 * * *` (UTC) = 19h America/Sao_Paulo.
- Copy exata da notificação: título `O que vamos ver hoje? 🍿`; corpo `{Título} foi adicionado há {N} dias e ainda não foi visto. Que tal dar o play?`, com `há {N} dias` virando `hoje` (0 dias) ou `ontem` (1 dia), contando em datas de Brasília.
- Deep link: `/?titulo=<uuid do título>`; tag da notificação `lembrete-diario`.
- Variáveis: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:sergiocouter@gmail.com`, `VITE_VAPID_PUBLIC_KEY` (= pública), `SUPABASE_SERVICE_ROLE_KEY`; URL do Supabase vem de `VITE_SUPABASE_URL`.
- Nenhuma dependência nova além de `web-push` e `@types/web-push` (dev). Testes com `node --test`.
- Commits com `sergiocouter <sergiocouter@gmail.com>` (já configurado no repo).
- Textos de UI em pt-BR, no tom do app.

## Review Focus

1. **Lista "Tem que ver" encolhe entre lembretes** (títulos vistos/removidos): o sorteio nunca deve devolver título fora da lista atual nem travar → teste `pickReminderTitle ignora ids recentes que saíram da lista` (Task 1).
2. **Função roda duas vezes no mesmo dia** (retry do Netlify ou "Run now" após o cron): ninguém recebe repetido → teste `runDailyReminders pula casa quando insert do dia conflita` (Task 3).
3. **Inscrição expirada** (app desinstalado, 404/410): é apagada e não derruba as outras → teste `remove inscrição em 410 e continua enviando` (Task 3).
4. **Pessoa sem casa ou casa sem inscrição**: ignorada sem erro → teste `ignora inscrição de usuário sem casa` (Task 3).
5. **Deep link para título inexistente** (removido depois do envio): app abre normalmente, sem modal e sem erro, e limpa o parâmetro → verificação no navegador (Task 5).

---

### Task 1: Lógica pura do lembrete

**Files:**
- Create: `netlify/lib/reminder.ts`
- Test: `netlify/lib/reminder.test.ts`
- Modify: `package.json` (script `"test": "node --test netlify/lib/"`)

**Interfaces:**
- Produces:
  - `type ReminderTitle = { id: string; title: string; addedAt: string; posterUrl: string | null }`
  - `pickReminderTitle(watchlist: ReminderTitle[], recentTitleIds: string[], random?: () => number): ReminderTitle | null` — `recentTitleIds` em ordem do mais recente; considera só os primeiros `watchlist.length - 1`; se todos excluídos, sorteia entre todos; lista vazia → `null`.
  - `buildReminderMessage(title: Pick<ReminderTitle, 'title' | 'addedAt'>, now: Date): { title: string; body: string }`
  - `brasiliaDate(date: Date): string` — `YYYY-MM-DD` em `America/Sao_Paulo` (via `Intl.DateTimeFormat('en-CA', { timeZone })`).

- [ ] **Step 1: Escrever os testes** (`node:test` + `node:assert/strict`, import de `./reminder.ts`)
  - `pickReminderTitle devolve null para lista vazia`
  - `pickReminderTitle nunca repete até esgotar`: lista de 4, simulando 4 sorteios alimentando `recentTitleIds` com os anteriores (random fixo `() => 0`), os 4 ids são distintos.
  - `pickReminderTitle ignora ids recentes que saíram da lista`: lista `[a, b]`, recentes `['x', 'y', 'a']` → considera só `['x']` (primeiros `N − 1 = 1`), resultado ∈ {a, b}; com random `() => 0` → `a`.
  - `pickReminderTitle sorteia entre todos quando tudo está excluído`: lista `[a]`, recentes `['a']` → `a`.
  - `buildReminderMessage` com `addedAt` 50 dias antes → corpo exatamente `Vikings foi adicionado há 50 dias e ainda não foi visto. Que tal dar o play?` e título `O que vamos ver hoje? 🍿`.
  - `buildReminderMessage` hoje → `Vikings foi adicionado hoje e ainda não foi visto. Que tal dar o play?`; ontem → `... adicionado ontem ...`.
  - `buildReminderMessage conta dias em Brasília`: `addedAt = 2026-10-17T23:30:00-03:00`, `now = 2026-10-18T22:00:00Z` (19h BRT) → `ontem` (em UTC seriam datas iguais, 18 e 18 → o teste pega o erro de usar UTC).
  - `brasiliaDate(new Date('2026-10-19T01:30:00Z'))` → `'2026-10-18'`.
- [ ] **Step 2:** `npm test` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** em `netlify/lib/reminder.ts`. Diferença de dias = diferença entre `brasiliaDate(now)` e `brasiliaDate(addedAt)` como datas UTC à meia-noite.
- [ ] **Step 4:** `npm test` → todos PASS. `npm run lint` limpo.
- [ ] **Step 5: Commit** `feat: lógica do sorteio e texto do lembrete diário`

---

### Task 2: Migração do banco

**Files:**
- Create: `supabase/migrations/2026-10-18-lembrete-diario.sql`
- Modify: `supabase/schema.sql` (anexar o mesmo conteúdo ao final, antes dos `grant execute` finais ou depois deles)

**Interfaces:**
- Produces (contrato usado pelas Tasks 3 e 5):
  - Tabela `public.push_subscriptions(id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, endpoint text not null unique, p256dh text not null, auth text not null, user_agent text, created_at timestamptz not null default now())`, RLS on, políticas `select` e `delete` para `user_id = (select auth.uid())`; grant `select, delete` a `authenticated`.
  - Tabela `public.daily_reminders(id bigint generated always as identity pk, household_id uuid not null references public.households on delete cascade, title_id uuid references public.titles on delete set null, sent_on date not null, created_at timestamptz not null default now(), unique (household_id, sent_on))`, RLS on, sem políticas, sem grants a `authenticated`/`anon`. Índice `(household_id, created_at desc)`.
  - `public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text) returns void` — `security definer set search_path = ''`, exige `auth.uid()`, `insert ... on conflict (endpoint) do update set user_id = auth.uid(), p256dh, auth, user_agent`. Grant execute a `authenticated`.
  - `public.delete_push_subscription(p_endpoint text) returns void` — apaga onde `endpoint = p_endpoint and user_id = auth.uid()`. Grant execute a `authenticated`.

- [ ] **Step 1: Escrever o teste SQL** em `tmp/sql-test/run.sh` (fora do repo versionado; `tmp/` não é commitado): sobe `postgres:17-alpine` no Docker, cria stubs (`schema auth`, `auth.users(id uuid pk, email text, raw_user_meta_data jsonb)`, `auth.uid()` lendo `current_setting('request.jwt.claim.sub', true)::uuid`, roles `anon`/`authenticated`), roda `schema.sql` inteiro e verifica, como `authenticated` com `sub` = usuário A:
  - `save_push_subscription('e1', ...)` duas vezes → 1 linha.
  - Como usuário B, `save_push_subscription('e1', ...)` → linha passa a ser de B.
  - Como A, `select * from push_subscriptions` → 0 linhas; `delete_push_subscription('e1')` não apaga (é de B).
  - Como `authenticated`, `select * from daily_reminders` → erro de permissão.
  - `insert` duplicado `(household, sent_on)` em `daily_reminders` (como superusuário) → erro de unicidade.
- [ ] **Step 2:** rodar → FAIL (tabelas não existem).
- [ ] **Step 3: Escrever a migração** e anexar ao `schema.sql`.
- [ ] **Step 4:** rodar → todas as verificações passam; container removido ao final.
- [ ] **Step 5: Commit** `feat: tabelas e RPCs do lembrete diário`

---

### Task 3: Função agendada

**Files:**
- Create: `netlify/lib/daily-run.ts` (orquestração com dependências injetadas)
- Test: `netlify/lib/daily-run.test.ts`
- Create: `netlify/functions/daily-reminder.ts` (liga Supabase + web-push à orquestração)
- Modify: `package.json` (`web-push` em dependencies, `@types/web-push` em devDependencies)

**Interfaces:**
- Consumes: Task 1 (`pickReminderTitle`, `buildReminderMessage`, `brasiliaDate`, `ReminderTitle`); contrato de tabelas da Task 2.
- Produces:
  - `type Subscription = { id: string; userId: string; endpoint: string; p256dh: string; auth: string }`
  - `type PushPayload = { title: string; body: string; url: string; image?: string; tag: 'lembrete-diario' }`
  - `interface ReminderStore { listSubscriptions(): Promise<Subscription[]>; householdsByUser(userIds: string[]): Promise<Map<string, string>>; hasReminder(householdId: string, sentOn: string): Promise<boolean>; listWatchlist(householdId: string): Promise<ReminderTitle[]>; recentTitleIds(householdId: string, limit: number): Promise<string[]>; claimReminder(householdId: string, titleId: string, sentOn: string): Promise<boolean> /* false em conflito */; deleteSubscription(id: string): Promise<void> }`
  - `type SendResult = 'ok' | 'gone' | 'error'`
  - `runDailyReminders(deps: { store: ReminderStore; send(sub: Subscription, payload: PushPayload): Promise<SendResult>; now: Date; siteUrl: string; log(msg: string): void; random?: () => number }): Promise<{ households: number; sent: number; removed: number; failed: number }>`
  - `image` = `${siteUrl}${posterUrl}` quando `posterUrl` começa com `/`; URL absoluta mantida; ausente quando `null`.

- [ ] **Step 1: Escrever os testes** com um `ReminderStore` em memória e `send` falso:
  - `envia o mesmo título para todas as inscrições da casa` (2 inscrições, mesma casa → 2 envios, payloads iguais, `url` = `/?titulo=<id>`, `tag` = `lembrete-diario`).
  - `pula casa que já recebeu hoje` (`hasReminder` → true → 0 envios).
  - `pula casa com Tem que ver vazio`.
  - `pula casa quando insert do dia conflita` (`claimReminder` → false → 0 envios).
  - `remove inscrição em 410 e continua enviando` (`send` → `'gone'` na primeira; `deleteSubscription` chamado com o id; segunda recebe).
  - `ignora inscrição de usuário sem casa`.
  - `erro em uma casa não interrompe as outras` (`listWatchlist` lança na casa 1; casa 2 recebe; `failed` ≥ 1).
  - `monta image absoluta a partir da capa relativa`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar** `runDailyReminders`. Usa `brasiliaDate(now)` como `sentOn`; `recentTitleIds(h, watchlist.length)`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Instalar** `npm install web-push@3.6.7` e `npm install -D @types/web-push@3.6.4`.
- [ ] **Step 6: Implementar** `netlify/functions/daily-reminder.ts`: `export const config: Config = { schedule: '0 22 * * *' }`; handler cria cliente `createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })`, implementa `ReminderStore` com as queries das tabelas da Task 2 (conflito no insert = código `23505` → `false`), `send` via `webpush.sendNotification` com `{ TTL: 4 * 3600, urgency: 'normal' }` mapeando status 404/410 → `'gone'`, outros erros → `'error'`. `siteUrl` = `process.env.URL`. Variável ausente → `log` explicando qual e retorno `500` sem lançar. Loga o resumo final.
- [ ] **Step 7:** typecheck da função: `npx tsc --ignoreConfig --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --types node --skipLibCheck --allowImportingTsExtensions netlify/functions/daily-reminder.ts netlify/functions/tmdb.ts` → sem erros. `npm run lint` limpo.
- [ ] **Step 8: Commit** `feat: função agendada do lembrete diário`

---

### Task 4: Service worker e ícone de badge

**Files:**
- Create: `public/push-sw.js`
- Create: `public/badge-96x96.png` (gerado com `sharp` a partir do triângulo de play do `favicon.svg`: silhueta branca em fundo transparente, 96×96)
- Modify: `vite.config.ts` (`workbox.importScripts: ['push-sw.js']`; `includeAssets` ganha `'badge-96x96.png'`)

**Interfaces:**
- Consumes: `PushPayload` (Task 3) como JSON do evento `push`.
- Produces: notificação com `icon: '/pwa-192x192.png'`, `badge: '/badge-96x96.png'`, `data: { url }`; clique navega para `data.url` focando janela existente do mesmo origin (`client.navigate` + `focus`) ou `clients.openWindow`.

- [ ] **Step 1: Escrever o teste de navegador** `tmp/push-test/sw.mjs` (Playwright de `%APPDATA%/npm/node_modules/@playwright/cli/node_modules/playwright`): serve `dist/` (servidor estático da sessão), `context.grantPermissions(['notifications'])`, espera o SW ativo, entrega push via CDP `ServiceWorker.deliverPushMessage` com payload de exemplo, e verifica `registration.getNotifications({ tag: 'lembrete-diario' })` → 1 notificação com título, corpo, `data.url` iguais ao payload.
- [ ] **Step 2:** `npm run build` + rodar → FAIL (sem handler de push).
- [ ] **Step 3: Implementar** `push-sw.js` (payload inválido → não exibe nada, sem lançar), gerar o badge, ajustar `vite.config.ts`.
- [ ] **Step 4:** `npm run build`; conferir que `dist/sw.js` contém `importScripts("push-sw.js")` e `dist/push-sw.js` existe; rodar o teste → PASS. Abrir o app no headless e confirmar console sem erros e auto-update intacto (SW registra e controla a página).
- [ ] **Step 5: Commit** `feat: service worker exibe o lembrete diário`

---

### Task 5: Ativação no app e deep link

**Files:**
- Create: `src/lib/push.ts`
- Create: `src/components/ReminderToggle.tsx`
- Modify: `src/components/LibraryApp.tsx` (renderizar `ReminderToggle` no menu lateral junto de "Instalar aplicativo", só quando `!isDemo`; deep link `?titulo=`)
- Modify: `src/index.css` (estilo do cartão, seguindo `.install-card`/padrões existentes do menu)
- Modify: `.env.example` (`VITE_VAPID_PUBLIC_KEY=`)

**Interfaces:**
- Consumes: RPCs `save_push_subscription` / `delete_push_subscription` (Task 2); `push-sw.js` (Task 4).
- Produces:
  - `type PushSupport = 'unsupported' | 'needs-install' | 'denied' | 'default' | 'granted'`
  - `getPushSupport(): PushSupport` — `needs-install` quando iOS e não `display-mode: standalone`.
  - `isSubscribed(): Promise<boolean>`
  - `enableReminders(): Promise<void>` — lança `Error` com mensagem pt-BR amigável em falha; após salvar, `registration.showNotification('Lembrete ativado! 🍿', { body: 'Todo dia às 19h a gente sugere um título da lista Tem que ver.', icon, badge, tag: 'lembrete-ativado' })`.
  - `disableReminders(): Promise<void>`
  - `ReminderToggle()` — sem props; não renderiza nada se `!import.meta.env.VITE_VAPID_PUBLIC_KEY` ou `getPushSupport() === 'unsupported'`.

- [ ] **Step 1: Escrever o teste de navegador** `tmp/push-test/ui.mjs`: build de teste com `VITE_SUPABASE_URL`/chave apontando para um mock local (o mesmo servidor estático responde `POST /rest/v1/rpc/save_push_subscription` e `.../delete_push_subscription` com 204 e registra as chamadas; `GET /auth/v1/user` e sessão injetada no `localStorage`) e `VITE_VAPID_PUBLIC_KEY` de teste. Verifica:
  - cartão "Lembrete diário às 19h" visível no menu; desligado.
  - com `notifications` concedido, clicar liga → RPC `save_push_subscription` chamada com `p_endpoint` não vazio; notificação `lembrete-ativado` existe; cartão mostra ligado.
  - clicar de novo desliga → RPC `delete_push_subscription` chamada; `pushManager.getSubscription()` → null.
  - com permissão negada → texto orientando liberar nas configurações; nenhuma RPC.
  - `/?titulo=<id existente>` abre o modal daquele título e a URL fica `/`.
  - `/?titulo=00000000-0000-0000-0000-000000000000` → sem modal, sem erro no console, URL fica `/`.
  - modo demonstração (build sem Supabase) → cartão ausente.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** `push.ts`, `ReminderToggle.tsx`, integração no `LibraryApp` (deep link num `useEffect` que roda quando `loading` vira `false`; usa `history.replaceState(null, '', location.pathname)`), CSS, `.env.example`.
- [ ] **Step 4:** rodar → PASS. `npm run lint`, `npm run build` limpos. Pushsubscribe real em headless Chromium pode falhar (sem FCM): se falhar, o teste usa `pushManager.subscribe` stubado via `addInitScript` retornando endpoint/keys fixos — registrar no relatório qual caminho foi usado.
- [ ] **Step 5: Commit** `feat: ativar lembrete diário no app e abrir título pela notificação`

---

### Task 6: Chaves, documentação e publicação

**Files:**
- Modify: `README.md` (seção "Lembrete diário": migração SQL, variáveis, "Run now")

- [ ] **Step 1:** Gerar par VAPID (`npx web-push generate-vapid-keys --json`) sem imprimir a chave privada no chat; cadastrar no Netlify via CLI: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (secret), `VAPID_SUBJECT`, `VITE_VAPID_PUBLIC_KEY`. Conferir com `env:list` (só nomes).
- [ ] **Step 2: Teste de envio real ponta a ponta local:** Chromium com perfil persistente (não headless, se o headless não tiver push service) inscrito com a chave VAPID de produção, `runDailyReminders` com store em memória + `send` real do `web-push` → notificação aparece (`getNotifications`). Se o ambiente não permitir push real, registrar e cobrir no Step 5.
- [ ] **Step 3:** Atualizar README; commit `docs: como ativar o lembrete diário`.
- [ ] **Step 4: Pedir à pessoa dona** (mensagem com passos exatos): rodar `supabase/migrations/2026-10-18-lembrete-diario.sql` no SQL Editor; cadastrar `SUPABASE_SERVICE_ROLE_KEY` em Netlify > Project configuration > Environment variables (escopo Functions). Aguardar confirmação.
- [ ] **Step 5:** Com confirmação e autorização de push/deploy: `git push`, aguardar deploy `ready`, smoke test (site sem erros novos no console, `/push-sw.js` 200, `/badge-96x96.png` 200, `tmdb` intacto). Orientar a pessoa a ativar o lembrete no celular e usar "Run now" em Functions > daily-reminder; conferir o log da execução via CLI/API.
