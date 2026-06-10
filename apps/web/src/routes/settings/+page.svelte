<script lang="ts">
	import { getDb } from '$lib/db/index.js';
	import { viewPrefs, TEXT_SCALES } from '$lib/prefs.svelte.js';

	let exporting = $state(false);
	let exportError = $state('');

	async function exportLibrary() {
		exporting = true;
		exportError = '';
		try {
			const db = await getDb();
			const recipes = await db.exportLibrary();
			const payload = {
				app: 'kitchen-gremlin',
				schemaVersion: 1,
				exportedAt: new Date().toISOString(),
				recipeCount: recipes.length,
				recipes,
			};
			const blob = new Blob([JSON.stringify(payload, null, '\t')], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `kitchen-gremlin-export-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			exportError = e instanceof Error ? e.message : String(e);
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head>
	<title>Settings — Kitchen Gremlin</title>
</svelte:head>

<div class="page">
	<h1>Settings</h1>

	<section>
		<h2>Reading preferences</h2>
		<p class="muted">
			These only change how recipes look on <em>this</em> device — the shared library stays the same
			for everyone.
		</p>

		<div class="field">
			<span class="field-label">Text size</span>
			<div class="scale-options" role="group" aria-label="Text size">
				{#each TEXT_SCALES as scale (scale.value)}
					<button
						class="btn"
						class:btn--active={viewPrefs.current.textScale === scale.value}
						onclick={() => viewPrefs.update({ textScale: scale.value })}
						aria-pressed={viewPrefs.current.textScale === scale.value}
					>
						{scale.label}
					</button>
				{/each}
			</div>
		</div>

		<label class="toggle">
			<input
				type="checkbox"
				checked={viewPrefs.current.relaxedLineHeight}
				onchange={(e) => viewPrefs.update({ relaxedLineHeight: e.currentTarget.checked })}
			/>
			<span>Relaxed line spacing</span>
		</label>

		<label class="toggle">
			<input
				type="checkbox"
				checked={viewPrefs.current.stepsAsChecklist}
				onchange={(e) => viewPrefs.update({ stepsAsChecklist: e.currentTarget.checked })}
			/>
			<span>Show method steps as a tickable checklist (one action per line)</span>
		</label>
	</section>

	<section>
		<h2>Your data</h2>
		<p class="muted">
			Export your whole library as portable JSON — every recipe, with ingredients, steps, notes,
			tags, and ratings. No data hostage. Photos stay on this device for now; the export references
			them by id.
		</p>
		<button class="btn btn--primary" onclick={exportLibrary} disabled={exporting}>
			{exporting ? 'Exporting…' : 'Export library (JSON)'}
		</button>
		{#if exportError}
			<p class="error" role="alert">Export failed: {exportError}</p>
		{/if}
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--size-7);
		max-width: 40rem;
	}

	h1 {
		font-size: var(--font-size-6);
		margin: 0;
	}

	h2 {
		font-size: var(--font-size-4);
		margin: 0 0 var(--size-2);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--size-4);
	}

	.muted {
		color: var(--color-text-muted);
		margin: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--size-2);
	}

	.field-label {
		font-size: var(--font-size-1);
		font-weight: var(--font-weight-6);
	}

	.scale-options {
		display: flex;
		gap: var(--size-2);
	}

	.btn {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		cursor: pointer;
		font-size: var(--font-size-1);
		padding: var(--size-2) var(--size-4);
	}

	.btn--active {
		background-color: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
	}

	.btn--primary {
		background-color: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
		font-weight: var(--font-weight-6);
		align-self: flex-start;
	}

	.toggle {
		align-items: baseline;
		cursor: pointer;
		display: flex;
		gap: var(--size-3);
	}

	.error {
		color: var(--color-danger);
		margin: 0;
	}
</style>
