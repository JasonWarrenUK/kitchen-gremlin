import { describe, expect, it } from 'vitest';
import { consolidate, formatAmount, formatAmounts } from '../src/consolidate.js';
import type { ShoppingItem } from '../src/consolidate.js';

function items(...texts: string[]): ShoppingItem[] {
	return texts.map((text, i) => ({ id: String(i), text, checked: false }));
}

describe('consolidate', () => {
	it('merges the spec example into one line: 1 onion + ½ onion + 200g onions', () => {
		const lines = consolidate(items('1 onion', '½ onion', '200g onions'));
		expect(lines).toHaveLength(1);
		const line = lines[0]!;
		expect(line.name).toBe('onion');
		expect(line.itemIds).toEqual(['0', '1', '2']);
		expect(formatAmounts(line)).toBe('1½ + 200 g');
	});

	it('sums same-unit masses and upgrades to kg', () => {
		const lines = consolidate(items('600g potatoes', '½ kg potatoes'));
		expect(lines).toHaveLength(1);
		expect(formatAmounts(lines[0]!)).toBe('1.1 kg');
	});

	it('sums volumes and upgrades to litres', () => {
		const lines = consolidate(items('500ml milk', '700 ml milk'));
		expect(formatAmounts(lines[0]!)).toBe('1.2 l');
	});

	it('keeps spoon units distinct from ml', () => {
		const lines = consolidate(items('2 tbsp olive oil', '100ml olive oil'));
		expect(lines).toHaveLength(1);
		expect(formatAmounts(lines[0]!)).toBe('100 ml + 2 tbsp');
	});

	it('groups despite preparation clauses and plurals', () => {
		const lines = consolidate(items('1 onion, finely chopped', '2 onions'));
		expect(lines).toHaveLength(1);
		expect(formatAmounts(lines[0]!)).toBe('3');
	});

	it('keeps different ingredients separate', () => {
		const lines = consolidate(items('1 onion', '2 carrots'));
		expect(lines).toHaveLength(2);
		expect(lines.map((l) => l.name)).toEqual(['carrot', 'onion']);
	});

	it('marks unquantified parts as "+ extra"', () => {
		const lines = consolidate(items('2 carrots', 'carrots, for the garnish'));
		expect(lines).toHaveLength(1);
		expect(lines[0]!.hasUnquantified).toBe(true);
		expect(formatAmounts(lines[0]!)).toBe('2 + extra');
	});

	it('line is checked only when all parts are checked', () => {
		const lines = consolidate([
			{ id: 'a', text: '1 onion', checked: true },
			{ id: 'b', text: '2 onions', checked: false },
		]);
		expect(lines[0]!.checked).toBe(false);

		const allChecked = consolidate([
			{ id: 'a', text: '1 onion', checked: true },
			{ id: 'b', text: '2 onions', checked: true },
		]);
		expect(allChecked[0]!.checked).toBe(true);
	});
});

describe('formatAmount', () => {
	it('renders common fractions', () => {
		expect(formatAmount({ quantity: 1.5 })).toBe('1½');
		expect(formatAmount({ quantity: 0.25 })).toBe('¼');
		expect(formatAmount({ quantity: 2 / 3 })).toBe('⅔');
	});

	it('renders whole numbers plainly', () => {
		expect(formatAmount({ quantity: 3 })).toBe('3');
	});

	it('renders units with a space', () => {
		expect(formatAmount({ quantity: 200, unit: 'g' })).toBe('200 g');
	});

	it('renders near-fraction decimals as fractions', () => {
		expect(formatAmount({ quantity: 1.333333, unit: 'kg' })).toBe('1⅓ kg');
	});

	it('rounds awkward decimals to 2dp', () => {
		expect(formatAmount({ quantity: 1.847, unit: 'kg' })).toBe('1.85 kg');
	});
});
