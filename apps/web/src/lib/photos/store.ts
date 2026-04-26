export interface PhotoStore {
	/** Store a blob and return its stable photoId (content hash). */
	put(blob: Blob): Promise<string>;
	/** Get an object URL for a photoId. Caller must revoke when done. */
	getUrl(photoId: string): Promise<string>;
	/** Delete a photo. No-op if not found. */
	delete(photoId: string): Promise<void>;
}
