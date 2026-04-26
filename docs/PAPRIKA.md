# Paprika Export Format — Reference

This doc captures what we know about the Paprika Recipe Manager export format
so the v1 importer (see [SPEC.md §4.6, §4.7](./SPEC.md)) can be built and
tested. Everything here is compiled from public third-party sources (open
importers, support articles, blog posts) — Paprika has no published schema.
**Treat this as a working reference; verify every detail against a real
`.paprikarecipes` export from the household before relying on it.**

## 1. Upstream references

- Paprika support — export formats:
  https://paprikaapp.zendesk.com/hc/en-us/articles/360051324613-What-export-formats-do-you-support
- Paprika support — importing other-app exports:
  https://paprikaapp.zendesk.com/hc/en-us/articles/114094152754
- Paprika Mac help:
  https://www.paprikaapp.com/help/mac/
- Paprika cloud-sync API (community-reverse-engineered):
  https://gist.github.com/mattdsteele/7386ec363badfdeaad05a418b9a1f30a
- Reference open-source importers/exporters worth reading:
  - https://github.com/bojanrajkovic/paprika-exporter
  - https://github.com/ebridges/cookbook-importer
  - https://github.com/sdjmchattie/recipe-converter

## 2. The export formats Paprika offers

Two export formats from the desktop apps:
- **HTML** — human-readable; not a migration source.
- **Paprika Recipe Format** — `.paprikarecipes`, the format we target.

We import **only** Paprika Recipe Format. HTML is ignored.

## 3. Archive layout

```
my-library.paprikarecipes        ← outer container = zip archive
├─ <recipe-1>.paprikarecipe      ← gzipped JSON, one file per recipe
├─ <recipe-2>.paprikarecipe
└─ …
```

- Outer file: standard zip archive.
- Inner files: each is **gzipped JSON** with a `.paprikarecipe` extension.
- Decompressed payload is a single JSON object on one line (no whitespace).

So the importer pipeline is: `unzip → gunzip each entry → JSON.parse`.

## 4. Recipe JSON fields

Field list compiled from open importers. **Every field except `name` should
be treated as optional** until proven otherwise against a real export.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Stable Paprika identifier; preserve as `paprika_uid`. |
| `hash` | string | Content hash; useful for de-dup but not authoritative. |
| `name` | string | Recipe title. **Required.** |
| `description` | string | Short blurb. |
| `ingredients` | string | Newline-separated list, **not an array**. May contain inline formatting and image refs. Parser must split + normalise. |
| `directions` | string | Newline-separated steps, **not an array**. May contain inline formatting and image refs. |
| `notes` | string | Free-text user notes. May contain inline formatting and image refs. |
| `nutritional_info` | string | Free-text, not structured. |
| `prep_time` | string | Human-readable ("15 mins"). Not a duration. |
| `cook_time` | string | Human-readable. |
| `total_time` | string | Human-readable. May or may not equal `prep + cook`. |
| `servings` | string | Free-text ("4", "4-6", "makes 12"). |
| `difficulty` | string | Free-text. |
| `rating` | number | 0–5. |
| `source` | string | Source name (e.g. "BBC Good Food"). |
| `source_url` | string | URL the recipe came from. |
| `image_url` | string | Original online photo URL, if imported from web. |
| `photo` | string | Filename of the primary photo (within the export). |
| `photo_hash` | string | Hash of the primary photo. |
| `photo_data` | string | **Base64-encoded** primary photo bytes, inlined in the JSON. |
| `photo_large` | string | Base64-encoded larger variant (if present). |
| `photos` | array | Additional photos; structure to verify against export. |
| `categories` | array | **Category names** in the export (the cloud-sync API uses UUIDs; the file export inlines names). Map to our tags. |
| `created` | string | ISO timestamp. |

### Things that bite

- **`ingredients` and `directions` are blobs, not arrays.** Splitting on `\n`
  is the right starting point; expect blank lines, sub-headers ("For the
  sauce:"), and the occasional inline image reference.
- **Inline formatting and inline images** can appear in `ingredients`,
  `directions`, `notes`, and `nutritional_info`. Strip or preserve
  deliberately — don't pass through unsanitised.
- **Times are human strings, not durations.** Parse them best-effort; if
  parsing fails, keep the original string and surface it raw.
- **Categories ≠ tags 1:1.** The household uses categories as folders in
  Paprika; we model tags. Default mapping: every category becomes a tag,
  preserving names verbatim.
- **Photos live inside the JSON as base64.** A library of 1000 recipes with
  inlined photos can be hundreds of MB. The importer must stream/decode
  per-recipe and offload bytes to R2 (see [TECH_STACK.md §8](./TECH_STACK.md))
  rather than holding them all in memory.

## 5. Field mapping into Kitchen Gremlin

| Paprika | Kitchen Gremlin | Strategy |
|---|---|---|
| `uid` | `recipe.import.paprikaUid` | Preserve for re-import idempotency. |
| `name` | `recipe.title` | Required. |
| `description` | `recipe.description` | Pass through. |
| `ingredients` | `recipe.ingredients[]` | Split on `\n`; trim; drop blanks; preserve sub-headers as group labels. |
| `directions` | `recipe.steps[]` | Split on `\n`; trim; drop blanks. |
| `notes` | `recipe.notes` | Pass through. |
| `prep_time` / `cook_time` / `total_time` | `recipe.times.*` | Best-effort parse to minutes; keep raw string as fallback. |
| `servings` | `recipe.servings` | Best-effort parse to integer; keep raw string. |
| `rating` | `recipe.rating` | Direct. |
| `source`, `source_url` | `recipe.source.*` | Direct. |
| `image_url`, `photo`, `photos`, `photo_data`, `photo_large` | `recipe.photos[]` (R2) | Decode base64 → upload to R2 → store URL. Drop `photo_hash` after upload. |
| `categories` | `recipe.tags[]` | Map names verbatim. |
| `created` | `recipe.importedAt` | Preserved separately from "added to Kitchen Gremlin at". |
| `nutritional_info` | `recipe.nutritionRaw` | Stored as opaque string; not parsed (out of scope per SPEC §5). |
| `difficulty` | `recipe.difficulty` | Pass-through string. |
| `hash` | — | Dropped; we hash content ourselves. |

## 6. Out of scope for the v1 importer

- Paprika **planner / meal-plan** export (deferred per SPEC §4.7).
- Paprika **shopping list** export (deferred per SPEC §4.7).
- Paprika **bookmarks** / **pantry** if those appear in the archive.

## 7. Validation plan

Before declaring v1 done (per SPEC §4.7):

1. Run the importer against the household's real `.paprikarecipes` export.
2. Confirm 100% of recipes import without crash.
3. Spot-check a stratified sample (top-rated, recently-added, web-imported,
   manually-entered, photo-heavy) for fidelity.
4. Re-run the importer on the same archive — verify idempotency via
   `paprika_uid`.
5. Round-trip a recipe through edit → re-import and confirm no data loss in
   user-meaningful fields.

Anything discovered during validation that contradicts §4 above should be
fixed in this doc first, then in the importer.
