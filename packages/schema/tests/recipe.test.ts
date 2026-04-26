import { describe, it, expect } from 'vitest';
import { RecipeSchema } from '../src/recipe.js';

const valid = {
	id: '00000000-0000-4000-8000-000000000001',
	paprikaUid: 'abc-123',
	title: 'Butter Chickpeas',
	ingredients: [{ text: '400g chickpeas' }, { text: '50g butter', group: 'For the sauce' }],
	steps: ['Heat pan', 'Add butter and chickpeas'],
	times: { raw: { prep: '10 mins', cook: '20 mins' }, prepMins: 10, cookMins: 20 },
	servings: { count: 4, raw: '4' },
	source: { name: 'Family recipe' },
	tags: ['quick', 'vegetarian'],
	photoIds: [],
	importedAt: '2024-01-01T00:00:00Z',
	createdAt: '2024-01-01T00:00:00Z',
};

describe('RecipeSchema', () => {
	it('accepts a valid recipe', () => {
		const result = RecipeSchema.safeParse(valid);
		expect(result.success).toBe(true);
	});

	it('rejects a recipe with no title', () => {
		const result = RecipeSchema.safeParse({ ...valid, title: '' });
		expect(result.success).toBe(false);
	});

	it('rejects a recipe with missing title field', () => {
		const { title: _, ...noTitle } = valid;
		const result = RecipeSchema.safeParse(noTitle);
		expect(result.success).toBe(false);
	});

	it('accepts optional fields being absent', () => {
		const minimal = { ...valid, description: undefined, notes: undefined, difficulty: undefined };
		const result = RecipeSchema.safeParse(minimal);
		expect(result.success).toBe(true);
	});

	it('rejects rating outside 0-5', () => {
		const result = RecipeSchema.safeParse({ ...valid, rating: 6 });
		expect(result.success).toBe(false);
	});
});
