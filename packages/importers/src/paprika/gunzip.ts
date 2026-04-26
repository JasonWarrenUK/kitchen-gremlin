import { gunzipSync } from 'fflate';

/** Decompress a gzipped byte array and return the raw bytes. */
export function gunzipEntry(compressed: Uint8Array): Uint8Array {
	return gunzipSync(compressed);
}
