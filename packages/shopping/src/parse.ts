/**
 * Best-effort parsing of free-text ingredient lines into quantity / unit / name.
 * Paprika ingredients are arbitrary human text, so every parse is a guess:
 * the raw string is always preserved and shown when parsing fails.
 */

export interface ParsedIngredient {
	/** The original text, untouched. */
	raw: string;
	/** Numeric quantity if one was found (ranges resolve to the upper bound). */
	quantity?: number;
	/** Canonical unit if one was found (e.g. 'g', 'tbsp'). */
	unit?: string;
	/** The ingredient name with quantity/unit stripped, lowercased. */
	name: string;
}

const UNICODE_FRACTIONS: Record<string, number> = {
	'½': 0.5,
	'⅓': 1 / 3,
	'⅔': 2 / 3,
	'¼': 0.25,
	'¾': 0.75,
	'⅕': 0.2,
	'⅖': 0.4,
	'⅗': 0.6,
	'⅘': 0.8,
	'⅙': 1 / 6,
	'⅚': 5 / 6,
	'⅛': 0.125,
	'⅜': 0.375,
	'⅝': 0.625,
	'⅞': 0.875,
};

/** Unit aliases → canonical unit. Canonical units are what consolidation groups on. */
const UNIT_ALIASES: Record<string, string> = {
	g: 'g',
	gram: 'g',
	grams: 'g',
	gr: 'g',
	kg: 'kg',
	kilo: 'kg',
	kilos: 'kg',
	kilogram: 'kg',
	kilograms: 'kg',
	mg: 'mg',
	oz: 'oz',
	ounce: 'oz',
	ounces: 'oz',
	lb: 'lb',
	lbs: 'lb',
	pound: 'lb',
	pounds: 'lb',
	ml: 'ml',
	millilitre: 'ml',
	millilitres: 'ml',
	milliliter: 'ml',
	milliliters: 'ml',
	l: 'l',
	litre: 'l',
	litres: 'l',
	liter: 'l',
	liters: 'l',
	tsp: 'tsp',
	teaspoon: 'tsp',
	teaspoons: 'tsp',
	tbsp: 'tbsp',
	tbs: 'tbsp',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
	cup: 'cup',
	cups: 'cup',
	pint: 'pint',
	pints: 'pint',
	clove: 'clove',
	cloves: 'clove',
	tin: 'tin',
	tins: 'tin',
	can: 'can',
	cans: 'can',
	jar: 'jar',
	jars: 'jar',
	pack: 'pack',
	packs: 'pack',
	packet: 'pack',
	packets: 'pack',
	bunch: 'bunch',
	bunches: 'bunch',
	sprig: 'sprig',
	sprigs: 'sprig',
	stick: 'stick',
	sticks: 'stick',
	slice: 'slice',
	slices: 'slice',
	pinch: 'pinch',
	pinches: 'pinch',
	handful: 'handful',
	handfuls: 'handful',
};

/** Parse a numeric token: "2", "1.5", "1/2", "1 1/2", "1½", "½". */
function parseNumberToken(token: string): number | undefined {
	const trimmed = token.trim();
	if (!trimmed) return undefined;

	// Mixed unicode fraction: "1½"
	const mixedUnicode = trimmed.match(/^(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
	if (mixedUnicode) {
		return parseInt(mixedUnicode[1]!, 10) + UNICODE_FRACTIONS[mixedUnicode[2]!]!;
	}

	// Bare unicode fraction: "½"
	const unicodeValue = UNICODE_FRACTIONS[trimmed];
	if (unicodeValue !== undefined) return unicodeValue;

	// Mixed ascii fraction: "1 1/2"
	const mixedAscii = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
	if (mixedAscii) {
		return parseInt(mixedAscii[1]!, 10) + parseInt(mixedAscii[2]!, 10) / parseInt(mixedAscii[3]!, 10);
	}

	// Ascii fraction: "1/2"
	const ascii = trimmed.match(/^(\d+)\/(\d+)$/);
	if (ascii) {
		return parseInt(ascii[1]!, 10) / parseInt(ascii[2]!, 10);
	}

	// Plain number: "2", "1.5"
	const plain = trimmed.match(/^\d+(?:\.\d+)?$/);
	if (plain) return parseFloat(trimmed);

	return undefined;
}

// Matches a leading quantity: mixed/plain numbers, fractions, and ranges ("2-3", "2 to 3").
const QUANTITY_RE =
	/^\s*((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]?)|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?:\s*(?:-|–|to)\s*((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?)|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]))?\s*/;

/**
 * Parse one ingredient line. Never throws; falls back to the whole line as the name.
 */
export function parseIngredient(raw: string): ParsedIngredient {
	let rest = raw.trim().replace(/^[-*•]\s*/, '');

	let quantity: number | undefined;
	const quantityMatch = rest.match(QUANTITY_RE);
	if (quantityMatch && quantityMatch[1]) {
		const low = parseNumberToken(quantityMatch[1]);
		const high = quantityMatch[2] ? parseNumberToken(quantityMatch[2]) : undefined;
		// Ranges resolve to the upper bound: better to over-buy than run out.
		quantity = high ?? low;
		if (quantity !== undefined) {
			rest = rest.slice(quantityMatch[0].length);
		}
	}

	let unit: string | undefined;
	// Unit may be glued to the number ("200g") or separated ("200 g", "2 tbsp").
	const unitMatch = rest.match(/^([a-zA-Z]+)\.?\s+/) ?? rest.match(/^([a-zA-Z]+)\.?$/);
	if (quantity !== undefined && unitMatch && unitMatch[1]) {
		const canonical = UNIT_ALIASES[unitMatch[1].toLowerCase()];
		if (canonical) {
			unit = canonical;
			rest = rest.slice(unitMatch[0].length);
		}
	}

	let name = rest
		.replace(/^of\s+/i, '')
		.trim()
		.toLowerCase();
	if (!name) name = raw.trim().toLowerCase();

	const result: ParsedIngredient = { raw, name };
	if (quantity !== undefined) result.quantity = quantity;
	if (unit !== undefined) result.unit = unit;
	return result;
}

/**
 * Normalise an ingredient name for grouping: cut preparation clauses
 * ("onion, finely chopped" → "onion"), collapse whitespace, singularise
 * trivially plural words ("onions" → "onion", "tomatoes" → "tomato").
 */
export function normalizeIngredientName(name: string): string {
	let n = name.toLowerCase().split(/[,(]/)[0]!.trim().replace(/\s+/g, ' ');

	if (n.endsWith('oes')) {
		n = n.slice(0, -2); // tomatoes → tomato, potatoes → potato
	} else if (n.endsWith('s') && !n.endsWith('ss') && !n.endsWith('us') && n.length > 3) {
		n = n.slice(0, -1); // onions → onion (but not "couscous", "asparagus")
	}
	return n;
}
