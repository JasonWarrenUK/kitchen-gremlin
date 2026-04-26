import { runImport, type ImportProgress, type ImportDone } from './run-import.js';

type IncomingMessage = {
	type: 'start';
	file: File;
	dbWorkerPort: MessagePort;
};

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
	if (event.data.type !== 'start') return;

	const { file, dbWorkerPort } = event.data;

	// Wrap the MessagePort as a Worker-compatible object so DbClient can use it
	const dbWorkerProxy = {
		postMessage: (msg: unknown) => dbWorkerPort.postMessage(msg),
		addEventListener: dbWorkerPort.addEventListener.bind(dbWorkerPort),
		removeEventListener: dbWorkerPort.removeEventListener.bind(dbWorkerPort),
	} as unknown as Worker;

	try {
		const result = await runImport(file, dbWorkerProxy, (progress: ImportProgress) => {
			self.postMessage(progress);
		});
		const done: ImportDone = result;
		self.postMessage(done);
	} catch (e) {
		self.postMessage({
			type: 'done',
			imported: 0,
			skipped: 0,
			failed: 1,
			errors: [{ entryName: file.name, message: e instanceof Error ? e.message : String(e) }],
		} satisfies ImportDone);
	}
});
