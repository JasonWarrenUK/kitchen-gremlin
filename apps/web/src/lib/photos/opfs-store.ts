import type { PhotoStore } from './store.js';

async function sha256Hex(blob: Blob): Promise<string> {
	const buffer = await blob.arrayBuffer();
	const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

async function getPhotosDir(): Promise<FileSystemDirectoryHandle> {
	const root = await navigator.storage.getDirectory();
	return root.getDirectoryHandle('photos', { create: true });
}

export class OpfsPhotoStore implements PhotoStore {
	async put(blob: Blob): Promise<string> {
		const photoId = await sha256Hex(blob);
		const dir = await getPhotosDir();
		const fileHandle = await dir.getFileHandle(photoId, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(blob);
		await writable.close();
		return photoId;
	}

	async getUrl(photoId: string): Promise<string> {
		const dir = await getPhotosDir();
		const fileHandle = await dir.getFileHandle(photoId);
		const file = await fileHandle.getFile();
		return URL.createObjectURL(file);
	}

	async delete(photoId: string): Promise<void> {
		try {
			const dir = await getPhotosDir();
			await dir.removeEntry(photoId);
		} catch {
			// Not found — ignore
		}
	}
}
