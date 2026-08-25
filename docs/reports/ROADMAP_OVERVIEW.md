# Kitchen Gremlin Beyond MVP: Roadmap Overview

**18 tasks across 6 milestones.** Files: `.claude/roadmaps.json`
(machine-readable), `docs/roadmaps/BEYOND_MVP.md` (full task list with
Mermaid dependency diagram).

---

## What we're building

The MVP is local-only: one device, one library, no accounts. It already
does Paprika import, full-text search with synonyms, a meal planner,
shopping list consolidation, cooking mode, per-device reading prefs, and a
portable JSON export. This phase is everything SPEC.md called out as open
or deferred, plus finishing the import story and confirming the MVP holds
up under real use before anything new gets built on top of it.

The structure leans on three research spikes (sync, graph layer, embeddings)
rather than committing straight to the documented defaults. Sync in
particular was reconsidered mid-planning: Yjs was the original plan, but for
a two-person household a simpler last-write-wins relay might be enough, and
neither approach is worth locking in without a prototype. The same applies
to Voyage embeddings for semantic search and to whether relationship-rich
queries (ingredient substitutions, pantry-match, "recipes using most of what
I have") need a graph database (Neo4j, the documented preferred stack) or
can live in SQLite with recursive CTEs.

## Milestone sequence and the reasoning behind it

**M1 — MVP Hardening.** One audit task per shipped feature (import, search,
planner, shopping list, cooking mode, view prefs, export), rather than a
single catch-all task, so gaps surface feature-by-feature. Runs entirely in
parallel with everything else in this phase; nothing here blocks or is
blocked by new architecture work.

**M2 — Imports.** Paste-text import ships first; web import extends the
same Claude-extraction pipeline with scraping and a schema.org/Recipe
parse layered on top, so it's sequenced after rather than built as a
parallel, unrelated path.

**M3 — Architecture Spikes.** Three independent research tracks: sync
substrate, graph layer, and embeddings approach. None block each other or
M1/M2 — they're free to run in parallel. Each spike is a prerequisite for
exactly one later milestone, not a gate on the whole phase.

**M4 — Semantic Search.** The north-star feature (SPEC.md §3). Blocked only
on the embeddings spike (3SP.3), not on sync, graph, or hardening — there's
no reason a single-device build has to wait on multi-device work.

**M5 — Sync & Auth.** Blocked only on the sync spike (3SP.1). Auth is
sequenced strictly after sync per SPEC.md's own open question (§9.2: "defer
until sync is decided") — the pairing/passkey model depends on how the sync
substrate identifies devices.

**M6 — Pantry & Aisle Spikes.** Both spikes (pantry data entry UX, aisle
layout learning) are explicitly sequenced after M1 and M2 land, on the
user's instruction — these are open UX problems (SPEC.md itself calls
pantry entry "make-or-break") not worth speculating on before there's real
usage of the hardened, import-complete MVP to learn from.

## Decisions that shaped the structure

- **Sync architecture deferred to a spike**, not committed to Yjs as
  originally documented in TECH_STACK.md §4 — reconsidered because the
  household is small (2 people) and a simpler relay may be sufficient.
- **Graph database question surfaced from a feature need**, not the sync
  discussion: rich relationship queries (substitutions, pantry-match)
  raised whether Neo4j (the user's preferred graph stack) belongs alongside
  SQLite. Deferred to its own spike rather than assumed.
- **Auth stays unresolved on purpose** (SPEC.md §9.2 already flagged this):
  passkeys + pairing is the documented default, but it's tracked as a
  decide-and-build task gated on the sync spike, not pre-committed.
- **Autoplan, per-user recipe layout editing, and photo storage strategy
  were explicitly held back** from this phase — noted as later-phase work,
  not tracked as tasks, so the roadmap doesn't carry speculative scope.

## External blockers (flag early)

None currently. All open questions in this phase (sync, graph layer,
embeddings, auth, photo storage, pantry entry, aisle learning) are internal
decisions gated on spikes, not external dependencies.
