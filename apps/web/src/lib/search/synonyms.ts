/**
 * Curated ingredient synonym groups.
 * Each entry is a canonical term → set of synonyms (including itself).
 * Full ontology is a later concern; this stub demonstrates the pattern.
 */
export const synonymGroups: string[][] = [
	['onion', 'onions', 'spring onion', 'spring onions', 'shallot', 'shallots', 'red onion'],
	['garlic', 'garlic clove', 'garlic cloves'],
	['chilli', 'chili', 'chilies', 'chillies', 'hot pepper'],
	['courgette', 'zucchini'],
	['aubergine', 'eggplant'],
	['coriander', 'cilantro'],
	['chickpeas', 'chickpea', 'garbanzo', 'garbanzos'],
	['tomato', 'tomatoes'],
	['butter', 'unsalted butter', 'salted butter'],
];

const termToGroup = new Map<string, string[]>();
for (const group of synonymGroups) {
	for (const term of group) {
		termToGroup.set(term.toLowerCase(), group);
	}
}

/** Expand a single token to all synonyms if it has them. Returns the token unchanged otherwise. */
export function expandTerm(term: string): string[] {
	const group = termToGroup.get(term.toLowerCase());
	return group ?? [term];
}
