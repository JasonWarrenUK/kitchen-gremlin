import { DbClient } from './client.js';

let _client: DbClient | null = null;
let _initPromise: Promise<void> | null = null;

export async function getDb(): Promise<DbClient> {
	if (_client && _initPromise) {
		await _initPromise;
		return _client;
	}
	const DbWorker = (await import('./worker.ts?worker')).default;
	const worker = new DbWorker();
	_client = new DbClient(worker);
	_initPromise = _client.init();
	await _initPromise;
	return _client;
}
