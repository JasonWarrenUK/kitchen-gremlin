import type { Recipe, Ingredient } from '@kitchen-gremlin/schema';
import type { PaprikaRecipeRaw } from './types.js';
import type { ImportedPhoto } from './photos.js';
import { decodePhoto, sniffMimeType } from './photos.js';

export interface ParseResult {
	recipe: Recipe;
	photos: ImportedPhoto[];
}

/** Inline image refs Paprika embeds in text fields, e.g. [image:uuid] */
const INLINE_IMAGE_RE = /\[image:[^\]]*\]/gi;
/** Crude HTML tag stripper */
const HTML_TAG_RE = /<[^>]+>/g;

function cleanText(s: string): string {
	return s.replace(HTML_TAG_RE, '').replace(INLINE_IMAGE_RE, '').trim();
}

/**
 * Detect whether a line looks like a sub-header (group label) rather than an ingredient.
 * Heuristic: ends with ':', contains no digits or measurement-like words, not blank.
 */
function isGroupHeader(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed || !trimmed.endsWith(':')) return false;
	// If it contains a digit (quantities) it's likely an ingredient with a note
	if (/\d/.test(trimmed)) return false;
	return true;
}

function parseIngredients(raw: string | undefined): Ingredient[] {
	if (!raw) return [];
	const lines = raw.split('\n');
	const result: Ingredient[] = [];
	let currentGroup: string | undefined;
	for (const line of lines) {
		const cleaned = cleanText(line);
		if (!cleaned) continue;
		if (isGroupHeader(cleaned)) {
			currentGroup = cleaned.slice(0, -1).trim(); // strip trailing ':'
			continue;
		}
		result.push(currentGroup !== undefined ? { text: cleaned, group: currentGroup } : { text: cleaned });
	}
	return result;
}

function parseSteps(raw: string | undefined): string[] {
	if (!raw) return [];
	return raw
		.split('\n')
		.map((l) => cleanText(l))
		.filter(Boolean);
}

/** Best-effort parse of human strings like "15 mins", "1 hour 30 min", "90 minutes". */
function parseMinutes(raw: string | undefined): number | undefined {
	if (!raw) return undefined;
	const lower = raw.toLowerCase();
	let total = 0;
	const hourMatch = lower.match(/(\d+)\s*h(ou)?r/);
	const minMatch = lower.match(/(\d+)\s*min/);
	if (hourMatch?.[1]) total += parseInt(hourMatch[1], 10) * 60;
	if (minMatch?.[1]) total += parseInt(minMatch[1], 10);
	return total > 0 ? total : undefined;
}

function parseServingsCount(raw: string | undefined): number | undefined {
	if (!raw) return undefined;
	const match = raw.match(/\d+/);
	return match ? parseInt(match[0], 10) : undefined;
}

export async function parseRecipe(raw: PaprikaRecipeRaw): Promise<ParseResult> {
	const photos: ImportedPhoto[] = [];

	async function processPhotoData(base64: string | undefined): Promise<string | null> {
		if (!base64) return null;
		try {
			const mime = sniffMimeType(base64);
			const photo = await decodePhoto(base64, mime);
			// Dedupe: only add if not already in the list
			if (!photos.some((p) => p.id === photo.id)) {
				photos.push(photo);
			}
			return photo.id;
		} catch {
			return null;
		}
	}

	const primaryId = await processPhotoData(raw.photo_large ?? raw.photo_data);
	const photoIds = primaryId ? [primaryId] : [];

	const recipe: Recipe = {
		id: crypto.randomUUID(),
		paprikaUid: raw.uid ?? `paprika-${raw.name}-${raw.created ?? Date.now()}`,
		title: raw.name,
		description: raw.description ? cleanText(raw.description) : undefined,
		ingredients: parseIngredients(raw.ingredients),
		steps: parseSteps(raw.directions),
		notes: raw.notes ? cleanText(raw.notes) : undefined,
		times: {
			prepMins: parseMinutes(raw.prep_time),
			cookMins: parseMinutes(raw.cook_time),
			totalMins: parseMinutes(raw.total_time),
			raw: {
				prep: raw.prep_time,
				cook: raw.cook_time,
				total: raw.total_time,
			},
		},
		servings: {
			count: parseServingsCount(raw.servings),
			raw: raw.servings ?? '',
		},
		rating: typeof raw.rating === 'number' ? Math.min(5, Math.max(0, raw.rating)) : undefined,
		source: {
			name: raw.source,
			url: raw.source_url,
		},
		tags: raw.categories ?? [],
		difficulty: raw.difficulty,
		nutritionRaw: raw.nutritional_info ? cleanText(raw.nutritional_info) : undefined,
		photoIds,
		importedAt: raw.created ?? new Date().toISOString(),
		createdAt: new Date().toISOString(),
	};

	return { recipe, photos };
}
