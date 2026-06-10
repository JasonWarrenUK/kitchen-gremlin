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

export interface SearchFilters {
	/** All listed tags must be present (AND). */
	tags?: string[];
	minRating?: number;
	maxTotalMins?: number;
	/** Substring matches against ingredient text; all must be present. */
	includeIngredients?: string[];
	/** Substring matches against ingredient text; any match excludes. */
	excludeIngredients?: string[];
}

export interface SearchOptions {
	query?: string;
	limit?: number;
	offset?: number;
	filters?: SearchFilters;
}

export interface PlanEntry {
	id: string;
	date: string; // YYYY-MM-DD
	slot: string; // breakfast | lunch | dinner
	recipeId: string | null;
	recipeTitle: string | null;
	primaryPhotoId: string | null;
	note: string | null;
}

export interface ShoppingItemRow {
	id: string;
	text: string;
	checked: boolean;
	recipeId: string | null;
	createdAt: string;
}

export interface TagCount {
	tag: string;
	count: number;
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

interface SummaryRow {
	id: string;
	title: string;
	source_url: string | null;
	source_name: string | null;
	rating: number | null;
	primary_photo_id: string | null;
}

function toSummary(r: SummaryRow): RecipeSummary {
	return {
		id: r.id,
		title: r.title,
		sourceUrl: r.source_url,
		sourceName: r.source_name,
		rating: r.rating,
		primaryPhotoId: r.primary_photo_id,
	};
}

function searchRecipes(opts: SearchOptions): RecipeSummary[] {
	const database = getDb();
	const { query = '', limit = 50, offset = 0, filters = {} } = opts;

	const where: string[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const binds: any[] = [];
	const hasFts = Boolean(query.trim());

	if (hasFts) {
		where.push(`r.id IN (SELECT recipe_id FROM recipes_fts WHERE recipes_fts MATCH ?)`);
		binds.push(query);
	}

	if (filters.tags && filters.tags.length > 0) {
		const placeholders = filters.tags.map(() => '?').join(',');
		where.push(
			`r.id IN (SELECT recipe_id FROM recipe_tags WHERE tag IN (${placeholders})
				GROUP BY recipe_id HAVING COUNT(DISTINCT tag) = ?)`,
		);
		binds.push(...filters.tags, filters.tags.length);
	}

	if (filters.minRating !== undefined) {
		where.push(`r.rating >= ?`);
		binds.push(filters.minRating);
	}

	if (filters.maxTotalMins !== undefined) {
		// Recipes with no parsed time stay visible under prep/cook fallback
		where.push(`COALESCE(r.total_mins, r.prep_mins + COALESCE(r.cook_mins, 0), r.cook_mins) <= ?`);
		binds.push(filters.maxTotalMins);
	}

	for (const term of filters.includeIngredients ?? []) {
		where.push(`r.id IN (SELECT recipe_id FROM recipe_ingredients WHERE text LIKE ?)`);
		binds.push(`%${term}%`);
	}

	for (const term of filters.excludeIngredients ?? []) {
		where.push(`r.id NOT IN (SELECT recipe_id FROM recipe_ingredients WHERE text LIKE ?)`);
		binds.push(`%${term}%`);
	}

	const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
	const orderSql = hasFts
		? `ORDER BY (SELECT rank FROM recipes_fts WHERE recipe_id = r.id AND recipes_fts MATCH ?)`
		: `ORDER BY r.title COLLATE NOCASE`;
	if (hasFts) binds.push(query);

	const rows = database.selectObjects(
		`SELECT r.id, r.title, r.source_url, r.source_name, r.rating,
			(SELECT photo_id FROM recipe_photos WHERE recipe_id = r.id ORDER BY position LIMIT 1) as primary_photo_id
		 FROM recipes r
		 ${whereSql}
		 ${orderSql}
		 LIMIT ? OFFSET ?`,
		[...binds, limit, offset],
	) as unknown as SummaryRow[];
	return rows.map(toSummary);
}

function listTags(): TagCount[] {
	const database = getDb();
	return database.selectObjects(
		`SELECT tag, COUNT(*) as count FROM recipe_tags GROUP BY tag ORDER BY count DESC, tag`,
	) as unknown as TagCount[];
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

// --- Meal planner ---

function getPlan(from: string, to: string): PlanEntry[] {
	const database = getDb();
	const rows = database.selectObjects(
		`SELECT p.id, p.date, p.slot, p.recipe_id, p.note, r.title as recipe_title,
			(SELECT photo_id FROM recipe_photos WHERE recipe_id = r.id ORDER BY position LIMIT 1) as primary_photo_id
		 FROM plan_entries p
		 LEFT JOIN recipes r ON r.id = p.recipe_id
		 WHERE p.date >= ? AND p.date <= ?
		 ORDER BY p.date, p.slot, p.created_at`,
		[from, to],
	) as {
		id: string;
		date: string;
		slot: string;
		recipe_id: string | null;
		note: string | null;
		recipe_title: string | null;
		primary_photo_id: string | null;
	}[];
	return rows.map((r) => ({
		id: r.id,
		date: r.date,
		slot: r.slot,
		recipeId: r.recipe_id,
		recipeTitle: r.recipe_title,
		primaryPhotoId: r.primary_photo_id,
		note: r.note,
	}));
}

function addPlanEntry(entry: {
	id: string;
	date: string;
	slot: string;
	recipeId: string | null;
	note: string | null;
}): void {
	const database = getDb();
	database.exec({
		sql: `INSERT INTO plan_entries (id, date, slot, recipe_id, note, created_at) VALUES (?,?,?,?,?,?)`,
		bind: [entry.id, entry.date, entry.slot, entry.recipeId, entry.note, new Date().toISOString()],
	});
}

function removePlanEntry(id: string): void {
	getDb().exec({ sql: `DELETE FROM plan_entries WHERE id = ?`, bind: [id] });
}

// --- Shopping list ---

function listShoppingItems(): ShoppingItemRow[] {
	const database = getDb();
	const rows = database.selectObjects(
		`SELECT id, text, checked, recipe_id, created_at FROM shopping_items ORDER BY created_at, id`,
	) as { id: string; text: string; checked: number; recipe_id: string | null; created_at: string }[];
	return rows.map((r) => ({
		id: r.id,
		text: r.text,
		checked: r.checked !== 0,
		recipeId: r.recipe_id,
		createdAt: r.created_at,
	}));
}

function addShoppingItems(items: { id: string; text: string; recipeId: string | null }[]): void {
	const database = getDb();
	const now = new Date().toISOString();
	database.exec('BEGIN');
	try {
		for (const item of items) {
			database.exec({
				sql: `INSERT INTO shopping_items (id, text, checked, recipe_id, created_at) VALUES (?,?,0,?,?)`,
				bind: [item.id, item.text, item.recipeId, now],
			});
		}
		database.exec('COMMIT');
	} catch (e) {
		database.exec('ROLLBACK');
		throw e;
	}
}

function setShoppingChecked(ids: string[], checked: boolean): void {
	if (ids.length === 0) return;
	const database = getDb();
	const placeholders = ids.map(() => '?').join(',');
	database.exec({
		sql: `UPDATE shopping_items SET checked = ? WHERE id IN (${placeholders})`,
		bind: [checked ? 1 : 0, ...ids],
	});
}

function removeShoppingItems(ids: string[]): void {
	if (ids.length === 0) return;
	const database = getDb();
	const placeholders = ids.map(() => '?').join(',');
	database.exec({ sql: `DELETE FROM shopping_items WHERE id IN (${placeholders})`, bind: ids });
}

function clearShopping(onlyChecked: boolean): void {
	const database = getDb();
	database.exec(onlyChecked ? `DELETE FROM shopping_items WHERE checked = 1` : `DELETE FROM shopping_items`);
}

// --- Cook log ---

function logCook(recipeId: string): void {
	const database = getDb();
	database.exec({
		sql: `INSERT INTO cook_log (id, recipe_id, cooked_at) VALUES (?,?,?)`,
		bind: [crypto.randomUUID(), recipeId, new Date().toISOString()],
	});
}

function getLastCooked(recipeId: string): string | null {
	const database = getDb();
	const rows = database.selectObjects(
		`SELECT cooked_at FROM cook_log WHERE recipe_id = ? ORDER BY cooked_at DESC LIMIT 1`,
		[recipeId],
	) as { cooked_at: string }[];
	return rows[0]?.cooked_at ?? null;
}

// --- Portable export ---

function exportLibrary(): Recipe[] {
	const database = getDb();
	const ids = database.selectObjects(`SELECT id FROM recipes ORDER BY title COLLATE NOCASE`) as {
		id: string;
	}[];
	const recipes: Recipe[] = [];
	for (const { id } of ids) {
		const recipe = getRecipe(id);
		if (recipe) recipes.push(recipe);
	}
	return recipes;
}

// --- Worker message handler ---

type Request =
	| { requestId: string; type: 'init' }
	| { requestId: string; type: 'import'; recipe: Recipe }
	| { requestId: string; type: 'search'; opts: SearchOptions }
	| { requestId: string; type: 'getRecipe'; id: string }
	| { requestId: string; type: 'countRecipes' }
	| { requestId: string; type: 'listTags' }
	| { requestId: string; type: 'getPlan'; from: string; to: string }
	| {
			requestId: string;
			type: 'addPlanEntry';
			entry: { id: string; date: string; slot: string; recipeId: string | null; note: string | null };
	  }
	| { requestId: string; type: 'removePlanEntry'; id: string }
	| { requestId: string; type: 'listShoppingItems' }
	| {
			requestId: string;
			type: 'addShoppingItems';
			items: { id: string; text: string; recipeId: string | null }[];
	  }
	| { requestId: string; type: 'setShoppingChecked'; ids: string[]; checked: boolean }
	| { requestId: string; type: 'removeShoppingItems'; ids: string[] }
	| { requestId: string; type: 'clearShopping'; onlyChecked: boolean }
	| { requestId: string; type: 'logCook'; recipeId: string }
	| { requestId: string; type: 'getLastCooked'; recipeId: string }
	| { requestId: string; type: 'exportLibrary' };

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
		} else if (req.type === 'listTags') {
			reply(requestId, { tags: listTags() });
		} else if (req.type === 'getPlan') {
			reply(requestId, { entries: getPlan(req.from, req.to) });
		} else if (req.type === 'addPlanEntry') {
			addPlanEntry(req.entry);
			reply(requestId, { ok: true });
		} else if (req.type === 'removePlanEntry') {
			removePlanEntry(req.id);
			reply(requestId, { ok: true });
		} else if (req.type === 'listShoppingItems') {
			reply(requestId, { items: listShoppingItems() });
		} else if (req.type === 'addShoppingItems') {
			addShoppingItems(req.items);
			reply(requestId, { ok: true });
		} else if (req.type === 'setShoppingChecked') {
			setShoppingChecked(req.ids, req.checked);
			reply(requestId, { ok: true });
		} else if (req.type === 'removeShoppingItems') {
			removeShoppingItems(req.ids);
			reply(requestId, { ok: true });
		} else if (req.type === 'clearShopping') {
			clearShopping(req.onlyChecked);
			reply(requestId, { ok: true });
		} else if (req.type === 'logCook') {
			logCook(req.recipeId);
			reply(requestId, { ok: true });
		} else if (req.type === 'getLastCooked') {
			reply(requestId, { lastCooked: getLastCooked(req.recipeId) });
		} else if (req.type === 'exportLibrary') {
			reply(requestId, { recipes: exportLibrary() });
		}
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		reply(requestId, { error });
	}
});
