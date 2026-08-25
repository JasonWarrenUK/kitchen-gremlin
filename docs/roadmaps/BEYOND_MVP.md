# Kitchen Gremlin Beyond MVP Roadmap

The local-only MVP (Paprika import, search, meal planner, shopping list,
cooking mode, per-user view prefs, portable export) is built. This phase
hardens it, completes the remaining v1 import paths, resolves open
architecture questions with spikes, and builds semantic search and
multi-device sync on top of those spikes.

**Critical path:** `3SP.3 → 4SR.1 → 4SR.2` and `3SP.1 → 5SY.1 → 5SY.2`; the
embeddings spike gates semantic search, the sync spike gates multi-device
sync and auth. `M1`/`M2` gate the pantry/aisle spikes (M6), sequenced after
existing systems ship.

---

## Milestone 1: MVP Hardening

**Goal:** Confirm what's built actually works before layering new architecture on top.

- [ ] **1HD.1**: Audit Paprika import against real household export
- [ ] **1HD.2**: Audit search & filters (FTS5, synonym expansion, facets)
- [ ] **1HD.3**: Audit meal planner (week view, plan-to-shopping-list)
- [ ] **1HD.4**: Audit shopping list (consolidation, tick-off, manual items)
- [ ] **1HD.5**: Audit cooking mode (mise en place, timers, wake lock, cook log)
- [ ] **1HD.6**: Audit per-user view prefs (text size, line spacing, checklist steps)
- [ ] **1HD.7**: Audit portable export (JSON dump completeness)

---

## Milestone 2: Imports

**Goal:** Complete the three documented v1 import paths (only Paprika exists today).

- [ ] **2IM.1**: Paste-text import (Claude extracts structured recipe from pasted text)
- [ ] **2IM.2**: Web URL import (schema.org/Recipe parse, Claude fallback for messy blogs) _(blocked: depends on 2IM.1)_

---

## Milestone 3: Architecture Spikes

**Goal:** Resolve open architecture questions before committing to a build.

- [ ] **3SP.1**: Spike: sync substrate (Yjs vs simple last-write-wins relay)
- [ ] **3SP.2**: Spike: graph layer for relationship queries (substitutions, pantry-match, ingredient graphs — Neo4j vs SQLite recursive CTEs vs defer)
- [ ] **3SP.3**: Spike: embeddings approach (model choice, generation process, Voyage vs alternatives)

---

## Milestone 4: Semantic Search

**Goal:** Ship the killer feature (SPEC.md §3).

- [ ] **4SR.1**: Build embeddings pipeline (per chosen approach from 3SP.3) _(blocked: depends on 3SP.3)_
- [ ] **4SR.2**: Semantic/similar-to search UI ("like this but quicker") _(blocked: depends on 4SR.1)_

---

## Milestone 5: Sync & Auth

**Goal:** Multi-device household sync.

- [ ] **5SY.1**: Build sync substrate (per chosen approach from 3SP.1) _(blocked: depends on 3SP.1)_
- [ ] **5SY.2**: Decide + build auth (passkeys + pairing, per SPEC.md §6, or reconsider) _(blocked: depends on 5SY.1)_

---

## Milestone 6: Pantry & Aisle Spikes

**Goal:** Explore pantry-aware and aisle-learning UX, sequenced after existing systems ship.

- [ ] **6PA.1**: Spike: pantry data entry UX (the "make-or-break" problem — SPEC.md §9.5) _(blocked: depends on M1, M2)_
- [ ] **6PA.2**: Spike: aisle-layout learning approach (manual/learned/crowdsourced — SPEC.md §9.6) _(blocked: depends on M1, M2)_

---

## Dependency Diagram

```mermaid
graph LR
	classDef todo fill:#f6f6f6,stroke:#6f6f6f,color:#6f6f6f
	classDef blocked fill:#fff8f6,stroke:#e0002b,color:#e0002b,stroke-width:2px
	classDef paused fill:#fdf4ff,stroke:#b01fe3,color:#b01fe3,stroke-dasharray:4 3
	classDef deferred fill:#fff8f3,stroke:#ac5c00,color:#ac5c00,stroke-dasharray:2 4,font-style:italic
	classDef done fill:#e0ffd9,stroke:#008217,color:#008217
	classDef outOfScope fill:#f6f6f6,stroke:#e2e2e2,color:#e2e2e2,stroke-dasharray:2 2
	classDef mile fill:#e3f7ff,stroke:#007590,color:#007590,font-weight:bold
	classDef external fill:#fff9e5,stroke:#7d6f00,color:#7d6f00,stroke-dasharray:4 3,font-style:italic
	1HD.1["1HD.1: Audit Paprika import against real househ…"]
	1HD.2["1HD.2: Audit search & filters (FTS5, synonym ex…"]
	1HD.3["1HD.3: Audit meal planner (week view, plan-to-s…"]
	1HD.4["1HD.4: Audit shopping list (consolidation, tick…"]
	1HD.5["1HD.5: Audit cooking mode (mise en place, timer…"]
	1HD.6["1HD.6: Audit per-user view prefs (text size, li…"]
	1HD.7["1HD.7: Audit portable export (JSON dump complet…"]
	M1["M1: MVP Hardening"]:::mile
	2IM.1["2IM.1: Paste-text import (Claude extracts struc…"]
	2IM.2["2IM.2: Web URL import (schema.org/Recipe parse,…"]
	M2["M2: Imports"]:::mile
	3SP.1["3SP.1: Spike: sync substrate (Yjs vs simple las…"]
	3SP.2["3SP.2: Spike: graph layer for relationship quer…"]
	3SP.3["3SP.3: Spike: embeddings approach (model choice…"]
	M3["M3: Architecture Spikes"]:::mile
	4SR.1["4SR.1: Build embeddings pipeline (per chosen ap…"]
	4SR.2["4SR.2: Semantic/similar-to search UI (#quot;like thi…"]
	M4["M4: Semantic Search"]:::mile
	5SY.1["5SY.1: Build sync substrate (per chosen approac…"]
	5SY.2["5SY.2: Decide + build auth (passkeys + pairing,…"]
	M5["M5: Sync & Auth"]:::mile
	6PA.1["6PA.1: Spike: pantry data entry UX (the #quot;make-o…"]
	6PA.2["6PA.2: Spike: aisle-layout learning approach (m…"]
	M6["M6: Pantry & Aisle Spikes"]:::mile
	1HD.1 --> M1
	1HD.2 --> M1
	1HD.3 --> M1
	1HD.4 --> M1
	1HD.5 --> M1
	1HD.6 --> M1
	1HD.7 --> M1
	M1 --> 6PA.1
	M1 --> 6PA.2
	2IM.1 --> 2IM.2
	2IM.2 --> M2
	M2 --> 6PA.1
	M2 --> 6PA.2
	3SP.1 --> M3
	3SP.1 --> 5SY.1
	3SP.2 --> M3
	3SP.3 --> M3
	3SP.3 --> 4SR.1
	4SR.1 --> 4SR.2
	4SR.2 --> M4
	5SY.1 --> 5SY.2
	5SY.2 --> M5
	6PA.1 --> M6
	6PA.2 --> M6
	class 1HD.1,1HD.2,1HD.3,1HD.4,1HD.5,1HD.6,1HD.7,2IM.1,3SP.1,3SP.2,3SP.3 todo
	class 2IM.2,4SR.1,4SR.2,5SY.1,5SY.2,6PA.1,6PA.2 blocked
```
