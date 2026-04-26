import { importArchive } from '@kitchen-gremlin/importers';
import { DbClient } from '$lib/db/client.js';
import { OpfsPhotoStore } from '$lib/photos/opfs-store.js';

export interface ImportProgress {
	type: 'progress';
	done: number;
	total: number;
	failed: number;
}

export interface ImportDone {
	type: 'done';
	imported: number;
	skipped: number;
	failed: number;
	errors: { entryName: string; message: string }[];
}

export type ImportMessage = ImportProgress | ImportDone;

/**
 * Run the full import pipeline for a `.paprikarecipes` file.
 * Calls `onProgress` with each update; resolves with the final summary.
 */
export async function runImport(
	file: File,
	dbWorker: Worker,
	onProgress: (msg: ImportProgress) => void,
): Promise<ImportDone> {
	const db = new DbClient(dbWorker);
	const photos = new OpfsPhotoStore();

	let imported = 0;
	let skipped = 0;
	let failed = 0;
	let done = 0;
	const errors: ImportDone['errors'] = [];

	// Count total entries first so progress bar has a denominator
	const { countEntries } = await import('@kitchen-gremlin/importers');
	const total = await countEntries(file);

	for await (const result of importArchive(file)) {
		done++;

		if ('error' in result) {
			failed++;
			errors.push({
				entryName: result.entryName,
				message: result.error instanceof Error ? result.error.message : String(result.error),
			});
			onProgress({ type: 'progress', done, total, failed });
			continue;
		}

		try {
			// Store photos first so photoIds are correct before DB write
			const photoIds: string[] = [];
			for (const photo of result.photos) {
				const id = await photos.put(photo.blob);
				photoIds.push(id);
			}
			result.recipe.photoIds = photoIds;

			const outcome = await db.importRecipe(result.recipe);
			if (outcome === 'inserted') imported++;
			else skipped++;
		} catch (e) {
			failed++;
			errors.push({
				entryName: result.recipe.title,
				message: e instanceof Error ? e.message : String(e),
			});
		}

		onProgress({ type: 'progress', done, total, failed });
	}

	return { type: 'done', imported, skipped, failed, errors };
}
