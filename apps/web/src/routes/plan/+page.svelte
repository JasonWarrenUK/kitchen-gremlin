<script lang="ts">
	import { onMount } from 'svelte';
	import { getDb } from '$lib/db/index.js';
	import { buildFtsQuery } from '$lib/search/query.js';
	import { startOfWeek, addDays, weekDateKeys, toDateKey, formatDay, formatWeekRange } from '$lib/plan/dates.js';
	import type { PlanEntry, RecipeSummary } from '$lib/db/client.js';

	const SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

	let weekStart = $state(startOfWeek(new Date()));
	let entries = $state<PlanEntry[]>([]);
	let loading = $state(true);

	// Add-entry overlay state
	let adding = $state<{ date: string; slot: string } | null>(null);
	let recipeQuery = $state('');
	let recipeResults = $state<RecipeSummary[]>([]);
	let noteText = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	let shoppingFeedback = $state('');

	const dateKeys = $derived(weekDateKeys(weekStart));
	const todayKey = toDateKey(new Date());

	function entriesFor(date: string, slot: string): PlanEntry[] {
		return entries.filter((e) => e.date === date && e.slot === slot);
	}

	async function loadWeek() {
		const db = await getDb();
		const keys = weekDateKeys(weekStart);
		entries = await db.getPlan(keys[0]!, keys[6]!);
	}

	function goWeek(offset: number) {
		weekStart = offset === 0 ? startOfWeek(new Date()) : addDays(weekStart, offset * 7);
		loadWeek();
	}

	function openAdd(date: string, slot: string) {
		adding = { date, slot };
		recipeQuery = '';
		recipeResults = [];
		noteText = '';
		searchRecipes('');
	}

	async function searchRecipes(q: string) {
		const db = await getDb();
		const ftsQuery = q.trim() ? buildFtsQuery(q) : '';
		recipeResults = await db.searchRecipes({ query: ftsQuery, limit: 20 });
	}

	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => searchRecipes(recipeQuery), 250);
	}

	async function pickRecipe(recipe: RecipeSummary) {
		if (!adding) return;
		const db = await getDb();
		await db.addPlanEntry({
			id: crypto.randomUUID(),
			date: adding.date,
			slot: adding.slot,
			recipeId: recipe.id,
			note: null,
		});
		adding = null;
		await loadWeek();
	}

	async function addNote() {
		if (!adding || !noteText.trim()) return;
		const db = await getDb();
		await db.addPlanEntry({
			id: crypto.randomUUID(),
			date: adding.date,
			slot: adding.slot,
			recipeId: null,
			note: noteText.trim(),
		});
		adding = null;
		await loadWeek();
	}

	async function removeEntry(id: string) {
		const db = await getDb();
		await db.removePlanEntry(id);
		await loadWeek();
	}

	async function addWeekToShoppingList() {
		const db = await getDb();
		const recipeIds = [...new Set(entries.map((e) => e.recipeId).filter((id): id is string => !!id))];
		let count = 0;
		for (const id of recipeIds) {
			const recipe = await db.getRecipe(id);
			if (!recipe) continue;
			await db.addShoppingItems(
				recipe.ingredients.map((ing) => ({ id: crypto.randomUUID(), text: ing.text, recipeId: id })),
			);
			count += recipe.ingredients.length;
		}
		shoppingFeedback = count > 0 ? `Added ${count} ingredients to the shopping list` : 'Nothing planned to shop for';
		setTimeout(() => (shoppingFeedback = ''), 3000);
	}

	onMount(async () => {
		await loadWeek();
		loading = false;
	});
</script>

<svelte:head>
	<title>Meal plan — Kitchen Gremlin</title>
</svelte:head>

<div class="page">
	<header class="plan-header">
		<h1>Meal plan</h1>
		<div class="week-nav">
			<button class="btn" onclick={() => goWeek(-1)} aria-label="Previous week">←</button>
			<button class="btn" onclick={() => goWeek(0)}>This week</button>
			<button class="btn" onclick={() => goWeek(1)} aria-label="Next week">→</button>
			<span class="week-range">{formatWeekRange(weekStart)}</span>
		</div>
		<button class="btn btn--primary" onclick={addWeekToShoppingList}>Add week to shopping list</button>
		{#if shoppingFeedback}
			<p class="feedback" role="status">{shoppingFeedback}</p>
		{/if}
	</header>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else}
		<div class="week">
			{#each dateKeys as date (date)}
				<section class="day" class:day--today={date === todayKey}>
					<h2 class="day-title">{formatDay(date)}</h2>
					{#each SLOTS as slot}
						<div class="slot">
							<div class="slot-head">
								<span class="slot-name">{slot}</span>
								<button class="slot-add" onclick={() => openAdd(date, slot)} aria-label="Add to {slot} on {date}">
									+
								</button>
							</div>
							{#each entriesFor(date, slot) as entry (entry.id)}
								<div class="entry">
									{#if entry.recipeId}
										<a href="/recipes/{entry.recipeId}" class="entry-title">{entry.recipeTitle}</a>
									{:else}
										<span class="entry-title entry-title--note">{entry.note}</span>
									{/if}
									<button class="entry-remove" onclick={() => removeEntry(entry.id)} aria-label="Remove entry">
										✕
									</button>
								</div>
							{/each}
						</div>
					{/each}
				</section>
			{/each}
		</div>
	{/if}
</div>

{#if adding}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="Add to plan">
		<div class="dialog">
			<header class="dialog-head">
				<h2>Add to {adding.slot}, {formatDay(adding.date)}</h2>
				<button class="entry-remove" onclick={() => (adding = null)} aria-label="Close">✕</button>
			</header>

			<input
				type="search"
				bind:value={recipeQuery}
				oninput={onSearchInput}
				placeholder="Search recipes…"
				class="dialog-search"
				aria-label="Search recipes to plan"
			/>

			<ul class="dialog-results">
				{#each recipeResults as recipe (recipe.id)}
					<li>
						<button class="dialog-result" onclick={() => pickRecipe(recipe)}>
							{recipe.title}
							{#if recipe.rating}
								<span class="result-rating">{'★'.repeat(Math.round(recipe.rating))}</span>
							{/if}
						</button>
					</li>
				{:else}
					<li class="muted">No recipes found.</li>
				{/each}
			</ul>

			<form
				class="note-form"
				onsubmit={(e) => {
					e.preventDefault();
					addNote();
				}}
			>
				<input type="text" bind:value={noteText} placeholder="…or a note (leftovers, eating out)" />
				<button type="submit" class="btn">Add note</button>
			</form>
		</div>
	</div>
{/if}

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

	.muted {
		color: var(--color-text-muted);
	}

	.plan-header {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4);
	}

	.week-nav {
		align-items: center;
		display: flex;
		gap: var(--size-2);
	}

	.week-range {
		color: var(--color-text-muted);
		font-size: var(--font-size-1);
		margin-inline-start: var(--size-2);
	}

	.feedback {
		color: var(--color-accent);
		font-size: var(--font-size-1);
		margin: 0;
		width: 100%;
	}

	.btn {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		cursor: pointer;
		font-size: var(--font-size-1);
		padding: var(--size-2) var(--size-3);
	}

	.btn--primary {
		background-color: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
		font-weight: var(--font-weight-6);
	}

	.week {
		display: grid;
		gap: var(--size-3);
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}

	.day {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		display: flex;
		flex-direction: column;
		gap: var(--size-3);
		padding: var(--size-3);
	}

	.day--today {
		border-color: var(--color-accent);
	}

	.day-title {
		font-size: var(--font-size-1);
		font-weight: var(--font-weight-7);
		margin: 0;
	}

	.slot-head {
		align-items: center;
		display: flex;
		justify-content: space-between;
	}

	.slot-name {
		color: var(--color-text-muted);
		font-size: var(--font-size-0);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.slot-add {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-round);
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--font-size-1);
		line-height: 1;
		padding: var(--size-1) var(--size-2);
	}

	.slot-add:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.entry {
		align-items: center;
		background-color: var(--color-bg-subtle);
		border-radius: var(--radius-2);
		display: flex;
		gap: var(--size-2);
		justify-content: space-between;
		margin-block-start: var(--size-2);
		padding: var(--size-2) var(--size-3);
	}

	.entry-title {
		color: var(--color-text);
		font-size: var(--font-size-1);
		text-decoration: none;
	}

	.entry-title--note {
		color: var(--color-text-muted);
		font-style: italic;
	}

	.entry-remove {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--font-size-1);
		padding: 0;
	}

	.overlay {
		align-items: center;
		background-color: rgb(0 0 0 / 0.4);
		display: flex;
		inset: 0;
		justify-content: center;
		padding: var(--size-4);
		position: fixed;
		z-index: 30;
	}

	.dialog {
		background-color: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-4);
		display: flex;
		flex-direction: column;
		gap: var(--size-4);
		max-height: 80dvh;
		max-width: 28rem;
		padding: var(--size-5);
		width: 100%;
	}

	.dialog-head {
		align-items: center;
		display: flex;
		justify-content: space-between;
	}

	.dialog-head h2 {
		font-size: var(--font-size-3);
		margin: 0;
	}

	.dialog-search {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		padding: var(--size-2) var(--size-3);
	}

	.dialog-results {
		display: flex;
		flex-direction: column;
		gap: var(--size-1);
		list-style: none;
		margin: 0;
		overflow-y: auto;
		padding: 0;
	}

	.dialog-result {
		background: none;
		border: none;
		border-radius: var(--radius-2);
		color: var(--color-text);
		cursor: pointer;
		display: flex;
		gap: var(--size-2);
		justify-content: space-between;
		padding: var(--size-2) var(--size-3);
		text-align: start;
		width: 100%;
	}

	.dialog-result:hover {
		background-color: var(--color-bg-subtle);
	}

	.result-rating {
		color: var(--color-accent);
		font-size: var(--font-size-0);
	}

	.note-form {
		display: flex;
		gap: var(--size-2);
	}

	.note-form input {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		flex: 1;
		padding: var(--size-2) var(--size-3);
	}
</style>
