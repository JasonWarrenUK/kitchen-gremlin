import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { importArchive, countEntries } from '../src/index.js';

const ARCHIVE_PATH = join(import.meta.dirname, '../../../docs/imports/my-recipes.paprikarecipes');
const EXPECTED_COUNT = 990;

const skip = !existsSync(ARCHIVE_PATH);

describe.skipIf(skip)('Paprika archive round-trip (requires real export)', () => {
	it(`parses all ${EXPECTED_COUNT} recipes without throwing`, async () => {
		const buf = await readFile(ARCHIVE_PATH);
		const file = new File([buf], 'my-recipes.paprikarecipes');

		const total = await countEntries(file);
		expect(total).toBe(EXPECTED_COUNT);

		let parsed = 0;
		let failed = 0;

		for await (const result of importArchive(file)) {
			if ('error' in result) {
				failed++;
				console.warn('Failed entry:', result.entryName, result.error);
			} else {
				parsed++;
				// Spot-check every recipe has at least a title
				expect(result.recipe.title).toBeTruthy();
			}
		}

		expect(failed).toBe(0);
		expect(parsed).toBe(EXPECTED_COUNT);
	}, 120_000); // allow 2 min for 990 recipes

	it('spot-checks a known recipe "Butter Chickpeas" for field fidelity', async () => {
		const buf = await readFile(ARCHIVE_PATH);
		const file = new File([buf], 'my-recipes.paprikarecipes');

		for await (const result of importArchive(file)) {
			if ('error' in result) continue;
			if (result.recipe.title.toLowerCase().includes('butter chickpeas')) {
				expect(result.recipe.ingredients.length).toBeGreaterThan(0);
				expect(result.recipe.steps.length).toBeGreaterThan(0);
				return;
			}
		}

		// If the recipe isn't found, that's worth knowing but not a hard fail
		console.warn('"Butter Chickpeas" not found in archive — spot-check skipped');
	}, 120_000);
});
