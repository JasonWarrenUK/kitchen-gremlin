import { describe, it, expect } from 'vitest';
import { parseRecipe } from '../src/paprika/parse.js';
import { minimal, full, badTimes, withSubHeaders, tinyJpegBase64 } from './fixtures/paprika.js';

describe('parseRecipe', () => {
	it('parses a minimal recipe without throwing', async () => {
		const { recipe } = await parseRecipe(minimal);
		expect(recipe.title).toBe('Simple Soup');
		expect(recipe.ingredients).toHaveLength(0);
		expect(recipe.steps).toHaveLength(0);
		expect(recipe.photoIds).toHaveLength(0);
	});

	it('parses a full recipe with all fields', async () => {
		const { recipe } = await parseRecipe(full);
		expect(recipe.title).toContain('Butter Chickpeas');
		expect(recipe.tags).toEqual(['Quick', 'Vegetarian']);
		expect(recipe.rating).toBe(4);
		expect(recipe.times.prepMins).toBe(10);
		expect(recipe.times.cookMins).toBe(20);
		expect(recipe.times.totalMins).toBe(30);
		expect(recipe.servings.count).toBe(4);
		expect(recipe.source.name).toBe('Family Kitchen');
	});

	it('preserves raw time strings when parsing succeeds', async () => {
		const { recipe } = await parseRecipe(full);
		expect(recipe.times.raw.prep).toBe('10 mins');
		expect(recipe.times.raw.cook).toBe('20 mins');
	});

	it('keeps raw string when time cannot be parsed, sets mins to undefined', async () => {
		const { recipe } = await parseRecipe(badTimes);
		expect(recipe.times.prepMins).toBeUndefined();
		expect(recipe.times.cookMins).toBeUndefined();
		expect(recipe.times.raw.prep).toBe('overnight');
		expect(recipe.times.raw.cook).toBe('until done');
	});

	it('splits ingredients into items and preserves group sub-headers', async () => {
		const { recipe } = await parseRecipe(withSubHeaders);
		const groups = [...new Set(recipe.ingredients.map((i) => i.group).filter(Boolean))];
		expect(groups).toContain('For the meat sauce');
		expect(groups).toContain('For the béchamel');
		// Items within the group should not include the header line itself
		const headerTexts = recipe.ingredients.map((i) => i.text);
		expect(headerTexts).not.toContain('For the meat sauce:');
	});

	it('parses a photo and returns a photo with an id', async () => {
		const raw = { ...minimal, photo_data: tinyJpegBase64 };
		const { recipe, photos } = await parseRecipe(raw);
		expect(photos).toHaveLength(1);
		expect(photos[0]?.id).toMatch(/^[0-9a-f]{64}$/);
		expect(recipe.photoIds).toHaveLength(1);
		expect(recipe.photoIds[0]).toBe(photos[0]?.id);
	});

	it('deduplicates identical photos across fields', async () => {
		const raw = { ...minimal, photo_data: tinyJpegBase64, photo_large: tinyJpegBase64 };
		// photo_large takes precedence; if both are same blob, only one photo entry
		const { photos } = await parseRecipe(raw);
		expect(photos).toHaveLength(1);
	});

	it('strips inline image refs from ingredient text', async () => {
		const raw = { ...minimal, ingredients: 'onion [image:abc123]\ngarlic' };
		const { recipe } = await parseRecipe(raw);
		expect(recipe.ingredients[0]?.text).toBe('onion');
		expect(recipe.ingredients[1]?.text).toBe('garlic');
	});

	it('generates a stable paprikaUid from the uid field', async () => {
		const { recipe } = await parseRecipe(full);
		expect(recipe.paprikaUid).toBe('test-uid-002');
	});

	it('falls back to a generated uid when uid field is absent', async () => {
		const { uid: _, ...noUid } = full;
		const { recipe } = await parseRecipe(noUid as typeof full);
		expect(recipe.paprikaUid).toBeTruthy();
	});
});
