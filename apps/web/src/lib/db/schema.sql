-- Core recipe table (flat columns used for filtering/sorting)
CREATE TABLE IF NOT EXISTS recipes (
	id TEXT PRIMARY KEY,
	paprika_uid TEXT UNIQUE NOT NULL,
	title TEXT NOT NULL,
	description TEXT,
	notes TEXT,
	prep_mins INTEGER,
	cook_mins INTEGER,
	total_mins INTEGER,
	times_raw_prep TEXT,
	times_raw_cook TEXT,
	times_raw_total TEXT,
	servings_count INTEGER,
	servings_raw TEXT NOT NULL DEFAULT '',
	rating REAL,
	source_name TEXT,
	source_url TEXT,
	difficulty TEXT,
	nutrition_raw TEXT,
	imported_at TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	text TEXT NOT NULL,
	group_label TEXT
);

CREATE TABLE IF NOT EXISTS recipe_steps (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_tags (
	recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
	tag TEXT NOT NULL,
	PRIMARY KEY (recipe_id, tag)
);

CREATE TABLE IF NOT EXISTS recipe_photos (
	recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	photo_id TEXT NOT NULL,
	PRIMARY KEY (recipe_id, position)
);

-- FTS5 virtual table over searchable text fields
CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
	recipe_id UNINDEXED,
	title,
	ingredients_text,
	steps_text,
	notes,
	tags,
	content='',
	tokenize='unicode61'
);

-- Triggers to keep FTS in sync (insert handled by DB worker after each recipe write)
-- Deletion trigger
CREATE TRIGGER IF NOT EXISTS recipes_fts_delete
	AFTER DELETE ON recipes BEGIN
	INSERT INTO recipes_fts(recipes_fts, recipe_id, title, ingredients_text, steps_text, notes, tags)
		VALUES('delete', old.id, '', '', '', '', '');
END;
