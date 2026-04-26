import type { ParseResult } from './parse.js';
import { parseRecipe } from './parse.js';
import { extractEntries } from './unzip.js';
import { gunzipEntry } from './gunzip.js';
import type { PaprikaRecipeRaw } from './types.js';

export type { ParseResult } from './parse.js';

/**
 * Stream recipes from a `.paprikarecipes` archive one at a time.
 * Yields each parsed recipe + its photos without holding all data in memory.
 * Errors on individual recipes are caught and yielded as `{ error, entryName }`.
 */
export async function* importArchive(
	file: File | Blob,
): AsyncIterable<ParseResult | { error: unknown; entryName: string }> {
	const buffer = await file.arrayBuffer();
	const zipBytes = new Uint8Array(buffer);
	const entries = extractEntries(zipBytes);

	for (const entry of entries) {
		try {
			const jsonBytes = gunzipEntry(entry.data);
			const text = new TextDecoder('utf-8').decode(jsonBytes);
			const raw = JSON.parse(text) as PaprikaRecipeRaw;
			const result = await parseRecipe(raw);
			yield result;
		} catch (error) {
			yield { error, entryName: entry.name };
		}
	}
}

/** Count entries without parsing — useful for showing "x of N" progress. */
export async function countEntries(file: File | Blob): Promise<number> {
	const buffer = await file.arrayBuffer();
	const zipBytes = new Uint8Array(buffer);
	return extractEntries(zipBytes).length;
}
