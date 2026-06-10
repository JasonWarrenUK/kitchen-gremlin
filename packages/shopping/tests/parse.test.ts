import { describe, expect, it } from 'vitest';
import { parseIngredient, normalizeIngredientName } from '../src/parse.js';

describe('parseIngredient', () => {
	it('parses "1 onion"', () => {
		expect(parseIngredient('1 onion')).toEqual({ raw: '1 onion', quantity: 1, name: 'onion' });
	});

	it('parses "200g onions" (glued unit)', () => {
		expect(parseIngredient('200g onions')).toEqual({
			raw: '200g onions',
			quantity: 200,
			unit: 'g',
			name: 'onions',
		});
	});

	it('parses "200 g onions" (spaced unit)', () => {
		expect(parseIngredient('200 g onions')).toMatchObject({ quantity: 200, unit: 'g', name: 'onions' });
	});

	it('parses unicode fraction "½ onion"', () => {
		expect(parseIngredient('½ onion')).toMatchObject({ quantity: 0.5, name: 'onion' });
	});

	it('parses mixed unicode "1½ cups flour"', () => {
		expect(parseIngredient('1½ cups flour')).toMatchObject({ quantity: 1.5, unit: 'cup', name: 'flour' });
	});

	it('parses ascii fraction "1/2 tsp salt"', () => {
		expect(parseIngredient('1/2 tsp salt')).toMatchObject({ quantity: 0.5, unit: 'tsp', name: 'salt' });
	});

	it('parses mixed ascii "1 1/2 kg potatoes"', () => {
		expect(parseIngredient('1 1/2 kg potatoes')).toMatchObject({
			quantity: 1.5,
			unit: 'kg',
			name: 'potatoes',
		});
	});

	it('resolves ranges to the upper bound: "2-3 carrots"', () => {
		expect(parseIngredient('2-3 carrots')).toMatchObject({ quantity: 3, name: 'carrots' });
	});

	it('resolves "2 to 3 tbsp olive oil"', () => {
		expect(parseIngredient('2 to 3 tbsp olive oil')).toMatchObject({
			quantity: 3,
			unit: 'tbsp',
			name: 'olive oil',
		});
	});

	it('strips "of": "2 cloves of garlic"', () => {
		expect(parseIngredient('2 cloves of garlic')).toMatchObject({
			quantity: 2,
			unit: 'clove',
			name: 'garlic',
		});
	});

	it('keeps unparseable lines whole: "salt and pepper to taste"', () => {
		expect(parseIngredient('salt and pepper to taste')).toEqual({
			raw: 'salt and pepper to taste',
			name: 'salt and pepper to taste',
		});
	});

	it('does not eat a unit-looking word without a quantity: "grated cheese"', () => {
		expect(parseIngredient('grated cheese')).toEqual({ raw: 'grated cheese', name: 'grated cheese' });
	});

	it('does not treat a non-unit word as a unit: "2 large eggs"', () => {
		expect(parseIngredient('2 large eggs')).toMatchObject({ quantity: 2, name: 'large eggs' });
		expect(parseIngredient('2 large eggs').unit).toBeUndefined();
	});

	it('strips bullet markers', () => {
		expect(parseIngredient('- 1 onion')).toMatchObject({ quantity: 1, name: 'onion' });
	});

	it('parses decimals: "0.5 l milk"', () => {
		expect(parseIngredient('0.5 l milk')).toMatchObject({ quantity: 0.5, unit: 'l', name: 'milk' });
	});

	it('canonicalises unit aliases: "3 tablespoons soy sauce"', () => {
		expect(parseIngredient('3 tablespoons soy sauce')).toMatchObject({
			quantity: 3,
			unit: 'tbsp',
			name: 'soy sauce',
		});
	});
});

describe('normalizeIngredientName', () => {
	it('cuts preparation clauses', () => {
		expect(normalizeIngredientName('onion, finely chopped')).toBe('onion');
	});

	it('cuts parentheticals', () => {
		expect(normalizeIngredientName('butter (softened)')).toBe('butter');
	});

	it('singularises s-plurals', () => {
		expect(normalizeIngredientName('onions')).toBe('onion');
	});

	it('singularises oes-plurals', () => {
		expect(normalizeIngredientName('tomatoes')).toBe('tomato');
	});

	it('leaves ss/us words alone', () => {
		expect(normalizeIngredientName('couscous')).toBe('couscous');
		expect(normalizeIngredientName('asparagus')).toBe('asparagus');
	});

	it('collapses whitespace and lowercases', () => {
		expect(normalizeIngredientName('  Red   Onion ')).toBe('red onion');
	});
});
