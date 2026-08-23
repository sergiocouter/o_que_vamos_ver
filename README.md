# O que vamos ver?

PWA familiar para guardar filmes, séries e realities que queremos assistir. A lista é compartilhada entre os membros de uma casa e registra quando cada título entrou em **Tem que ver**, começou em **Tô vendo** e terminou em **Já vi**.

## O que já funciona

- Login com e-mail/senha e Google pelo Supabase Auth.
- Casas compartilhadas com código de convite.
- Busca de filmes, séries e realities no TMDB, com capa, sinopse e metadados.
- Listas **Tem que ver**, **Tô vendo** e **Já vi**.
- Datas de inclusão, início, conclusão e histórico de mudanças no banco.
- Progresso geral e temporada por temporada para séries e realities.
- Termômetro de 1 a 5, notas da família e indicação de quem recomendou.
- Filtros, pesquisa na lista e lembrete para títulos “enrolados”.
- Layout responsivo e instalação como aplicativo no celular.
- Modo de demonstração local quando o Supabase ainda não está configurado.

## Rodar localmente

Requisitos: Node.js 22 ou mais recente.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem as variáveis do Supabase, o app abre automaticamente no modo demonstração. Para testar também a função de busca do TMDB localmente, use o Netlify Dev:

```bash
npx netlify-cli dev
```

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com/).
2. Abra **SQL Editor**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e execute.
3. Em **Project Settings > API**, copie a URL do projeto e a chave publicável.
4. Coloque os valores no `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
```

O SQL ativa Row Level Security. Uma pessoa autenticada só consegue ler ou alterar dados das casas das quais participa.

## 2. Ativar o login com Google

1. No Google Auth Platform, crie um cliente OAuth do tipo **Web application**.
2. Em **Authorized JavaScript origins**, adicione:
   - `http://localhost:5173`
   - `https://SEU-SITE.netlify.app`
3. Em **Authorized redirect URIs**, adicione a callback mostrada em **Supabase > Authentication > Providers > Google**. Ela terá o formato:
   - `https://SEU-PROJETO.supabase.co/auth/v1/callback`
4. Copie o Client ID e Client Secret para o provedor Google no Supabase e ative-o.
5. Em **Supabase > Authentication > URL Configuration**:
   - defina **Site URL** como `https://SEU-SITE.netlify.app`;
   - adicione `http://localhost:5173/**` nas Redirect URLs;
   - se usar previews do Netlify, adicione `https://**--SEU-SITE.netlify.app/**`.

## 3. Configurar o catálogo TMDB

1. Crie uma conta no [TMDB](https://www.themoviedb.org/) e solicite acesso à API.
2. Em suas configurações de API, copie o **API Read Access Token**.
3. No Netlify, cadastre `TMDB_API_TOKEN` com esse token.

O token fica somente na Netlify Function e não é enviado ao navegador.

## 4. Publicar no Netlify

1. Em **Add new site > Import an existing project**, conecte este repositório.
2. O arquivo `netlify.toml` já define:
   - build: `npm run build`;
   - diretório publicado: `dist`;
   - funções: `netlify/functions`;
   - redirecionamento de SPA e cabeçalhos de segurança.
3. Em **Project configuration > Environment variables**, cadastre:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `TMDB_API_TOKEN`
4. Faça o deploy e atualize os endereços autorizados no Supabase/Google com o domínio final.

## Instalar no celular

- **Android/Chrome:** abra o site e toque em **Instalar aplicativo** ou use o menu > **Adicionar à tela inicial**.
- **iPhone/Safari:** abra o site, toque em **Compartilhar** > **Adicionar à Tela de Início**.

## Próximas ideias

- Votos individuais de cada familiar e média da casa.
- Botão “sortear o que assistir hoje”, com filtros de duração e gênero.
- Onde assistir (Netflix, Prime Video etc.) e alerta quando entrar em um streaming.
- Perfis infantis e classificação indicativa.
- Lista de favoritos e ranking anual da família.
- Comentários/reactions sem spoilers e retrospectiva do ano.
- Notificação quando uma nova temporada estiver disponível.

## Comandos

```bash
npm run dev      # desenvolvimento
npm run lint     # análise estática
npm run build    # build de produção + PWA
npm run preview  # prévia do build
```

Os dados de catálogo são fornecidos por [The Movie Database (TMDB)](https://www.themoviedb.org/). Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
