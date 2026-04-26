<script lang="ts">
	import type { ImportProgress, ImportDone } from '$lib/import/run-import.js';

	type ImportState =
		| { phase: 'idle' }
		| { phase: 'importing'; done: number; total: number; failed: number }
		| { phase: 'done'; summary: ImportDone };

	let importState: ImportState = $state({ phase: 'idle' });
	let fileInput: HTMLInputElement | null = $state(null);

	async function handleFile(file: File) {
		if (!file.name.endsWith('.paprikarecipes')) {
			alert('Please choose a .paprikarecipes file exported from Paprika.');
			return;
		}

		importState = { phase: 'importing', done: 0, total: 0, failed: 0 };

		// Lazily create the DB Worker so it's not loaded until needed
		const DbWorkerModule = await import('$lib/db/worker.ts?worker');
		const dbWorker = new DbWorkerModule.default();

		// Initialise DB Worker
		await new Promise<void>((resolve, reject) => {
			const id = crypto.randomUUID();
			dbWorker.addEventListener('message', function handler(e: MessageEvent) {
				if (e.data?.requestId === id) {
					dbWorker.removeEventListener('message', handler);
					if (e.data.error) reject(new Error(e.data.error));
					else resolve();
				}
			});
			dbWorker.postMessage({ requestId: id, type: 'init' });
		});

		// Create a MessageChannel so the Import Worker can talk to the DB Worker
		const channel = new MessageChannel();
		dbWorker.addEventListener('message', (e: MessageEvent) => {
			channel.port1.postMessage(e.data);
		});
		channel.port1.addEventListener('message', (e: MessageEvent) => {
			dbWorker.postMessage(e.data);
		});
		channel.port1.start();

		const ImportWorkerModule = await import('$lib/import/worker.ts?worker');
		const importWorker = new ImportWorkerModule.default();

		importWorker.addEventListener('message', (e: MessageEvent<ImportProgress | ImportDone>) => {
			const msg = e.data;
			if (msg.type === 'progress') {
				importState = { phase: 'importing', done: msg.done, total: msg.total, failed: msg.failed };
			} else if (msg.type === 'done') {
				importState = { phase: 'done', summary: msg };
				importWorker.terminate();
				dbWorker.terminate();
				channel.port1.close();
				channel.port2.close();
			}
		});

		importWorker.postMessage({ type: 'start', file, dbWorkerPort: channel.port2 }, [channel.port2]);
	}

	function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
	}

	function reset() {
		importState = { phase: 'idle' };
		if (fileInput) fileInput.value = '';
	}

	const progressPct = $derived.by(() => {
		const s = importState;
		if (s.phase !== 'importing' || s.total === 0) return 0;
		return Math.round((s.done / s.total) * 100);
	});
</script>

<svelte:head>
	<title>Import — Kitchen Gremlin</title>
</svelte:head>

<div class="page">
	<h1>Import Paprika archive</h1>

	{#if importState.phase === 'idle'}
		<p class="hint">
			Export your library from Paprika (File → Export → Paprika Format) then choose the
			<code>.paprikarecipes</code> file below.
		</p>
		<label class="file-label">
			<input
				bind:this={fileInput}
				type="file"
				accept=".paprikarecipes"
				onchange={onFileChange}
				class="file-input"
			/>
			<span class="file-btn">Choose .paprikarecipes file</span>
		</label>
	{:else if importState.phase === 'importing'}
		<p class="status">
			Importing… {importState.done}{importState.total > 0 ? ` / ${importState.total}` : ''} recipes
			{#if importState.failed > 0}
				<span class="error-count">({importState.failed} failed)</span>
			{/if}
		</p>
		<div
			class="progress-bar"
			role="progressbar"
			aria-valuenow={progressPct}
			aria-valuemax={100}
		>
			<div class="progress-fill" style="width: {progressPct}%"></div>
		</div>
	{:else if importState.phase === 'done'}
		<div class="summary">
			<h2>Import complete</h2>
			<ul class="stats">
				<li><strong>{importState.summary.imported}</strong> imported</li>
				<li><strong>{importState.summary.skipped}</strong> already in library (skipped)</li>
				{#if importState.summary.failed > 0}
					<li class="stat-error"><strong>{importState.summary.failed}</strong> failed</li>
				{/if}
			</ul>
			{#if importState.summary.errors.length > 0}
				<details class="error-details">
					<summary>Failed entries</summary>
					<ul>
						{#each importState.summary.errors as err}
							<li><code>{err.entryName}</code>: {err.message}</li>
						{/each}
					</ul>
				</details>
			{/if}
			<div class="actions">
				<a href="/recipes" class="btn-primary">Browse recipes</a>
				<button onclick={reset} class="btn-secondary">Import another file</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 36rem;
	}

	h1 {
		font-size: var(--font-size-6);
		margin-block-end: var(--size-4);
	}

	.hint {
		color: var(--color-text-muted);
		margin-block-end: var(--size-6);
	}

	code {
		background-color: var(--color-bg-subtle);
		border-radius: var(--radius-1);
		font-size: 0.9em;
		padding-inline: var(--size-1);
	}

	.file-label {
		display: inline-block;
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		overflow: hidden;
	}

	.file-btn {
		background-color: var(--color-accent);
		border-radius: var(--radius-2);
		color: var(--color-accent-text);
		cursor: pointer;
		display: inline-block;
		font-weight: var(--font-weight-6);
		padding: var(--size-3) var(--size-6);
	}

	.file-btn:hover {
		background-color: var(--color-accent-hover);
	}

	.status {
		margin-block-end: var(--size-4);
	}

	.error-count {
		color: var(--color-danger);
	}

	.progress-bar {
		background-color: var(--color-bg-subtle);
		border-radius: var(--radius-round);
		height: var(--size-4);
		overflow: hidden;
		width: 100%;
	}

	.progress-fill {
		background-color: var(--color-accent);
		height: 100%;
		transition: width 0.2s ease;
	}

	.summary {
		display: flex;
		flex-direction: column;
		gap: var(--size-4);
	}

	h2 {
		font-size: var(--font-size-5);
		margin: 0;
	}

	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		gap: var(--size-6);
		font-size: var(--font-size-3);
	}

	.stat-error {
		color: var(--color-danger);
	}

	.error-details {
		background-color: var(--color-bg-subtle);
		border-radius: var(--radius-2);
		padding: var(--size-3) var(--size-4);
	}

	.error-details ul {
		margin: var(--size-2) 0 0;
		padding-inline-start: var(--size-4);
		font-size: var(--font-size-1);
	}

	.actions {
		display: flex;
		gap: var(--size-4);
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-secondary {
		border-radius: var(--radius-2);
		font-size: var(--font-size-2);
		font-weight: var(--font-weight-6);
		padding: var(--size-3) var(--size-6);
		text-decoration: none;
		cursor: pointer;
		border: none;
	}

	.btn-primary {
		background-color: var(--color-accent);
		color: var(--color-accent-text);
	}

	.btn-secondary {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}
</style>
