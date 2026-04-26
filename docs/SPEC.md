# Kitchen Gremlin — Spec v0.1

## 1. Why this exists

> "I hate Paprika Recipe Manager but there isn't anything better, and I have a
> huge amount saved in it."

Paprika is the household's recipe system of record because nothing else has
beaten it. The cost of switching has trapped users inside an app whose
planning, importing, search, and UI have all aged badly. Kitchen Gremlin is the
escape route: keep what Paprika got right, fix what it got wrong, make the
existing library come with you.

### Concrete Paprika gripes driving this
- Weak meal planning.
- Unreliable web import.
- Clunky, dated UI.
- Limited filtering; brittle ingredient matching (`"onion" != "onions"`).

## 2. Who it's for

A **household** (initially: me + Harriet). Fully shared library, shared planner,
shared list — but with **per-user views** of the same source recipe (see §4.1).
Not a public/social product. No accounts-as-a-business.

## 3. North star & killer feature

- **North star:** *Search & rediscovery* — surface the right recipe from a huge
  saved library at the right moment.
- **Killer feature (v1 launch brag):** **Memory-style semantic search.**
  > *"Show me the lamb tagine I made in February that we both loved."*
  Search by memory, vibes, and context — not just keywords.

Everything else is judged by whether it serves the goal of *"the right recipe,
cooked well, with the right shopping done"*.

## 4. Product pillars

### 4.1 Per-user views over a single shared recipe
The library is one source of truth, but rendering is per-user. v1 scope:
**formatting & readability only.**
- Bullet-point steps vs. prose (ADHD-friendly mode).
- Font size, line height, contrast.
- Step-checklist mode (one action per line, tickable).

Out of scope for v1 (don't build, but don't architecturally preclude): unit
conversions, dietary substitutions, skill-level rewrites.

### 4.2 Search & rediscovery
All three layers, working together:
- **Smart full-text + synonyms.** `onion` matches `onions`, `spring onion`,
  `shallot` (configurable). Typo-tolerant. Searches title, ingredients, steps,
  notes, tags, source.
- **Rich faceted filters.** Time, cuisine, ingredient include/exclude,
  equipment, season, last-cooked-before, rating, who-loved-it.
- **Semantic / AI similar-to.** "Like this but quicker." "Comfort food we
  haven't had in months." "That thing with miso and aubergine."

### 4.3 Meal planner
**Paprika feature parity first**, plus *optional* constraint-driven autoplan:
> *"3 quick weeknights, one veg night, one fancy Saturday, use the leeks."*

Autoplan inputs in v1: empty slots and user-locked entries; the recent cook
log (avoid repeats); ratings (bias toward favourites); attendee dietary and
allergen filters. Date-aware seasonality hints are **not** in v1.

Autoplan proposes; user always edits. Never silently changes a planned week.

### 4.4 Shopping list (the kitchen sink)
- **Smart consolidation:** `1 onion` + `½ onion` + `200g onions` → one line
  with sane units.
- **Aisle-aware ordering:** learns your usual store's layout.
- **Multi-store split:** Lidl staples, butcher, greengrocer as separate views
  of the same plan.
- **Pantry-aware:** subtract what's in the pantry; flag "usually have" items
  for confirmation rather than auto-adding.

### 4.5 Cooking mode (kitchen tablet)
- Hands-friendly step view: big text, screen-stays-on, tap to advance.
- Inline multi-timers: tap a step or ingredient to start a timer; multiple
  visible at once.
- Mise en place checklist: tick ingredients as you prep.
- Voice control is **not** in v1.

### 4.6 Imports (day one)
v1 ships three import paths and nothing else:
- **Paprika export** — `.paprikarecipes` archive parser. This is the
  household's migration path and the first thing v1 must do well. Lossless
  within the scope of §4.7. Tested against a real export from week one. See
  [PAPRIKA.md](./PAPRIKA.md) for the format reference and field mapping.
- **Web URL** — robust scraping: schema.org/Recipe first, Claude (Haiku)
  fallback for messy blogs.
- **Paste-text** — paste from anywhere (blog body, email, notes app, message
  thread); Claude extracts a structured recipe. Catches everything that's
  text-shaped without needing a URL.

Deferred to v2:
- **Photo / OCR** for cookbook pages and handwritten cards.
- **Share-sheet imports** from iOS/Android.
- **Other apps' exports** (Mealie, Tandoor, NYT Cooking).

### 4.7 Migration from Paprika
**Recipes + metadata, lossless within that scope.** Must bring across:
- Title, ingredients, steps, source URL, prep/cook times, servings.
- Photos.
- Tags / categories.
- Personal notes.
- Ratings.

Not required v1: planner history, shopping-list state.

**Day-one flow.** The app ships with no seed library. The first action a new
household takes after install is "Import Paprika archive." Until that import
runs cleanly against the household's real `.paprikarecipes` export, v1 is
not done.

## 5. Non-goals (explicit)

These are **out of scope** and stay out of scope for v1:
- Nutrition tracking (calories, macros, micros).
- Cost / budget tracking.
- Grocery-delivery integrations (Tesco, Ocado, Instacart).
- Social / public sharing, followers, comments.

If a feature smells like it serves one of these, push back.

## 6. Architecture & build shape

- **PWA, single codebase.** Web-first, responsive across phone (iOS + Android),
  kitchen tablet, and desktop browser.
- **Local-first, full offline.** Every device has a complete local copy;
  reads and writes work offline; sync resolves conflicts when reconnected.
  Implies CRDT or equivalent sync layer.
- **Open-source codebase.** Public repo. Anyone (incl. us) can fork and run it.
- **Portable export, anytime.** One-click dump of everything as portable JSON
  + Markdown + photos. No data hostage.
- **AI features powered by Claude (cloud), on a frugal budget.** Target
  ceiling **~£5/month for the whole household**. Haiku is the default model;
  Sonnet only where Haiku visibly fails (the weekly autoplan reasoning step,
  hardest imports); Opus is not used. Embeddings, import parses, and
  per-user view rewrites are computed once and cached. Every AI feature has
  a "no-AI" fallback so the app stays useful when offline, when keys are
  misconfigured, or when the budget cap is hit.

## 7. Design direction

- **Editorial / minimal** baseline: typographic, generous whitespace, calm.
- **Photo-led** when a recipe has a hero image — let it breathe.
- **Playful / characterful** at the edges — there is, after all, a gremlin in
  the kitchen. Mascot, illustration, voice. Never at the cost of legibility.

## 8. Resourcing

- Solo build, no deadline. Ship when it's good.
- No team, no commercial pressure, no external stakeholders.
- Bias toward small, releasable increments the household can use immediately
  (the goal is to switch off Paprika, not to build forever).

## 9. Open questions / decisions deferred

These are known unknowns to resolve before, or during, the relevant slice:

1. **Sync substrate.** CRDT library choice (Yjs / Automerge / loro / custom?)
   and the server topology (peer-to-peer? thin relay? hosted?).
2. **Auth model for a household app.** Magic link? Passkeys? Single shared
   login? Defer until sync is decided.
3. **Search index.** Local SQLite FTS5 + a remote vector index for semantic?
   Or fully local embeddings (small model) for offline semantic search?
4. **Photo storage.** Local-first implies on-device; but recipe photos can be
   large. Lazy-sync? Thumbnails always, originals on demand?
5. **Pantry data entry.** How does the pantry get and stay accurate without
   becoming a chore? (This is the make-or-break for "pantry-aware" features.)
6. **Aisle layout learning.** Manual ordering, learned-from-taps, or
   crowdsourced per store?
7. **Paprika importer fidelity.** Working reference in
   [PAPRIKA.md](./PAPRIKA.md), but Paprika has no published schema — the
   real export is the spec, and surprises will be found. Validation plan in
   PAPRIKA.md §7.
