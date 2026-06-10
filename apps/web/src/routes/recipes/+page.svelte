<script lang="ts">
	import { onMount } from 'svelte';
	import { getDb } from '$lib/db/index.js';
	import { buildFtsQuery } from '$lib/search/query.js';
	import { OpfsPhotoStore } from '$lib/photos/opfs-store.js';
	import type { RecipeSummary, SearchFilters, TagCount } from '$lib/db/client.js';

	let query = $state('');
	let results = $state<RecipeSummary[]>([]);
	let loading = $state(true);
	let photoUrls = $state<Map<string, string>>(new Map());

	// Faceted filters (SPEC §4.2)
	let showFilters = $state(false);
	let allTags = $state<TagCount[]>([]);
	let selectedTags = $state<string[]>([]);
	let minRating = $state(0);
	let maxTotalMins = $state(0); // 0 = any
	let includeIngredients = $state('');
	let excludeIngredients = $state('');

	const photoStore = new OpfsPhotoStore();

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function splitTerms(input: string): string[] {
		return input
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	function buildFilters(): SearchFilters {
		const filters: SearchFilters = {};
		if (selectedTags.length > 0) filters.tags = [...selectedTags];
		if (minRating > 0) filters.minRating = minRating;
		if (maxTotalMins > 0) filters.maxTotalMins = maxTotalMins;
		const include = splitTerms(includeIngredients);
		if (include.length > 0) filters.includeIngredients = include;
		const exclude = splitTerms(excludeIngredients);
		if (exclude.length > 0) filters.excludeIngredients = exclude;
		return filters;
	}

	const activeFilterCount = $derived(
		selectedTags.length +
			(minRating > 0 ? 1 : 0) +
			(maxTotalMins > 0 ? 1 : 0) +
			splitTerms(includeIngredients).length +
			splitTerms(excludeIngredients).length,
	);

	function toggleTag(tag: string) {
		selectedTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];
		search(query);
	}

	function clearFilters() {
		selectedTags = [];
		minRating = 0;
		maxTotalMins = 0;
		includeIngredients = '';
		excludeIngredients = '';
		search(query);
	}

	async function search(q: string) {
		const db = await getDb();
		const ftsQuery = q.trim() ? buildFtsQuery(q) : '';
		const newResults = await db.searchRecipes({ query: ftsQuery, limit: 100, filters: buildFilters() });
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
		const db = await getDb();
		allTags = await db.listTags();
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
		<button class="btn-filter" onclick={() => (showFilters = !showFilters)} aria-expanded={showFilters}>
			Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
		</button>
	</div>

	{#if showFilters}
		<div class="filters">
			<div class="filter-row">
				<label class="filter-field">
					<span class="filter-label">Min rating</span>
					<select bind:value={minRating} onchange={() => search(query)}>
						<option value={0}>Any</option>
						<option value={3}>3+ stars</option>
						<option value={4}>4+ stars</option>
						<option value={5}>5 stars</option>
					</select>
				</label>
				<label class="filter-field">
					<span class="filter-label">Max total time</span>
					<select bind:value={maxTotalMins} onchange={() => search(query)}>
						<option value={0}>Any</option>
						<option value={15}>15 min</option>
						<option value={30}>30 min</option>
						<option value={45}>45 min</option>
						<option value={60}>1 hour</option>
						<option value={90}>1½ hours</option>
					</select>
				</label>
				<label class="filter-field">
					<span class="filter-label">Must use (comma-separated)</span>
					<input
						type="text"
						bind:value={includeIngredients}
						onchange={() => search(query)}
						placeholder="e.g. leeks"
					/>
				</label>
				<label class="filter-field">
					<span class="filter-label">Without (comma-separated)</span>
					<input
						type="text"
						bind:value={excludeIngredients}
						onchange={() => search(query)}
						placeholder="e.g. mushrooms"
					/>
				</label>
			</div>

			{#if allTags.length > 0}
				<div class="tag-filter" role="group" aria-label="Filter by tag">
					{#each allTags as { tag, count } (tag)}
						<button
							class="tag-chip"
							class:tag-chip--active={selectedTags.includes(tag)}
							onclick={() => toggleTag(tag)}
							aria-pressed={selectedTags.includes(tag)}
						>
							{tag} <span class="tag-count">{count}</span>
						</button>
					{/each}
				</div>
			{/if}

			{#if activeFilterCount > 0}
				<button class="btn-clear" onclick={clearFilters}>Clear filters</button>
			{/if}
		</div>
	{/if}

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

	.search-bar {
		align-items: center;
		display: flex;
		gap: var(--size-3);
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

	.btn-filter,
	.btn-clear {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		cursor: pointer;
		font-size: var(--font-size-1);
		padding: var(--size-2) var(--size-4);
		white-space: nowrap;
	}

	.btn-clear {
		align-self: flex-start;
	}

	.filters {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		display: flex;
		flex-direction: column;
		gap: var(--size-4);
		padding: var(--size-4);
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4);
	}

	.filter-field {
		display: flex;
		flex-direction: column;
		gap: var(--size-1);
	}

	.filter-field select,
	.filter-field input {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		font-size: var(--font-size-1);
		padding: var(--size-2) var(--size-3);
	}

	.filter-label {
		color: var(--color-text-muted);
		font-size: var(--font-size-0);
		font-weight: var(--font-weight-6);
	}

	.tag-filter {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-2);
		max-height: 10rem;
		overflow-y: auto;
	}

	.tag-chip {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-round);
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--font-size-0);
		padding: var(--size-1) var(--size-3);
	}

	.tag-chip--active {
		background-color: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
	}

	.tag-count {
		opacity: 0.7;
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
