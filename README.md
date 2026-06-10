# Kitchen Gremlin

A household recipe manager built to escape Paprika: keep what it got right,
fix what it got wrong, bring the existing library with you. See
[docs/SPEC.md](./docs/SPEC.md) for the why and
[docs/TECH_STACK.md](./docs/TECH_STACK.md) for the how.

## What works today

- **Paprika import** — drop a `.paprikarecipes` archive in, get your library
  out: recipes, photos, tags, notes, ratings ([docs/PAPRIKA.md](./docs/PAPRIKA.md)).
- **Search & filters** — full-text search with synonym expansion
  (`onion` matches `shallot`), plus faceted filters: tags, rating,
  total time, must-use / without ingredients.
- **Meal planner** — week view with breakfast/lunch/dinner slots; plan
  recipes or free-text notes ("leftovers"); send the whole week to the
  shopping list.
- **Shopping list** — smart consolidation (`1 onion` + `½ onion` +
  `200g onions` → one line with sane units), tick-off, manual items.
- **Cooking mode** — mise en place checklist, one big-text step at a time,
  screen wake lock, inline multi-timers parsed from step text, cook log.
- **Per-user reading prefs** — text size, line spacing, tickable checklist
  steps; stored per device, never touching the shared library.
- **Portable export** — one-click JSON dump of the whole library.

Everything runs locally in the browser (SQLite WASM + OPFS); no account,
no server required.

## Development

```sh
bun install
bun run dev        # SvelteKit dev server
bun run test       # Vitest (importers, schema, shopping consolidation)
bun run typecheck  # svelte-check + tsc over all packages
bun run lint       # ESLint
```

Repo layout: `apps/web` is the SvelteKit PWA; `packages/` holds the shared
schema, the Paprika importer, and the shopping-list consolidation logic.
