<script lang="ts">
	import { onMount } from 'svelte';
	import { getDb } from '$lib/db/index.js';
	import { buildFtsQuery } from '$lib/search/query.js';
	import { OpfsPhotoStore } from '$lib/photos/opfs-store.js';
	import type { RecipeSummary } from '$lib/db/client.js';

	let query = $state('');
	let results = $state<RecipeSummary[]>([]);
	let loading = $state(true);
	let photoUrls = $state<Map<string, string>>(new Map());

	const photoStore = new OpfsPhotoStore();

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	async function search(q: string) {
		const db = await getDb();
		const ftsQuery = q.trim() ? buildFtsQuery(q) : '';
		const newResults = await db.searchRecipes({ query: ftsQuery, limit: 100 });
		results = newResults;

		// Load photo URLs for visible results
		const newUrls = new Map<string, string>();
		for (const r of newResults) {
			if (r.primaryPhotoId) {
				try {
					const url = await photoStore.getUrl(r.primaryPhotoId);
					newUrls.set(r.id, url);
				} catch {
					// Photo not found — ignore
				}
			}
		}
		// Revoke old object URLs
		for (const url of photoUrls.values()) URL.revokeObjectURL(url);
		photoUrls = newUrls;
	}

	function onInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => search(query), 300);
	}

	onMount(async () => {
		await search('');
		loading = false;
	});
</script>

<svelte:head>
	<title>Recipes — Kitchen Gremlin</title>
</svelte:head>

<div class="page">
	<h1>Recipes</h1>

	<div class="search-bar">
		<input
			bind:value={query}
			oninput={onInput}
			type="search"
			placeholder="Search recipes, ingredients…"
			class="search-input"
			aria-label="Search recipes"
		/>
	</div>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if results.length === 0}
		<p class="muted">
			{query ? 'No recipes found.' : 'No recipes yet. Import your Paprika archive to get started.'}
		</p>
		{#if !query}
			<a href="/import" class="btn-primary">Import recipes</a>
		{/if}
	{:else}
		<p class="count">{results.length} recipe{results.length !== 1 ? 's' : ''}</p>
		<ul class="recipe-grid">
			{#each results as recipe (recipe.id)}
				<li>
					<a href="/recipes/{recipe.id}" class="recipe-card">
						{#if photoUrls.has(recipe.id)}
							<img
								src={photoUrls.get(recipe.id)}
								alt={recipe.title}
								class="recipe-thumb"
								loading="lazy"
							/>
						{:else}
							<div class="recipe-thumb recipe-thumb--placeholder" aria-hidden="true"></div>
						{/if}
						<div class="recipe-info">
							<span class="recipe-title">{recipe.title}</span>
							{#if recipe.sourceName}
								<span class="recipe-source">{recipe.sourceName}</span>
							{/if}
							{#if recipe.rating}
								<span class="recipe-rating" aria-label="{recipe.rating} out of 5 stars">
									{'★'.repeat(Math.round(recipe.rating))}{'☆'.repeat(5 - Math.round(recipe.rating))}
								</span>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--size-5);
	}

	h1 {
		font-size: var(--font-size-6);
		margin: 0;
	}

	.search-input {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		font-size: var(--font-size-2);
		padding: var(--size-3) var(--size-4);
		width: 100%;
		max-width: 36rem;
	}

	.search-input:focus {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.muted {
		color: var(--color-text-muted);
	}

	.count {
		color: var(--color-text-muted);
		font-size: var(--font-size-1);
		margin: 0;
	}

	.recipe-grid {
		display: grid;
		gap: var(--size-4);
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.recipe-card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-card);
		color: var(--color-text);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		text-decoration: none;
		transition: box-shadow 0.15s ease;
	}

	.recipe-card:hover {
		box-shadow: var(--shadow-3);
	}

	.recipe-thumb {
		aspect-ratio: 4 / 3;
		object-fit: cover;
		width: 100%;
	}

	.recipe-thumb--placeholder {
		background-color: var(--color-bg-subtle);
	}

	.recipe-info {
		display: flex;
		flex-direction: column;
		gap: var(--size-1);
		padding: var(--size-3) var(--size-4);
	}

	.recipe-title {
		font-size: var(--font-size-2);
		font-weight: var(--font-weight-6);
		line-height: var(--font-lineheight-2);
	}

	.recipe-source {
		color: var(--color-text-muted);
		font-size: var(--font-size-0);
	}

	.recipe-rating {
		color: var(--color-accent);
		font-size: var(--font-size-0);
		letter-spacing: 0.05em;
	}

	.btn-primary {
		background-color: var(--color-accent);
		border-radius: var(--radius-2);
		color: var(--color-accent-text);
		font-weight: var(--font-weight-6);
		padding: var(--size-3) var(--size-6);
		text-decoration: none;
	}
</style>
