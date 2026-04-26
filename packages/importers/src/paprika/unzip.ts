import { unzipSync } from 'fflate';

export interface ZipEntry {
	/** Opaque filename key from the zip (may be mojibake — treat as identity only) */
	name: string;
	data: Uint8Array;
}

/**
 * Extract all `.paprikarecipe` entries from a zip archive.
 * Returns them as an array so callers can iterate in any order.
 */
export function extractEntries(zipBytes: Uint8Array): ZipEntry[] {
	const files = unzipSync(zipBytes);
	return Object.entries(files)
		.filter(([name]) => name.toLowerCase().endsWith('.paprikarecipe'))
		.map(([name, data]) => ({ name, data }));
}
