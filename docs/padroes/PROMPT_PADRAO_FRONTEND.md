# Prompt padrão — Frontend de aplicativos Multicortex

> **Como usar:** copie tudo a partir de "INÍCIO DO PROMPT" e cole no início da conversa com a IA (Claude Code, Cursor etc.), substituindo os campos `{{...}}`. Depois descreva as telas/funcionalidades da fase atual.
> **Origem:** extraído do Multicortex CRM (`apps/frontend`, versão 0.1.2, outubro/2026). Onde o CRM tem uma dívida técnica conhecida, o padrão já traz a correção, marcada como **(evolução)**.
> Par deste documento: [`PROMPT_PADRAO_BACKEND.md`](PROMPT_PADRAO_BACKEND.md).

---

## INÍCIO DO PROMPT

Você vai construir o **frontend** do aplicativo **{{APP_NOME}}** da Multicortex.

- Descrição: {{DESCRICAO_CURTA}}
- Slug técnico: `{{app-slug}}` (pacote `@multicortex/{{app-slug}}-frontend`)
- Domínio de produção: `https://{{subdominio}}.multicortex.com.br`
- Público: {{QUEM_USA}} (desktop, tablet e celular)
- Módulos desta fase: {{LISTA_DE_MODULOS}}

O aplicativo precisa ter **a mesma identidade visual, estrutura e comportamento** do Multicortex CRM, que é a referência da empresa. Siga as regras abaixo sem desvios; se algo não estiver coberto, escolha a opção mais próxima do que já está definido aqui e diga qual foi a escolha.

### 1. Idioma e localização

- Toda a interface, mensagens de erro, textos de ajuda, e-mails e documentação em **português do Brasil**.
- Identificadores de código (variáveis, funções, tipos, arquivos) em **inglês**. Comentários em português, só quando explicam o porquê.
- Rotas de URL: recurso em inglês no plural, ações de criação/edição em português — `/leads`, `/leads/novo`, `/leads/:id`, `/leads/:id/editar`.
- Formatação sempre com `Intl`/`toLocale*` em `pt-BR`: data `dd/mm/aaaa`, moeda `R$ 1.234,56` (BRL), telefone `(11) 98765-4321` / `+55 (11) 98765-4321`, CPF/CNPJ com máscara. Fuso de referência: Brasília (UTC−03:00).
- Datas puras (`AAAA-MM-DD`) são formatadas com `timeZone: 'UTC'` para não "voltar um dia".

### 2. Stack obrigatória

| Item | Tecnologia | Versão |
|---|---|---|
| Linguagem | TypeScript, `strict: true`, `noUnusedLocals`, `noUnusedParameters` | 5.5+ |
| UI | React (function components + hooks) | 18.3 |
| Build/dev server | Vite + `@vitejs/plugin-react` | 5.4 |
| Estilo | TailwindCSS + PostCSS + Autoprefixer | 3.4 |
| Rotas | React Router DOM (`BrowserRouter` + `<Routes>`) | 6.26 |
| Estado de cliente | Zustand (`persist` só para preferências de UI) | 4.5 |
| HTTP | `fetch` nativo encapsulado em `lib/api.ts` (seção 9) | — |
| Ícones | Componente `Icon` próprio com SVG inline (seção 6) | — |
| Lint/format | ESLint 8 + `@typescript-eslint` + `eslint-config-prettier`; Prettier 3 | — |
| Runtime de build | Node.js 20 LTS | 20 |

**Complementos aprovados** (use quando o caso pedir, sem precisar justificar):

| Necessidade | Biblioteca |
|---|---|
| Cache/sincronização de dados do servidor em telas com muitas consultas **(evolução)** | `@tanstack/react-query` 5 |
| Formulários grandes com validação **(evolução)** | `react-hook-form` 7 + `zod` 3 + `@hookform/resolvers` |
| Arrastar e soltar com suporte a toque (Kanban etc.) **(evolução — o CRM usa DnD nativo do HTML5, que não funciona no celular)** | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Gráficos além de barras simples | `recharts` 2 |
| Fontes self-hosted **(evolução — o CRM declara Inter/Manrope, mas não as carrega)** | `@fontsource-variable/inter` + `@fontsource-variable/manrope` |

**Proibido:** kits de componentes prontos (MUI, Ant Design, Chakra, Bootstrap, shadcn com tema próprio), CSS-in-JS (styled-components, Emotion), Sass, Axios, Redux, Moment.js, jQuery, bibliotecas de ícones com traço diferente do padrão. Não adicione dependências fora das listas acima sem avisar e justificar.

### 3. Estrutura do projeto

Os apps da Multicortex são **monorepos com npm workspaces**:

```
{{app-slug}}/
├── apps/
│   ├── frontend/                 # este projeto
│   └── backend/                  # NestJS (ver prompt padrão de backend)
├── packages/
│   └── shared/                   # tipos/DTOs compartilhados front ↔ back
├── infra/                        # Dockerfiles, docker-compose, nginx
├── docs/
├── .eslintrc.cjs  .prettierrc  package.json  .env.example
```

Dentro de `apps/frontend/`:

```
index.html                 # lang="pt-BR", meta theme-color, manifest, viewport-fit=cover
public/
  manifest.webmanifest     # PWA (display standalone, theme_color #30224a, background #f6f7fb)
  icons/multicortex-192.png, multicortex-512.png
  favicon.png / favicon.svg
src/
  main.tsx                 # StrictMode > ErrorBoundary > BrowserRouter > App
  App.tsx                  # bootstrap (refresh silencioso) + todas as rotas
  index.css                # tokens, componentes CSS e regras mobile (seção 5)
  assets/logo.png
  components/              # AppShell, PageHeader, AuthLayout, ErrorBoundary, Icon, MaskedInputs...
  components/<dominio>/    # componentes compartilhados por um domínio (ex.: leads/kanban)
  pages/                   # uma pasta por módulo: <modulo>/<Modulo>ListPage.tsx, FormPage, DetailPage
  lib/                     # api.ts, <modulo>Api.ts, formatters.ts, version.ts
  store/                   # useAuthStore.ts, useUiStore.ts
  routes/                  # ProtectedRoute.tsx, RequirePermission.tsx
  types/                   # tipos por domínio + mapas de rótulo/cor (ex.: TASK_STATUS_LABELS)
```

- Uma página = um arquivo `XxxPage.tsx` com `export default`. Componentes reutilizáveis usam export nomeado.
- Cada módulo tem seu cliente em `lib/<modulo>Api.ts`, exportando um objeto (`leadsApi.list`, `leadsApi.get`, …) que usa `apiJson`.
- Rótulos e cores de enums ficam em `types/<modulo>.ts` como `Record<Enum, string>` — nunca espalhados nas telas.
- Exiba a versão do app (`__APP_VERSION__`, injetada pelo `vite.config.ts` a partir do `package.json`) no rodapé do menu lateral.

`vite.config.ts` padrão:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3333';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: proxyTarget, changeOrigin: true } },
  },
});
```

O frontend sempre chama a API pelo **mesmo host** (`/api/v1`), via proxy do Vite em dev e do Nginx em produção — assim funciona em celular na mesma rede sem configurar `localhost`.

### 4. Identidade visual

#### 4.1 Paleta de cores (tokens)

| Token CSS | Classe Tailwind | Hex (claro) | Hex (escuro) | Uso |
|---|---|---|---|---|
| `--color-brand-purple` | `brand-purple` | `#74529f` | = | **Cor primária**: botões primários, links, foco, eyebrow, itens ativos |
| `--color-brand-purple-dark` | `brand-purple-dark` | `#523e86` | = | Hover do primário, texto do item de menu ativo, gradientes |
| `--color-brand-orange` | `brand-orange` | `#f68e35` | = | Destaque/acento: badge de notificação, avatar (gradiente com roxo) |
| `--color-brand-blue` | `brand-blue` | `#4a80c0` | = | Informação, métricas secundárias, fim do gradiente da tela de login |
| `--color-brand-blue-dark` | `brand-blue-dark` | `#2e507e` | = | Variação escura do azul |
| `--color-brand-cyan` | `brand-cyan` | `#52c9e9` | = | Acento pontual em gráficos |
| `--color-success` | `success` | `#42ad83` | = | Sucesso, ganho, status ativo |
| `--color-success-light` | `success-light` | `#85c557` | = | Variação clara de sucesso |
| `--color-warning` | `warning` | `#eac634` | = | Alerta, prazo próximo |
| `--color-danger` | `danger` | `#ef325a` | = | Erro, perda, exclusão, atraso |
| `--color-surface` | `surface` | `#ffffff` | `#1f1c2c` | Cards, modais, header |
| `--color-surface-muted` | `surface-muted` | `#f5f5f5` | `#2a2638` | Fundos secundários dentro de cards |
| `--color-app-bg` | `app-bg` | `#f6f7fb` | `#151320` | Fundo da aplicação |
| `--color-sidebar` | `sidebar` | `#30224a` | `#211832` | Menu lateral; também `theme-color` do navegador/PWA |
| `--color-ink` | `ink` | `#363435` | `#f5f5f5` | Texto base do `body` |

Neutros: a escala `slate` do Tailwind (`slate-900` títulos, `slate-700` labels, `slate-600` texto de tabela, `slate-500` descrições, `slate-400` legendas/placeholders, `slate-200` bordas, `slate-100` divisórias, `slate-50` cabeçalho de tabela).

Fundos suaves de ícones e chips seguem o par `bg-<cor>-50 text-<cor>-600`: `bg-purple-50 text-brand-purple`, `bg-emerald-50 text-emerald-600`, `bg-blue-50 text-brand-blue`, `bg-red-50 text-red-600`, `bg-orange-50 text-orange-600`.

Cores que vêm do banco (etapas, prioridades, categorias configuráveis) são aplicadas com `style={{ backgroundColor: item.color }}` em pílulas com texto branco ou em `status-dot`.

**Gradiente de marca** (tela de login e áreas hero): `bg-gradient-to-br from-brand-purple-dark via-brand-purple to-brand-blue`.
**Avatar sem foto:** iniciais (2 letras) sobre `bg-gradient-to-br from-brand-orange to-brand-purple`.

#### 4.2 Tipografia

- **Inter** — texto (`font-sans`). **Manrope** — títulos (`font-heading`). Carregue ambas com `@fontsource-variable/*` importadas no `main.tsx` **(evolução)**; nada de Google Fonts em runtime.
- Escala usada:

| Elemento | Classes |
|---|---|
| Título da página (h1) | `font-heading text-2xl md:text-[28px] font-bold tracking-tight text-slate-900` |
| Eyebrow (sobretítulo) | `text-[11px] font-bold uppercase tracking-[0.16em] text-brand-purple` |
| Descrição da página | `text-sm leading-6 text-slate-500 max-w-2xl` |
| Título de seção/card (h2) | `font-heading font-bold text-slate-800` (+ subtítulo `text-xs text-slate-400`) |
| Título de modal | `font-heading text-xl font-bold text-slate-900` |
| Valor de métrica | `font-heading text-2xl font-bold text-slate-900` |
| Label de formulário | `text-[13px] font-semibold text-slate-700` (classe `form-label`) |
| Corpo | `text-sm` |
| Cabeçalho de tabela | `text-[11px] font-bold uppercase tracking-wider text-slate-500` |
| Legenda/meta | `text-[11px] text-slate-400` |
| Rótulo de grupo no menu | `text-[10px] font-bold uppercase tracking-[0.18em] text-white/35` |

#### 4.3 Forma, sombra e espaçamento

- Raios: cards `rounded-2xl`; botões, inputs, tiles de ícone e itens de menu `rounded-xl`; subitens/chips `rounded-lg`; pílulas `rounded-full`.
- Sombra padrão de card: `shadow-sm shadow-slate-200/50`; modais `shadow-2xl`; hover de card clicável: `hover:-translate-y-0.5 hover:shadow-lg`.
- Alturas: botão `h-10`, input `h-11`, botão-ícone `h-9 w-9`, tile de ícone `h-11 w-11`; no celular, alvo mínimo de toque 44px.
- Grade de espaçamento: `gap-4`/`gap-5` entre cards, `p-5 md:p-6` dentro deles, `mb-7` abaixo do `PageHeader`.

### 5. `index.css` base (copiar e manter)

Este é o arquivo de estilo base de todo app Multicortex. Componentes novos devem preferir os tokens (`bg-surface`, `text-ink`, `bg-app-bg`) para que o tema escuro funcione sem regras extras **(evolução)**; o bloco `.dark` com sobrescritas de classes `slate`/`bg-white` existe para manter compatibilidade com o padrão do CRM.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-brand-purple: #74529f;
  --color-brand-purple-dark: #523e86;
  --color-brand-orange: #f68e35;
  --color-brand-blue: #4a80c0;
  --color-brand-blue-dark: #2e507e;
  --color-brand-cyan: #52c9e9;
  --color-success: #42ad83;
  --color-success-light: #85c557;
  --color-warning: #eac634;
  --color-danger: #ef325a;
  --color-surface: #ffffff;
  --color-surface-muted: #f5f5f5;
  --color-ink: #363435;
  --color-app-bg: #f6f7fb;
  --color-sidebar: #30224a;
}

.dark {
  --color-surface: #1f1c2c;
  --color-surface-muted: #2a2638;
  --color-ink: #f5f5f5;
  --color-app-bg: #151320;
  --color-sidebar: #211832;
}

body {
  margin: 0;
  min-width: 320px;
  overflow-x: hidden;
  background-color: var(--color-app-bg);
  color: var(--color-ink);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

button, a, input, select, textarea { -webkit-tap-highlight-color: transparent; }
button, a { touch-action: manipulation; }
input, select, textarea { font-size: 16px; } /* evita zoom automático no iOS */

.skip-link {
  position: fixed; left: 1rem; top: -4rem; z-index: 100;
  border-radius: 0.75rem; background: var(--color-brand-purple-dark); color: white;
  padding: 0.75rem 1rem; font-weight: 700; transition: top 150ms ease;
}
.skip-link:focus { top: 1rem; }
:focus-visible { outline: 3px solid rgb(116 82 159 / 35%); outline-offset: 2px; }

/* Tema escuro — compatibilidade com classes slate/bg-white */
.dark body { background: var(--color-app-bg); color: #e8e5ef; }
.dark header { border-color: rgb(71 65 85 / 70%); background-color: rgb(30 27 43 / 90%); }
.dark .card { border-color: rgb(71 65 85 / 75%); background-color: #211e2e; box-shadow: none; }
.dark .bg-white { background-color: #211e2e; }
.dark .bg-slate-50\/80, .dark .bg-slate-50 { background-color: #292536; }
.dark .text-slate-900, .dark .text-slate-800, .dark .text-slate-700 { color: #f1eef7; }
.dark .text-slate-600, .dark .text-slate-500 { color: #bdb7c9; }
.dark .text-slate-400 { color: #938ba3; }
.dark .border-slate-200, .dark .border-slate-200\/80, .dark .border-slate-100 { border-color: rgb(71 65 85 / 75%); }
.dark .form-control { border-color: #4a4359; background: #292536; color: #f1eef7; }
.dark .form-label { color: #ddd8e7; }
.dark .data-table thead { border-color: #4a4359; background: #292536; }
.dark .data-table td { border-color: #3a3548; color: #c8c2d3; }
.dark .data-table tbody tr:hover { background: rgb(116 82 159 / 12%); }
.dark .icon-button { color: #bdb7c9; }
.dark .icon-button:hover { background: #302b3f; color: white; }

@layer components {
  .card { @apply rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50; }
  .btn-primary { @apply inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-purple-dark focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:opacity-60; }
  .btn-secondary { @apply inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50; }
  .btn-danger { @apply inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50; }
  .icon-button { @apply inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800; }
  .form-label { @apply mb-1.5 block text-[13px] font-semibold text-slate-700; }
  .form-control { @apply h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-purple focus:ring-4 focus:ring-purple-100; }
  textarea.form-control { @apply h-auto min-h-[100px] py-3; }
  .form-section { @apply card overflow-hidden; }
  .form-section-header { @apply border-b border-slate-100 px-5 py-4 md:px-6; }
  .form-section-body { @apply grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 md:p-6; }
  .table-shell { @apply card overflow-hidden; }
  .data-table { @apply w-full min-w-[760px] text-left text-sm; }
  .data-table thead { @apply border-b border-slate-200 bg-slate-50/80; }
  .data-table th { @apply whitespace-nowrap px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500; }
  .data-table td { @apply border-b border-slate-100 px-5 py-4 text-slate-600; }
  .data-table tbody tr { @apply transition hover:bg-purple-50/50; }
  .data-table tbody tr:last-child td { @apply border-b-0; }
  .filter-panel { @apply card mb-5 p-4; }
  .status-dot { @apply inline-block h-2 w-2 rounded-full; }
}

@media (max-width: 767px) {
  .mobile-sidebar { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
  .mobile-header { height: calc(3.75rem + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); }
  #conteudo-principal { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom)); }
  .page-header { margin-bottom: 1.25rem; }
  .page-header h1 { font-size: 1.5rem; line-height: 1.25; overflow-wrap: anywhere; }
  .page-actions { display: grid; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .page-actions > button, .page-actions > a { width: 100%; min-width: 0; padding-inline: 0.75rem; }
  .page-actions > :only-child { grid-column: 1 / -1; }
  .btn-primary, .btn-secondary, .btn-danger { min-height: 44px; }
  .icon-button { min-width: 44px; min-height: 44px; }
  .form-control { min-height: 46px; }
  textarea.form-control { min-height: 110px; }
  .card { border-radius: 1rem; }
  .form-section-header, .form-section-body { padding: 1rem; }
  .table-shell, .overflow-x-auto { overscroll-behavior-inline: contain; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
  .data-table { min-width: 680px; }
  .data-table th { padding: 0.75rem 1rem; }
  .data-table td { padding: 0.875rem 1rem; }
  .filter-panel { padding: 0.875rem; }
  .mobile-modal-overlay { align-items: flex-end; padding: 0; }
  .mobile-modal-panel {
    max-height: calc(100dvh - env(safe-area-inset-top)); width: 100%; overflow-y: auto;
    border-bottom-right-radius: 0; border-bottom-left-radius: 0;
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
  }
}

@media (min-width: 768px) {
  input, select, textarea { font-size: 0.875rem; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          purple: 'var(--color-brand-purple)',
          'purple-dark': 'var(--color-brand-purple-dark)',
          orange: 'var(--color-brand-orange)',
          blue: 'var(--color-brand-blue)',
          'blue-dark': 'var(--color-brand-blue-dark)',
          cyan: 'var(--color-brand-cyan)',
        },
        success: { DEFAULT: 'var(--color-success)', light: 'var(--color-success-light)' },
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        'app-bg': 'var(--color-app-bg)',
        sidebar: 'var(--color-sidebar)',
        ink: 'var(--color-ink)',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Manrope Variable', 'Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '12px' },
    },
  },
  plugins: [],
} satisfies Config;
```

### 6. Layout e componentes

#### 6.1 `AppShell` (toda tela autenticada)

- **Menu lateral fixo à esquerda**, fundo `bg-sidebar`, texto branco, `w-64` (256px) expandido e `w-20` (80px) recolhido em `lg+`; o conteúdo recebe `lg:pl-64` / `lg:pl-20`. Botão redondo de recolher (`h-7 w-7`, `-right-3 top-28`) na borda do menu. Estado de recolhido e tema persistidos em `useUiStore` (Zustand `persist`, chave `multicortex-ui`).
- Topo do menu (`h-24`, borda `border-white/10`): **logo sobre uma pílula branca** (`rounded-xl bg-white py-2 shadow-md`), nunca diretamente sobre o roxo.
- Grupo "Workspace" (rótulo pequeno em caixa alta) e itens `rounded-xl px-3 py-3 text-sm font-medium` com ícone de 19px. Inativo: `text-white/70 hover:bg-white/10 hover:text-white`. **Ativo: `bg-white text-brand-purple-dark shadow-lg shadow-black/10`.**
- Grupos expansíveis (ex.: "Configurações", "Visões/Relatórios") com chevron que gira 180°; subitens indentados com `border-l border-white/10`, `text-xs`, ativo `bg-white text-brand-purple-dark`. Clicar num grupo com o menu recolhido expande o menu.
- Itens filtrados pelas permissões do usuário — nunca mostre link para uma área que o usuário não pode abrir.
- Rodapé do menu: cartão do usuário (`bg-white/[0.06]`, avatar 36px `rounded-xl`, nome e perfil), botão "Sair da plataforma" e "Versão x.y.z" em `text-[10px] text-white/30`.
- **Header** sticky `h-16`, `bg-white/90 backdrop-blur`, borda inferior `border-slate-200/80`: à esquerda botão de menu (só `< lg`); à direita alternância de tema (sol/lua), sino de notificações com ponto laranja, nome e e-mail do usuário (`sm+`).
- **Conteúdo**: `<main id="conteudo-principal" tabIndex={-1}>` com `mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8`. Link "Ir para o conteúdo principal" (`.skip-link`) como primeiro elemento focável.
- Mobile (`< lg`): menu vira gaveta (`max-w-[88vw]`, `-translate-x-full` ↔ `translate-x-0`) com overlay `bg-slate-950/45`; fecha ao navegar.

#### 6.2 `PageHeader`

Toda página começa com `<PageHeader eyebrow title description actions />`: bloco de texto à esquerda, ações à direita (`md:flex-row md:items-end`). Ações: no máximo uma `btn-primary` (a ação principal, ex.: "Nova oportunidade" com ícone `plus`) e as demais `btn-secondary`. No celular as ações viram grade de 2 colunas.

#### 6.3 `AuthLayout` (login, esqueci a senha, redefinir senha, troca obrigatória)

Tela dividida em `lg:grid-cols-[1.05fr_.95fr]`:
- Esquerda (só `lg+`): gradiente de marca, círculos decorativos (`border-white/10` e `bg-white/10 blur-3xl`), logo em cartão branco `rounded-3xl px-8 py-6 shadow-2xl`, eyebrow, headline `font-heading text-5xl font-bold` e texto `text-white/65`; rodapé "© Multicortex · {{APP_NOME}}".
- Direita: `bg-app-bg`, cartão `card p-7 md:p-9 max-w-md` com eyebrow "Bem-vindo", título e formulário. No celular, logo acima do cartão.

#### 6.4 Padrões de tela

- **Listagem:** `PageHeader` → `filter-panel` (busca com ícone, selects, botão limpar filtros) → `table-shell` com `data-table` dentro de `overflow-x-auto` → paginação (anterior/próxima + "x–y de N"). Ordenação clicável no cabeçalho. Filtros e página refletidos na URL (`useSearchParams`) para links compartilháveis.
- **Formulário:** sequência de `form-section` (cabeçalho com título + descrição, corpo em grade de 2 colunas no desktop). Campos obrigatórios com `*` no label. Barra de ações fixa no fim (`sticky bottom-4`), com "Cancelar" (`btn-secondary`) e "Salvar" (`btn-primary`, desabilitado durante o envio com texto "Salvando…").
- **Detalhe:** cabeçalho com nome, código e pílulas de status; abas (dados, linha do tempo, anexos, tarefas…); ações destrutivas (`btn-danger`) separadas das demais.
- **Dashboard:** grade de cards de métrica `sm:grid-cols-2 xl:grid-cols-4` (rótulo `text-xs font-semibold text-slate-400`, valor `font-heading text-2xl font-bold`, legenda `text-[11px]`, tile de ícone `h-11 w-11 rounded-xl` com par de cor suave); seções em `card p-5 md:p-6` numa grade `xl:grid-cols-[1.35fr_.65fr]`. Cards de métrica clicáveis levam à listagem já filtrada.
- **Kanban:** colunas com rolagem horizontal, cabeçalho com nome, ponto na cor da etapa, contagem e soma de valores; cards `rounded-xl border p-4 shadow-sm` com hover elevado; atualização otimista ao mover, com retorno à coluna original em caso de erro.
- **Modal:** overlay `mobile-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm`; painel `mobile-modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl`; tile de ícone `h-11 w-11 rounded-xl bg-purple-50 text-brand-purple`, título, texto explicativo `text-sm leading-6 text-slate-500`, campos, ações alinhadas à direita. No celular vira bottom sheet (regras da seção 5). Fecha com `Esc` e devolve o foco a quem abriu.
- **Drawer lateral** (detalhe rápido): `fixed inset-0 z-[60] flex justify-end bg-slate-950/40 backdrop-blur-sm` com painel à direita.
- **Pílulas e chips:** status com cor do banco → `rounded-full px-2.5 py-1 text-xs font-semibold text-white` + `style={{ backgroundColor }}`; prioridades/enums → `rounded-lg px-2 py-1 text-[10px] font-bold` com par suave (`bg-red-50 text-red-600` etc.).
- **Semáforo de prazo:** ponto `h-2.5 w-2.5 rounded-full` com `aria-label` — vermelho `bg-red-500` vencido, âmbar `bg-amber-400` em até 5 dias, verde `bg-emerald-500` acima de 5 dias.
- **Estados obrigatórios em toda tela com dados:** carregando (`card` com "Carregando …" em `text-sm text-slate-400`, ou skeleton), vazio (texto centralizado `py-8 text-sm text-slate-400` + ação para criar), erro (`rounded-xl bg-red-50 p-4 text-red-600` com a mensagem do backend).
- **Confirmações e avisos (evolução):** use um `ConfirmDialog` no padrão de modal e um componente de toast (canto inferior direito no desktop, topo no celular) — **não use `window.alert/confirm`**. Exclusão física pede para digitar o nome do registro.
- `ErrorBoundary` global com logo, "Não foi possível exibir esta página", "Seus dados permanecem seguros." e botão "Recarregar aplicação".
- `BootSplash` enquanto tenta o refresh silencioso: logo centralizado com `animate-pulse`.

#### 6.5 Ícones

Componente `Icon` próprio (`components/Icon.tsx`) com união de nomes (`IconName`) e paths SVG inline, renderizados com:

```tsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
```

Estilo de traço (outline, 1.8, cantos arredondados) compatível com Lucide; para ícones que não existem no conjunto, copie o path do Lucide para o componente em vez de instalar outra biblioteca. Tamanhos: 16px em botões (`h-4 w-4`), 19–20px no menu/header, 20px em tiles de ícone.

### 7. Responsividade, PWA e acessibilidade

- Mobile-first; breakpoints Tailwind padrão (`sm 640`, `md 768`, `lg 1024`, `xl 1280`). Largura mínima suportada: 320px, sem rolagem horizontal da página (tabelas rolam dentro do próprio contêiner).
- `viewport-fit=cover` + `env(safe-area-inset-*)` em header, menu, modais e barras fixas.
- Manifest PWA instalável (nome, `short_name`, ícones 192/512, `display: standalone`, `theme_color #30224a`, `background_color #f6f7fb`) e metas `apple-mobile-web-app-*`.
- Tema claro/escuro alternável e persistido; aplicar com `document.documentElement.classList.toggle('dark')` e `style.colorScheme`.
- Foco visível (`:focus-visible` roxo), navegação completa por teclado, `aria-label` em todo botão só com ícone, `alt` em imagens, labels associados aos campos, contraste AA, respeito a `prefers-reduced-motion`.

### 8. Autenticação, sessão e permissões

- `useAuthStore` (Zustand, **sem persist**): `user`, `accessToken`, `isAuthenticated`, `setSession`, `clearSession`. O access token fica **somente em memória**; nunca em `localStorage`/`sessionStorage`.
- O refresh token é um cookie `httpOnly` emitido pelo backend; o frontend nunca o lê.
- Ao abrir o app, `App.tsx` chama `attemptSilentRefresh()` e mostra o `BootSplash` até terminar.
- `ProtectedRoute` (exige sessão; redireciona para `/login` guardando `state.from`) e `RequirePermission permission="modulo.acao"` (redireciona para `/`) envolvem cada rota. Permissões vêm do usuário (`user.permissions: string[]`) e também escondem botões/itens de menu — mas **a regra real está sempre no backend**.
- Fluxos de auth obrigatórios: login (com "lembrar e-mail" — único dado guardado em `localStorage`), esqueci a senha, redefinir senha (`/reset-password?token=`), troca obrigatória de senha no primeiro acesso (`/change-password`) e sair.
- Se houver portal para usuários externos (ex.: perfil `THIRD_PARTY`), ele tem rota raiz própria (ex.: `/terceiro`) e `ProtectedRoute` devolve esses usuários ao portal.

### 9. Comunicação com a API

`lib/api.ts` é o único ponto que chama `fetch`:

- Base `import.meta.env.VITE_API_URL ?? '/api/v1'`; `credentials: 'include'`; `Authorization: Bearer <token da store>`; `Content-Type: application/json` automático (exceto `FormData`).
- Em **401**, faz refresh com **uma única promessa compartilhada** (evita corrida de vários refreshes) e repete a requisição uma vez; se falhar, `clearSession()`.
- `apiJson<T>()` lança `Error` com a mensagem do backend (`message` string ou array unido por `. `); 204 retorna `undefined`.
- Listagens paginadas seguem o contrato `{ items, total, page, pageSize, totalPages }`.
- Uploads com `FormData` (campo `file`); downloads por URL da API com o token.
- Tipos de request/response compartilhados ficam em `packages/shared` quando usados pelos dois lados.

### 10. Convenções de código

- Prettier: `{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100, "tabWidth": 2 }`.
- ESLint: `eslint:recommended` + `plugin:@typescript-eslint/recommended` + `eslint-config-prettier`; variáveis não usadas só com prefixo `_`.
- Function components com tipagem explícita das props; sem `any`; sem `React.FC`.
- Estilo só com classes Tailwind e as classes de componente do `index.css`; `style={}` apenas para cores dinâmicas vindas do banco.
- Nenhum arquivo `.js` compilado versionado ao lado de `.ts/.tsx`; `dist/` no `.gitignore`.
- Scripts do `package.json`: `dev` (`vite --host`), `build` (`tsc -b && vite build`), `preview`, `lint`.

### 11. Entrega de cada fase

Ao terminar, confirme:

1. `npm run lint` e `npm run build` sem erros.
2. Telas conferidas em 360px, 768px e 1440px, nos temas claro e escuro.
3. Toda rota nova protegida por `ProtectedRoute` + `RequirePermission`, e todo item de menu filtrado por permissão.
4. Estados de carregando, vazio e erro implementados.
5. Textos 100% em português, valores e datas no formato brasileiro.
6. Nenhuma dependência fora da seção 2.
7. README atualizado com a seção da fase (o que entrou, rotas, permissões).

## FIM DO PROMPT
