import { expandTerm } from './synonyms.js';

/**
 * Build an FTS5 MATCH query from a plain-text search string with synonym expansion.
 * Each word is expanded to an OR group of synonyms.
 * e.g. "onion soup" → `("onion" OR "onions" OR "shallot" ...) AND ("soup")`
 */
export function buildFtsQuery(input: string): string {
	const words = input
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);

	if (words.length === 0) return '';

	return words
		.map((word) => {
			const synonyms = expandTerm(word);
			if (synonyms.length === 1) {
				return `"${escapeForFts(word)}"`;
			}
			return '(' + synonyms.map((s) => `"${escapeForFts(s)}"`).join(' OR ') + ')';
		})
		.join(' AND ');
}

function escapeForFts(term: string): string {
	// FTS5 double-quote escaping: double any existing double-quotes
	return term.replace(/"/g, '""');
}
