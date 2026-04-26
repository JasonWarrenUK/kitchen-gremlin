# Kitchen Gremlin — Tech Stack Spec v0.1

This document defines *how* Kitchen Gremlin is built. It assumes you've read
`SPEC.md`, which defines *what* and *why*. Every choice here serves the
constraints set there:

- PWA, single codebase across phone / tablet / desktop.
- Local-first, full offline on every device.
- Open-source codebase, portable export anytime.
- Solo build, no deadline, household scale (2 users to start).
- Search & rediscovery is the north star; semantic search is the killer feature.

## 1. The stack at a glance

| Layer | Choice |
|---|---|
| Runtime (everywhere) | **Bun** |
| Frontend framework | **SvelteKit** |
| Styling | **Svelte scoped `<style>` + Open Props + Melt UI** |
| Local source-of-truth | **Yjs** (CRDT) |
| Local query store | **SQLite (sqlite-wasm + OPFS)** with **FTS5** |
| Hosted relay | **Bun process on Fly.io** (`Bun.serve`, WebSocket) |
| Object storage (photos) | **Cloudflare R2** |
| Embeddings | **Voyage AI** (`voyage-3` / `voyage-3-lite`) |
| LLM | **Anthropic Claude** (Haiku for cheap, Sonnet/Opus for hard) |
| Auth | **Passkeys (WebAuthn) + device pairing** |
| Repo shape | **Monorepo, Bun workspaces** |
| CI/CD | **GitHub Actions → Fly.io**, preview deploys per PR |
| Quality bar | **TS strict, Vitest, Playwright, Histoire, ESLint** |

## 2. Frontend: SvelteKit on Bun

- **SvelteKit** for the entire UI surface, served as a PWA.
- Run dev, build, and tooling under **Bun** (`bun run dev`, `bun run build`).
- The app is **client-rendered** for the offline-first reality. SvelteKit's
  static adapter (`@sveltejs/adapter-static`) ships a SPA bundle; the relay
  is a separate Bun process. No SSR for app routes — they need IndexedDB,
  OPFS, and a sync session that doesn't exist on the server.
- Server-side functionality (relay endpoints, R2 uploads, Claude proxy,
  Voyage proxy) lives in the **relay** (§4), not in SvelteKit `+server.ts`
  endpoints. This keeps the app deployable as a static asset bundle.

### Why not Next/Remix?
SSR-first frameworks fight a local-first app at every turn. SvelteKit's
client-side router + small bundle + scoped styles are the right shape.

## 3. Styling: Svelte scoped + Open Props + Melt UI

- **Open Props** provides design tokens as CSS custom properties: spacing,
  type scale, colours, easings, shadows, radii. No magic numbers, no naming
  decisions.
- **Component-scoped `<style>` blocks** in every `.svelte` file. No global
  CSS leakage, no BEM, no class-soup.
- **Melt UI** for accessible interactive primitives: dialogs, menus, popovers,
  combobox, toggle group, tabs. Headless — we own the styling.
- **No Tailwind, no UnoCSS, no CSS-in-TS.** Explicit decision: editorial /
  photo-led / playful design wants real CSS control, and the user dislikes
  long utility class lists.
- **Theming** uses CSS custom properties layered per-`:root` and per-user.
  Per-user views (§4.1 of `SPEC.md`) toggle theme variables, not whole CSS
  files.

## 4. Sync & local data: Yjs + SQLite/WASM

Two cooperating systems:

### 4.1 Yjs as source of truth
- One **Yjs document per household.**
- Substructure inside the doc:
  - `recipes: Y.Map<recipeId, Y.Map<...>>` — recipe data is a `Y.Map` per
    recipe so edits don't conflict across recipes.
  - `plan: Y.Map<dateKey, Y.Array<plannedSlot>>`
  - `shoppingList: Y.Array<shoppingItem>`
  - `pantry: Y.Map<itemId, pantryEntry>`
  - `users: Y.Map<userId, userProfile>` (per-user view prefs live here)
- Persisted locally with **`y-indexeddb`**.
- Synced to the relay via **`y-websocket`** (or **partykit-style** in the relay).

### 4.2 SQLite/WASM as query store
- `sqlite-wasm` running in a worker, persisted in **OPFS**.
- A single **observer subscribes to Yjs mutations** and materialises them
  into SQLite tables. SQLite is a derived index, never the source of truth.
- Tables roughly mirror the Yjs structure but are normalised for query:
  - `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_tags`,
    `recipe_embeddings` (BLOB), plus an FTS5 virtual table.
- All app reads go through SQLite. No component reads Yjs directly except
  for the rare case of editing.

### 4.3 Why this split?
- Yjs gives offline-first conflict-free sync that "just works" between
  devices. CRDTs are not great at search, range queries, or joins.
- SQLite + FTS5 + cosine similarity over BLOB embeddings is the *right* tool
  for the search north star, but is not a sync substrate.
- Two systems doing the thing each is best at, with a clean boundary.

### 4.4 Why not Automerge / Loro / ElectricSQL?
- **Automerge** — cleaner doc semantics but slower at scale and a smaller
  Svelte ecosystem.
- **Loro** — fastest in benchmarks but too new; we'd be debugging the CRDT
  itself.
- **ElectricSQL / PowerSync** — designed for "sync a subset of Postgres";
  always-on Postgres is over-engineered for a household and weakens true
  offline writes.

## 5. Backend: Bun on Fly.io

A **single Bun process** running:
- A **Yjs WebSocket relay** (a thin server that broadcasts updates between
  household members and persists the doc).
- An **R2 photo upload proxy** (signed URL minting; image resizing on
  upload).
- A **Claude proxy** for AI features (so client-side code never sees an API
  key) with per-household monthly spend tracking and a hard cap (§7).
- A **Voyage proxy** for embedding generation, batched and cached (§7).
- A **passkey/auth endpoint** (§6).

Hosted on **Fly.io**, single region to start (likely `lhr`). Vertical scale
covers 2 users with room to spare; horizontal scale unlocked when actually
needed.

The relay uses **`bun:sqlite`** for its own state (auth, household
membership, audit log of doc updates for snapshot recovery). It does **not**
mirror the Yjs doc into SQL; the doc is the doc.

### Self-host story
The same Bun process ships as a Docker image. Anyone can `docker run` it on
their own infra. No code path is Fly-specific.

### Why not Cloudflare Workers?
Workers can't run Bun runtime APIs (`bun:sqlite`, `Bun.serve` semantics, FFI).
A "Web Standards" relay that runs on both Workers and Bun is doable but means
two runtimes to debug. One runtime is cleaner for a solo dev. The cost is
~£5–10/mo always-on, which is fine.

## 6. Auth: Passkeys + device pairing

- **WebAuthn passkeys** as the only credential. No passwords.
- **First device** in a household creates the household and registers the
  primary passkey.
- **Adding a second device** uses a one-time pairing code (6–12 chars,
  short-lived) shown on the existing device, entered on the new one. New
  device registers its own passkey on success.
- Server-side: **`@simplewebauthn/server`** running in the relay.
- No email required; no SMS; no third-party auth provider.

Magic links and outsourced auth (Clerk, etc.) were considered and rejected:
overkill for a household app and pulls in a vendor for something a small
amount of code does cleanly.

## 7. AI: Claude + Voyage

**Budget:** target ceiling **~£5/month for the whole household**. Every
choice in this section serves that ceiling.

- **Claude** is the LLM for: web-import parsing (URL + paste-text), recipe
  formatting transforms (per-user views), autoplan reasoning, semantic-query
  rewriting.
  - **Haiku** is the default. Used for: import parsing (URL + paste-text),
    per-user view rewrites, synonym/query expansion, lightweight re-ranking.
  - **Sonnet** only where Haiku visibly fails. The single guaranteed Sonnet
    job is the weekly autoplan reasoning step (one call/week, small context).
  - **Opus is not used.**
- **Voyage AI** (`voyage-3-lite`) for embeddings. Generated server-side (relay
  calls Voyage), stored client-side in SQLite as BLOBs, similarity computed
  locally. Embeddings are computed once per recipe and cached forever; only
  re-run on substantive recipe edits.
- **Every AI output is cached.** Per-user view rewrites, import-parser output,
  and query expansions are persisted (Yjs doc or derived table) so the same
  prompt is never paid for twice.
- **Embeddings are batched.** A Paprika import embeds the whole library in
  one batched call, not one per recipe.
- **Soft cap, hard cap.** The relay tracks per-month spend per provider
  (Anthropic, Voyage). The soft cap warns the household; the hard cap
  disables AI features (the non-AI fallback takes over) until the next
  billing period or a manual override.
- Every AI feature has a **non-AI fallback** so the app stays useful when
  offline, when keys are misconfigured, or when the budget cap is hit.

## 8. Photo storage: Cloudflare R2

- **R2** for originals + generated thumbnails. S3-compatible.
- Free for a household indefinitely (10 GB + millions of ops/month free tier).
- Zero egress fees — important for tablet+phone+desktop fetching the same
  photo across devices.
- **Image resizing** done in the relay on upload (Bun's `sharp`-equivalent
  or a wasm image lib): one original + responsive thumbnails.
- Self-host parity: the relay can be configured to use any S3-compatible
  store (B2, MinIO, Hetzner) via env vars.

## 9. Search infrastructure

- **Full-text search:** SQLite **FTS5** virtual table over title, ingredients,
  steps, notes, tags. Synonym expansion via a curated ingredient ontology
  (§10) plus query rewriting.
- **Semantic search:** Voyage embeddings stored as BLOBs in SQLite; cosine
  similarity computed in JS over the candidate set returned by FTS5.
- **Faceted filters:** plain SQL queries over normalised fields (cuisine,
  time, equipment, season, last cooked, rating).
- **All offline-capable.** Embedding *generation* requires network; *search*
  does not.

## 10. Repo shape: monorepo, Bun workspaces

```
kitchen-gremlin/
├─ apps/
│  ├─ web/          # SvelteKit PWA
│  └─ relay/        # Bun WebSocket relay + proxies
├─ packages/
│  ├─ schema/       # Shared TS types, Zod schemas, Yjs shapes
│  ├─ sync/         # Yjs <-> SQLite materialiser
│  ├─ importers/    # Paprika, web URL, paste-text
│  └─ ai/           # Claude / Voyage client wrappers
├─ docs/             # Specs (this file lives in the repo root for now)
└─ .github/workflows/
```

- **Bun workspaces** (`bun install` resolves `workspace:*` deps).
- No Turborepo or Nx; Bun's task running is enough at this size.
- Shared types in `packages/schema` are the contract between web and relay.

## 11. Quality bar (set up day one)

- **TypeScript strict mode**, no `any`, exhaustiveness on discriminated
  unions. `tsconfig`'s `strict: true` plus `noUncheckedIndexedAccess`.
- **Vitest** for unit tests (importers, materialiser, search ranking).
- **Playwright** for end-to-end browser tests across the kitchen-tablet form
  factor and a phone form factor.
- **Histoire** as the component workshop (Svelte's Storybook equivalent),
  with Chromatic-style visual regression deferred until v1.0.
- **ESLint + Prettier** — minimal config, zero-debate formatting.
- **GitHub Actions** from the first commit:
  - Typecheck, lint, test on every push.
  - Build the SvelteKit app and the relay.
  - Deploy preview on PRs (Fly preview apps).
  - Deploy production on merge to `main`.

## 12. Decisions deferred

These are still legitimate open questions that the spec doesn't lock down:

- **Image processing library** in the relay (Bun-native? `sharp` via Node
  compat? a WASM lib?). Decide when first photo is uploaded.
- **Yjs document partitioning.** One doc per household is the default.
  Splitting recipes into "shards" of \~500 recipes each may be necessary
  if libraries grow large; defer until measurable.
- **Claude streaming** for autoplan and per-user view rewrites — worth doing
  for UX, but not on day one.
- **Migration strategy** for breaking changes to the Yjs schema. Need a
  versioning convention (`schemaVersion` field, lazy migrations) before the
  first user-facing release.
- **Telemetry / analytics.** Spec is silent. Default position: none unless
  explicitly added; if added, self-hosted (Plausible-style) only.
