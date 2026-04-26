export interface ImportedPhoto {
	/** SHA-256 hex digest — used as the photoId / OPFS filename */
	id: string;
	blob: Blob;
	mimeType: string;
}

/** Decode a base64 photo string → Blob and compute its SHA-256 content hash. */
export async function decodePhoto(base64: string, mimeType = 'image/jpeg'): Promise<ImportedPhoto> {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const id = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	const blob = new Blob([bytes], { type: mimeType });
	return { id, blob, mimeType };
}

/** Sniff JPEG / PNG / WebP magic bytes; fall back to image/jpeg. */
export function sniffMimeType(base64: string): string {
	const head = base64.slice(0, 16);
	const decoded = atob(head + '=='.slice(0, (4 - (head.length % 4)) % 4));
	const bytes = decoded.split('').map((c) => c.charCodeAt(0));
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
	if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
	if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
	return 'image/jpeg';
}
