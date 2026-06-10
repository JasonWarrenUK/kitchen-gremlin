import { parseIngredient, normalizeIngredientName } from './parse.js';

/** An item on the stored shopping list (one per added ingredient line). */
export interface ShoppingItem {
	id: string;
	text: string;
	checked: boolean;
}

/** One amount in a consolidated line, e.g. "200 g" or "1½" (unitless count). */
export interface Amount {
	quantity: number;
	unit?: string;
}

/** A consolidated display line: several stored items merged by ingredient name. */
export interface ShoppingLine {
	/** Grouping key (normalised name). */
	key: string;
	/** Display name. */
	name: string;
	/** Summed amounts, one per unit dimension (count, mass, volume, …). */
	amounts: Amount[];
	/** True if any merged part had no parseable quantity (display "+ extra"). */
	hasUnquantified: boolean;
	/** ids of the underlying stored items. */
	itemIds: string[];
	/** Raw texts that fed this line. */
	parts: string[];
	/** True when every underlying item is checked. */
	checked: boolean;
}

/** Units convertible to a common base for summing. */
const MASS_UNITS: Record<string, number> = { mg: 0.001, g: 1, kg: 1000 };
const VOLUME_UNITS: Record<string, number> = { ml: 1, l: 1000 };

function dimensionOf(unit: string | undefined): string {
	if (unit === undefined) return 'count';
	if (unit in MASS_UNITS) return 'mass';
	if (unit in VOLUME_UNITS) return 'volume';
	return `unit:${unit}`; // tbsp, clove, tin… sum only with themselves
}

/**
 * Merge stored shopping items into display lines, summing quantities with
 * sane units: `1 onion` + `½ onion` + `200g onions` → one "onion" line
 * with amounts "1½" and "200 g".
 */
export function consolidate(items: ShoppingItem[]): ShoppingLine[] {
	const lines = new Map<string, ShoppingLine & { sums: Map<string, number> }>();

	for (const item of items) {
		const parsed = parseIngredient(item.text);
		const key = normalizeIngredientName(parsed.name);

		let line = lines.get(key);
		if (!line) {
			line = {
				key,
				name: key,
				amounts: [],
				hasUnquantified: false,
				itemIds: [],
				parts: [],
				checked: true,
				sums: new Map(),
			};
			lines.set(key, line);
		}

		line.itemIds.push(item.id);
		line.parts.push(item.text);
		if (!item.checked) line.checked = false;

		if (parsed.quantity === undefined) {
			line.hasUnquantified = true;
			continue;
		}

		const dimension = dimensionOf(parsed.unit);
		let base: number;
		if (dimension === 'mass') {
			base = parsed.quantity * MASS_UNITS[parsed.unit!]!;
		} else if (dimension === 'volume') {
			base = parsed.quantity * VOLUME_UNITS[parsed.unit!]!;
		} else {
			base = parsed.quantity;
		}
		line.sums.set(dimension, (line.sums.get(dimension) ?? 0) + base);
	}

	const result: ShoppingLine[] = [];
	for (const line of lines.values()) {
		const { sums, ...rest } = line;
		const amounts: Amount[] = [];
		for (const [dimension, total] of sums) {
			if (dimension === 'count') {
				amounts.push({ quantity: total });
			} else if (dimension === 'mass') {
				amounts.push(total >= 1000 ? { quantity: total / 1000, unit: 'kg' } : { quantity: total, unit: 'g' });
			} else if (dimension === 'volume') {
				amounts.push(total >= 1000 ? { quantity: total / 1000, unit: 'l' } : { quantity: total, unit: 'ml' });
			} else {
				amounts.push({ quantity: total, unit: dimension.slice('unit:'.length) });
			}
		}
		// Counts first, then by unit name, for stable display
		amounts.sort((a, b) => (a.unit ?? '').localeCompare(b.unit ?? ''));
		result.push({ ...rest, amounts });
	}

	result.sort((a, b) => a.name.localeCompare(b.name));
	return result;
}

const DISPLAY_FRACTIONS: [number, string][] = [
	[0.25, '¼'],
	[1 / 3, '⅓'],
	[0.5, '½'],
	[2 / 3, '⅔'],
	[0.75, '¾'],
];

/** Format one amount for display: "200 g", "1.5 kg", "1½", "2 tbsp". */
export function formatAmount(amount: Amount): string {
	const { quantity, unit } = amount;
	const whole = Math.floor(quantity);
	const frac = quantity - whole;

	let numberText: string;
	const fracMatch = DISPLAY_FRACTIONS.find(([v]) => Math.abs(frac - v) < 0.01);
	if (frac < 0.01) {
		numberText = String(whole);
	} else if (fracMatch) {
		numberText = whole > 0 ? `${whole}${fracMatch[1]}` : fracMatch[1];
	} else {
		numberText = String(Math.round(quantity * 100) / 100);
	}

	return unit ? `${numberText} ${unit}` : numberText;
}

/** Format a whole line's amounts: "1½ + 200 g", or "" when nothing parsed. */
export function formatAmounts(line: ShoppingLine): string {
	const parts = line.amounts.map(formatAmount);
	const joined = parts.join(' + ');
	if (line.hasUnquantified && joined) return `${joined} + extra`;
	return joined;
}
