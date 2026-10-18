# Lembrete diário por notificação push

Data: 2026-10-18 · Status: aprovado

## Objetivo

Uma vez por dia, às 19h (Brasília), cada pessoa que ativou o lembrete recebe no celular uma notificação com um título da lista **Tem que ver** da sua casa, sorteado, dizendo há quanto tempo ele espera:

> **O que vamos ver hoje? 🍿**
> Vikings foi adicionado há 50 dias e ainda não foi visto. Que tal dar o play?

Tocar na notificação abre o app no detalhe daquele título.

## Decisões

| Tema | Decisão |
|---|---|
| Horário | 19h de Brasília, igual para todos (cron `0 22 * * *` em UTC; o Brasil não tem horário de verão desde 2019). |
| Escopo do sorteio | Por casa: todos os membros inscritos recebem o mesmo título no dia. |
| Repetição | Sem repetir até passar por todos: exclui os títulos sorteados nos últimos `N − 1` lembretes da casa, onde `N` é o tamanho atual da lista Tem que ver. |
| Lista vazia | Nenhuma notificação naquele dia. |
| Card "Indicação do dia" | Independente; continua com a lógica atual. |
| Ativação | Opt-in por aparelho, num toque (exigência do navegador para pedir permissão). |
| Tecnologia | Web Push padrão (VAPID) + Netlify Scheduled Function + Supabase. Sem serviços de terceiros. |
| Custo | Nenhum no plano atual (Netlify Free legado: 125 mil execuções/mês; uso ≈ 30). |

Plataformas: Android (Chrome, app instalado ou não) e iPhone com o app instalado na tela inicial (iOS 16.4+).

## Arquitetura

```
[App] --toque "Lembrete diário"--> permissão + pushManager.subscribe(VAPID público)
      --rpc save_push_subscription--> [Supabase: push_subscriptions]

[Netlify cron 22:00 UTC] -> daily-reminder.ts
      -> lê inscrições + casas + títulos (service role)
      -> sorteia por casa, grava daily_reminders (trava diária)
      -> web-push -> [serviço de push do navegador] -> [service worker: push-sw.js]
      -> notificação; toque -> abre /?titulo=<id>
```

## Componentes

### 1. Banco (`supabase/migrations/2026-10-18-lembrete-diario.sql`, também anexado ao `schema.sql`)

**`push_subscriptions`**
- `id uuid pk`, `user_id uuid not null → auth.users on delete cascade`, `endpoint text not null unique`, `p256dh text not null`, `auth text not null`, `user_agent text`, `created_at timestamptz default now()`.
- RLS ativo. Política de leitura e exclusão só das próprias linhas (`user_id = auth.uid()`).
- Gravação via RPC `save_push_subscription(endpoint, p256dh, auth, user_agent)` (`security definer`): faz upsert por `endpoint` atribuindo `user_id = auth.uid()`. Assim, o mesmo aparelho reinscrito, inclusive por outra conta, não duplica.
- Remoção via RPC `delete_push_subscription(endpoint)`, que só apaga se for da própria pessoa.

**`daily_reminders`**
- `id bigint identity pk`, `household_id uuid not null → households on delete cascade`, `title_id uuid → titles on delete set null`, `sent_on date not null`, `created_at timestamptz default now()`.
- `unique (household_id, sent_on)`: trava de um lembrete por casa por dia.
- RLS ativo, sem políticas: acessível só pelo service role.

### 2. Lógica pura (`netlify/lib/reminder.ts`)

- `pickReminderTitle(watchlist, recentTitleIds, random)`: retorna um título ou `null`. Exclui os `recentTitleIds` limitados aos últimos `N − 1`. Se todos estiverem excluídos (lista mudou), sorteia entre todos. `random` é injetável para testes.
- `buildReminderMessage(title, now)`: devolve `{ title, body }`. Dias contados em datas de Brasília: "hoje", "ontem" ou "há N dias".
- `brasiliaDate(now)`: data `YYYY-MM-DD` em `America/Sao_Paulo`, usada em `sent_on`.

Testes em `netlify/lib/reminder.test.ts`, com `node --test`, sem dependência nova. Cobrem: sorteio dentro da lista, não repetição até esgotar, fallback quando tudo está excluído, lista vazia, textos de hoje/ontem/N dias e data de Brasília perto da meia-noite UTC.

### 3. Função agendada (`netlify/functions/daily-reminder.ts`)

`export const config = { schedule: '0 22 * * *' }`. Passos:
1. Cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` e a URL em `VITE_SUPABASE_URL`.
2. Carrega `push_subscriptions` e mapeia `user_id → household_id` via `household_members`. Agrupa as inscrições por casa.
3. Para cada casa: se já existe `daily_reminders` com `sent_on` de hoje, pula. Carrega os títulos `watchlist`; se não houver nenhum, pula. Carrega os últimos `title_id` sorteados e chama `pickReminderTitle`.
4. Insere o `daily_reminders`. Se der conflito de unicidade (outra execução chegou antes), pula a casa.
5. Envia com `web-push` (VAPID) para cada inscrição da casa. O payload é JSON: `{ title, body, url: '/?titulo=<id>', image, tag: 'lembrete-diario' }`. `image` é a URL absoluta da capa (`/.netlify/functions/tmdb?action=image…`, quando houver capa).
6. Resposta 404/410 do serviço de push: apaga a inscrição. Outros erros: registra no log e continua.
7. Ao final, registra um resumo no log (casas, enviados, removidos, falhas).

Erros de uma casa não interrompem as outras.

Variáveis no Netlify: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:sergiocouter@gmail.com`), `VITE_VAPID_PUBLIC_KEY` (mesma chave pública, embutida no build) e `SUPABASE_SERVICE_ROLE_KEY`, que a pessoa dona do projeto cadastra no painel.

Nova dependência de servidor: `web-push` (e `@types/web-push` em dev).

### 4. Service worker (`public/push-sw.js`)

Carregado via `workbox.importScripts: ['push-sw.js']` no `vite.config.ts`. O restante do SW continua gerado pelo `generateSW`.
- `push`: lê o JSON e chama `showNotification(title, { body, icon: '/pwa-192x192.png', badge: '/badge-96x96.png', image, tag, data: { url } })`.
- `notificationclick`: fecha a notificação. Se já houver uma janela do app aberta, foca e navega até `url`; senão, abre uma janela nova.

Novo ícone `public/badge-96x96.png`: silhueta branca monocromática, que o Android exige para a barra de status.

### 5. App

- **`src/lib/push.ts`**:
  - `getPushSupport()` retorna `unsupported`, `needs-install` (iOS fora do modo standalone), `denied`, `default` ou `granted`.
  - `isSubscribed()`.
  - `enableReminders()`: pede a permissão, chama `subscribe` com `userVisibleOnly: true` e a chave VAPID, depois a RPC `save_push_subscription`, e mostra uma notificação local de confirmação.
  - `disableReminders()`: `unsubscribe` + RPC de exclusão.
- **`src/components/ReminderToggle.tsx`**: cartão "Lembrete diário às 19h" com botão liga/desliga e mensagens para os estados especiais. Fica no menu lateral do `LibraryApp`, perto de "Instalar aplicativo". Não aparece no modo demonstração nem sem `VITE_VAPID_PUBLIC_KEY`.
- **Deep link**: o `LibraryApp`, depois de carregar os itens, lê `?titulo=<id>`, abre o `TitleModal` do item (se existir) e limpa o parâmetro com `history.replaceState`.

## Fora do escopo

Horário por pessoa, frequência configurável, notificações de outros eventos (título adicionado, nova temporada) e painel de estatísticas.

## Testes e verificação

1. `node --test` na lógica pura.
2. Lint, checagem de tipos (app e funções) e build.
3. Navegador headless: o cartão em cada estado, a ativação com permissão concedida, a inscrição gravada e o deep link `?titulo=` abrindo o modal.
4. Envio real: o handler `web-push` com chaves de teste entregando a um navegador de teste, e o `push-sw.js` exibindo a notificação.
5. Produção: após o deploy, "Run now" da função no painel do Netlify, com a notificação chegando no celular.

## Riscos

- **Inscrição nunca chega:** sem `SUPABASE_SERVICE_ROLE_KEY` ou sem a migração, a função registra o erro no log e não envia nada. Não afeta o resto do app.
- **iOS sem instalação:** não suporta push; o cartão explica como instalar.
- **Horário de verão:** se o Brasil voltar a adotá-lo, o cron passa a chegar às 20h até ser ajustado.
