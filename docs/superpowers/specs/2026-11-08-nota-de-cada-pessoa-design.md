# Nota de cada pessoa

Data: 2026-11-08 · Status: em revisão

## Objetivo

Hoje cada título tem **uma** nota da casa, que qualquer pessoa sobrescreve. Passa a ser **uma nota por pessoa** (1 a 5 estrelas), com a **média da casa** e **quem avaliou** visíveis no cartão da lista e na tela do título.

```
Cartão da lista                 Tela do título — Termômetro da casa
┌──────────────┐                Termômetro da casa        ★ 4,5 · 2 notas
│    capa      │                Sua nota   ★ ★ ★ ★ ★   5/5   (editável)
└──────────────┘                Priscila   ★ ★ ★ ★ ☆   4/5
Ruptura
★ 4,5 média
Sérgio   ★★★★★
Priscila ★★★★☆
```

## Decisões

| Tema | Decisão |
|---|---|
| Quem edita | Cada pessoa cria, altera e apaga **só a própria** nota. Todos da casa veem todas. |
| Notas antigas | Viram a nota de **quem adicionou** o título (`titles.added_by`). Produção hoje: 3 títulos com nota, nenhum sem autor — nada se perde. |
| Média | Calculada no app a partir das notas, com uma casa decimal (`4,5`). Sem nota nenhuma: nada aparece. |
| Cartão da lista | Média + uma linha por pessoa (primeiro nome + estrelas). O selo de estrela sobre a capa (`card-rating`) sai. |
| Tela do título | Média e contagem no topo da seção; a linha "Sua nota" é editável; as notas das outras pessoas aparecem abaixo, só leitura. |
| Apagar a própria nota | Tocar de novo na estrela que já está marcada. |
| Quando salva | Junto com "Salvar alterações", como hoje. |
| Coluna antiga `titles.rating` | Deixa de ser lida e escrita pelo app, mas **fica no banco** (permite desfazer). Uma versão antiga do app em cache que ainda a escreva não afeta nada. |
| Indicação do dia | Usa a média no lugar da nota única; texto: "Levou 4,5/5 no termômetro da casa". |
| Modo demonstração | As notas de exemplo aparecem como notas do "Sérgio"; tudo continua no armazenamento local. |

## Componentes

### 1. Banco (`supabase/migrations/2026-11-08-nota-de-cada-pessoa.sql`, também anexado ao `schema.sql`)

- Tabela `public.title_ratings`: `title_id` (→ `titles`, apaga junto), `user_id` (→ `auth.users`, apaga junto), `rating smallint` (1–5), `rated_at timestamptz default now()`. Chave primária `(title_id, user_id)`; índice em `user_id`.
- RLS ligado. `grant select, insert, update, delete` para `authenticated`; nada para `anon`.
- Políticas:
  - ler: título de uma casa da qual a pessoa é membro (`is_household_member` do título);
  - criar: `user_id = auth.uid()` **e** membro da casa do título;
  - alterar: só a própria linha (`user_id = auth.uid()` no `using` e no `with check`), continuando membro;
  - apagar: só a própria linha.
- Migração dos dados: `insert into title_ratings (title_id, user_id, rating, rated_at) select id, added_by, rating, coalesce(watched_at, status_changed_at) from titles where rating is not null and added_by is not null on conflict do nothing`.

### 2. Tipos e dados (`src/types.ts`, `src/services/library.ts`)

- `PersonRating = { userId: string; name: string; rating: number }`.
- `LibraryItem` ganha `ratings: PersonRating[]`; `rating` passa a ser a **média** derivada (só leitura).
- `listItems` busca as notas dos títulos da casa e junta os nomes pelo `profiles` (o mesmo lote que já busca quem adicionou).
- `toRow` para de enviar `rating`; `fromRow` para de ler `titles.rating`.
- Nova `saveMyRating(titleId, userId, rating | null)`: `upsert` na própria linha ou `delete` quando `null`.
- Funções puras e testáveis num módulo próprio (`src/lib/ratings.ts`): média, montar `ratings` a partir das linhas e nomes, aplicar a minha nota numa lista (`withMyRating`).

### 3. Telas

- `TitleModal`: seção "Termômetro da casa" com média + contagem, "Sua nota" editável (tocar na mesma estrela apaga) e as notas das outras pessoas. A nota editada fica no rascunho até "Salvar alterações".
- `LibraryApp.handleSave`: salva o título; se a minha nota mudou, chama `saveMyRating` e atualiza `ratings` e a média do item na lista.
- Cartão da lista: média + linhas por pessoa (primeiro nome, estrelas), no lugar do selo sobre a capa.
- `dailyRecommendation`: sem mudança de lógica (já lê `item.rating`); só o texto passa a formatar decimal.

## Fora do escopo

- Notificar a casa quando alguém dá nota.
- Esconder as notas dos outros até a pessoa dar a sua.
- Remover a coluna `titles.rating` (fica para uma limpeza futura, depois que todos os aparelhos atualizarem).

## Testes e verificação

- Testes automáticos de `src/lib/ratings.ts`: média (inclui sem notas e decimal), junção de notas com nomes (pessoa sem perfil vira "Alguém"), aplicar/apagar a minha nota.
- Banco: depois de aplicar a migração, conferir que as 3 notas antigas foram para `title_ratings` com o autor certo, e testar as políticas numa transação desfeita (não consigo alterar a nota de outra pessoa; consigo a minha).
- Navegador (modo demonstração): dar, mudar e apagar a minha nota; cartão com média e linhas por pessoa; indicação do dia com média.

## Riscos

- **Aplicar a migração antes de publicar o app**: o app antigo continua funcionando (lê e escreve `titles.rating`); o novo passa a ler `title_ratings`. Ordem: migração → push (deploy automático).
- **Cartão mais alto** com muitas notas: com mais de 3 pessoas, mostra as 3 primeiras e "+N".
