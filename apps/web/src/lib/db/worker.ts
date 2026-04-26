import init, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { Recipe } from '@kitchen-gremlin/schema';
import { runMigrations } from './migrations.js';

let db: Database | null = null;

async function initDb() {
	const sqlite3: Sqlite3Static = await init();
	if ('opfs' in sqlite3) {
		db = new sqlite3.oo1.OpfsDb('/kitchen-gremlin.db');
	} else {
		db = new sqlite3.oo1.DB('/kitchen-gremlin.db', 'ct');
	}
	runMigrations(
		(sql) => db!.exec(sql),
		(sql) => db!.selectObjects(sql) as { version: number }[],
	);
}

export interface RecipeSummary {
	id: string;
	title: string;
	sourceUrl: string | null;
	sourceName: string | null;
	rating: number | null;
	primaryPhotoId: string | null;
}

export interface SearchOptions {
	query?: string;
	limit?: number;
	offset?: number;
}

function getDb(): Database {
	if (!db) throw new Error('DB not initialised');
	return db;
}

function importRecipe(recipe: Recipe): 'inserted' | 'skipped' {
	const database = getDb();

	const existing = database.selectObjects(`SELECT id FROM recipes WHERE paprika_uid = ?`, [
		recipe.paprikaUid,
	]);
	if (existing.length > 0) return 'skipped';

	database.exec('BEGIN');
	try {
		database.exec({
			sql: `INSERT INTO recipes
				(id, paprika_uid, title, description, notes,
				 prep_mins, cook_mins, total_mins,
				 times_raw_prep, times_raw_cook, times_raw_total,
				 servings_count, servings_raw, rating,
				 source_name, source_url, difficulty, nutrition_raw,
				 imported_at, created_at)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			bind: [
				recipe.id,
				recipe.paprikaUid,
				recipe.title,
				recipe.description ?? null,
				recipe.notes ?? null,
				recipe.times.prepMins ?? null,
				recipe.times.cookMins ?? null,
				recipe.times.totalMins ?? null,
				recipe.times.raw.prep ?? null,
				recipe.times.raw.cook ?? null,
				recipe.times.raw.total ?? null,
				recipe.servings.count ?? null,
				recipe.servings.raw,
				recipe.rating ?? null,
				recipe.source.name ?? null,
				recipe.source.url ?? null,
				recipe.difficulty ?? null,
				recipe.nutritionRaw ?? null,
				recipe.importedAt,
				recipe.createdAt,
			],
		});

		for (let i = 0; i < recipe.ingredients.length; i++) {
			const ing = recipe.ingredients[i]!;
			database.exec({
				sql: `INSERT INTO recipe_ingredients (recipe_id, position, text, group_label) VALUES (?,?,?,?)`,
				bind: [recipe.id, i, ing.text, ing.group ?? null],
			});
		}

		for (let i = 0; i < recipe.steps.length; i++) {
			database.exec({
				sql: `INSERT INTO recipe_steps (recipe_id, position, text) VALUES (?,?,?)`,
				bind: [recipe.id, i, recipe.steps[i]!],
			});
		}

		for (const tag of recipe.tags) {
			database.exec({
				sql: `INSERT OR IGNORE INTO recipe_tags (recipe_id, tag) VALUES (?,?)`,
				bind: [recipe.id, tag],
			});
		}

		for (let i = 0; i < recipe.photoIds.length; i++) {
			database.exec({
				sql: `INSERT INTO recipe_photos (recipe_id, position, photo_id) VALUES (?,?,?)`,
				bind: [recipe.id, i, recipe.photoIds[i]!],
			});
		}

		const ingredientsText = recipe.ingredients.map((i) => i.text).join(' ');
		const stepsText = recipe.steps.join(' ');
		database.exec({
			sql: `INSERT INTO recipes_fts (recipe_id, title, ingredients_text, steps_text, notes, tags)
			 VALUES (?,?,?,?,?,?)`,
			bind: [
				recipe.id,
				recipe.title,
				ingredientsText,
				stepsText,
				recipe.notes ?? '',
				recipe.tags.join(' '),
			],
		});

		database.exec('COMMIT');
		return 'inserted';
	} catch (e) {
		database.exec('ROLLBACK');
		throw e;
	}
}

function searchRecipes(opts: SearchOptions): RecipeSummary[] {
	const database = getDb();
	const { query = '', limit = 50, offset = 0 } = opts;

	if (query.trim()) {
		const rows = database.selectObjects(
			`SELECT r.id, r.title, r.source_url, r.source_name, r.rating,
				(SELECT photo_id FROM recipe_photos WHERE recipe_id = r.id ORDER BY position LIMIT 1) as primary_photo_id
			 FROM recipes r
			 JOIN recipes_fts fts ON fts.recipe_id = r.id
			 WHERE recipes_fts MATCH ?
			 ORDER BY rank
			 LIMIT ? OFFSET ?`,
			[query, limit, offset],
		) as {
			id: string;
			title: string;
			source_url: string | null;
			source_name: string | null;
			rating: number | null;
			primary_photo_id: string | null;
		}[];
		return rows.map((r) => ({
			id: r.id,
			title: r.title,
			sourceUrl: r.source_url,
			sourceName: r.source_name,
			rating: r.rating,
			primaryPhotoId: r.primary_photo_id,
		}));
	}

	const rows = database.selectObjects(
		`SELECT r.id, r.title, r.source_url, r.source_name, r.rating,
			(SELECT photo_id FROM recipe_photos WHERE recipe_id = r.id ORDER BY position LIMIT 1) as primary_photo_id
		 FROM recipes r
		 ORDER BY r.title COLLATE NOCASE
		 LIMIT ? OFFSET ?`,
		[limit, offset],
	) as {
		id: string;
		title: string;
		source_url: string | null;
		source_name: string | null;
		rating: number | null;
		primary_photo_id: string | null;
	}[];
	return rows.map((r) => ({
		id: r.id,
		title: r.title,
		sourceUrl: r.source_url,
		sourceName: r.source_name,
		rating: r.rating,
		primaryPhotoId: r.primary_photo_id,
	}));
}

function getRecipe(id: string): Recipe | null {
	const database = getDb();

	const rows = database.selectObjects(`SELECT * FROM recipes WHERE id = ?`, [id]) as {
		id: string;
		paprika_uid: string;
		title: string;
		description: string | null;
		notes: string | null;
		prep_mins: number | null;
		cook_mins: number | null;
		total_mins: number | null;
		times_raw_prep: string | null;
		times_raw_cook: string | null;
		times_raw_total: string | null;
		servings_count: number | null;
		servings_raw: string;
		rating: number | null;
		source_name: string | null;
		source_url: string | null;
		difficulty: string | null;
		nutrition_raw: string | null;
		imported_at: string;
		created_at: string;
	}[];

	const row = rows[0];
	if (!row) return null;

	const ingredients = database.selectObjects(
		`SELECT text, group_label FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position`,
		[id],
	) as { text: string; group_label: string | null }[];

	const steps = database.selectObjects(
		`SELECT text FROM recipe_steps WHERE recipe_id = ? ORDER BY position`,
		[id],
	) as { text: string }[];

	const tags = database.selectObjects(
		`SELECT tag FROM recipe_tags WHERE recipe_id = ?`,
		[id],
	) as { tag: string }[];

	const photos = database.selectObjects(
		`SELECT photo_id FROM recipe_photos WHERE recipe_id = ? ORDER BY position`,
		[id],
	) as { photo_id: string }[];

	return {
		id: row.id,
		paprikaUid: row.paprika_uid,
		title: row.title,
		description: row.description ?? undefined,
		notes: row.notes ?? undefined,
		times: {
			prepMins: row.prep_mins ?? undefined,
			cookMins: row.cook_mins ?? undefined,
			totalMins: row.total_mins ?? undefined,
			raw: {
				prep: row.times_raw_prep ?? undefined,
				cook: row.times_raw_cook ?? undefined,
				total: row.times_raw_total ?? undefined,
			},
		},
		servings: {
			count: row.servings_count ?? undefined,
			raw: row.servings_raw,
		},
		rating: row.rating ?? undefined,
		source: {
			name: row.source_name ?? undefined,
			url: row.source_url ?? undefined,
		},
		difficulty: row.difficulty ?? undefined,
		nutritionRaw: row.nutrition_raw ?? undefined,
		ingredients: ingredients.map((i) => ({
			text: i.text,
			...(i.group_label ? { group: i.group_label } : {}),
		})),
		steps: steps.map((s) => s.text),
		tags: tags.map((t) => t.tag),
		photoIds: photos.map((p) => p.photo_id),
		importedAt: row.imported_at,
		createdAt: row.created_at,
	};
}

function countRecipes(): number {
	const database = getDb();
	const rows = database.selectObjects(`SELECT COUNT(*) as n FROM recipes`) as { n: number }[];
	return rows[0]?.n ?? 0;
}

// --- Worker message handler ---

type Request =
	| { requestId: string; type: 'init' }
	| { requestId: string; type: 'import'; recipe: Recipe }
	| { requestId: string; type: 'search'; opts: SearchOptions }
	| { requestId: string; type: 'getRecipe'; id: string }
	| { requestId: string; type: 'countRecipes' };

function reply(requestId: string, payload: object) {
	self.postMessage({ requestId, ...payload });
}

self.addEventListener('message', async (event: MessageEvent<Request>) => {
	const req = event.data;
	const { requestId } = req;
	try {
		if (req.type === 'init') {
			await initDb();
			reply(requestId, { type: 'init:ok' });
		} else if (req.type === 'import') {
			const result = importRecipe(req.recipe);
			reply(requestId, { type: 'import:result', result });
		} else if (req.type === 'search') {
			const results = searchRecipes(req.opts);
			reply(requestId, { type: 'search:result', results });
		} else if (req.type === 'getRecipe') {
			const recipe = getRecipe(req.id);
			reply(requestId, { type: 'getRecipe:result', recipe });
		} else if (req.type === 'countRecipes') {
			const count = countRecipes();
			reply(requestId, { type: 'countRecipes:result', count });
		}
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		reply(requestId, { error });
	}
});
