<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getDb } from '$lib/db/index.js';
	import { OpfsPhotoStore } from '$lib/photos/opfs-store.js';
	import { viewPrefs } from '$lib/prefs.svelte.js';
	import { toDateKey } from '$lib/plan/dates.js';
	import type { Recipe } from '@kitchen-gremlin/schema';

	let recipe: Recipe | null = $state(null);
	let heroUrl: string | null = $state(null);
	let loading = $state(true);
	let notFound = $state(false);
	let lastCooked: string | null = $state(null);

	// Action feedback / dialogs
	let shoppingAdded = $state(false);
	let showPlanForm = $state(false);
	let planDate = $state(toDateKey(new Date()));
	let planSlot = $state('dinner');
	let planAdded = $state(false);
	let cookLogged = $state(false);

	// Ephemeral tick-state for checklist mode (per visit, not persisted)
	let tickedSteps = $state<boolean[]>([]);

	const photoStore = new OpfsPhotoStore();

	async function addToShoppingList() {
		const r = recipe;
		if (!r) return;
		const db = await getDb();
		await db.addShoppingItems(
			r.ingredients.map((ing) => ({ id: crypto.randomUUID(), text: ing.text, recipeId: r.id })),
		);
		shoppingAdded = true;
		setTimeout(() => (shoppingAdded = false), 2500);
	}

	async function addToPlan() {
		const r = recipe;
		if (!r) return;
		const db = await getDb();
		await db.addPlanEntry({
			id: crypto.randomUUID(),
			date: planDate,
			slot: planSlot,
			recipeId: r.id,
			note: null,
		});
		showPlanForm = false;
		planAdded = true;
		setTimeout(() => (planAdded = false), 2500);
	}

	async function markCooked() {
		const r = recipe;
		if (!r) return;
		const db = await getDb();
		await db.logCook(r.id);
		lastCooked = new Date().toISOString();
		cookLogged = true;
		setTimeout(() => (cookLogged = false), 2500);
	}

	function formatLastCooked(iso: string): string {
		return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(
			new Date(iso),
		);
	}

	onMount(() => {
		const id = $page.params['id'];
		if (!id) {
			notFound = true;
			loading = false;
			return;
		}

		(async () => {
			const db = await getDb();
			const r = await db.getRecipe(id);
			if (!r) {
				notFound = true;
				loading = false;
				return;
			}
			recipe = r;
			tickedSteps = r.steps.map(() => false);
			lastCooked = await db.getLastCooked(r.id);
			const firstPhotoId = r.photoIds[0];
			if (firstPhotoId) {
				try {
					heroUrl = await photoStore.getUrl(firstPhotoId);
				} catch {
					// Photo not in OPFS — skip
				}
			}
			loading = false;
		})();

		return () => {
			if (heroUrl) URL.revokeObjectURL(heroUrl);
		};
	});

	function groupIngredients(ingredients: Recipe['ingredients']) {
		const groups: { label: string | null; items: string[] }[] = [];
		let current: { label: string | null; items: string[] } = { label: null, items: [] };
		for (const ing of ingredients) {
			const group = ing.group ?? null;
			if (group !== current.label) {
				if (current.items.length > 0) groups.push(current);
				current = { label: group, items: [] };
			}
			current.items.push(ing.text);
		}
		if (current.items.length > 0) groups.push(current);
		return groups;
	}

	const ingredientGroups = $derived.by(() => {
		const r = recipe;
		return r ? groupIngredients(r.ingredients) : [];
	});

	function ratingStars(rating: number) {
		const full = Math.round(rating);
		return '★'.repeat(full) + '☆'.repeat(5 - full);
	}
</script>

<svelte:head>
	<title>{recipe?.title ?? 'Recipe'} — Kitchen Gremlin</title>
</svelte:head>

{#if loading}
	<p class="muted">Loading…</p>
{:else if notFound || !recipe}
	<p>Recipe not found. <a href="/recipes">Back to recipes</a></p>
{:else}
	<article class="recipe">
		{#if heroUrl}
			<div class="hero">
				<img src={heroUrl} alt={recipe.title} class="hero-img" />
			</div>
		{/if}

		<header class="recipe-header">
			<h1>{recipe.title}</h1>

			<div class="meta">
				{#if recipe.rating}
					<span class="rating" aria-label="{recipe.rating} out of 5">
						{ratingStars(recipe.rating)}
					</span>
				{/if}
				{#if recipe.source.url}
					<a href={recipe.source.url} target="_blank" rel="noopener noreferrer" class="source-link">
						{recipe.source.name ?? recipe.source.url}
					</a>
				{:else if recipe.source.name}
					<span class="source-name">{recipe.source.name}</span>
				{/if}
			</div>

			{#if recipe.description}
				<p class="description">{recipe.description}</p>
			{/if}

			<div class="facts">
				{#if recipe.times.prepMins}
					<div class="fact">
						<span class="fact-label">Prep</span>
						<span>{recipe.times.raw.prep ?? `${recipe.times.prepMins} min`}</span>
					</div>
				{/if}
				{#if recipe.times.cookMins}
					<div class="fact">
						<span class="fact-label">Cook</span>
						<span>{recipe.times.raw.cook ?? `${recipe.times.cookMins} min`}</span>
					</div>
				{/if}
				{#if recipe.servings.raw}
					<div class="fact">
						<span class="fact-label">Serves</span>
						<span>{recipe.servings.raw}</span>
					</div>
				{/if}
				{#if recipe.difficulty}
					<div class="fact">
						<span class="fact-label">Difficulty</span>
						<span>{recipe.difficulty}</span>
					</div>
				{/if}
			</div>

			{#if recipe.tags.length > 0}
				<ul class="tags">
					{#each recipe.tags as tag}
						<li class="tag">{tag}</li>
					{/each}
				</ul>
			{/if}

			<div class="actions">
				<a href="/recipes/{recipe.id}/cook" class="btn btn--primary">Cooking mode</a>
				<button class="btn" onclick={() => (showPlanForm = !showPlanForm)}>
					{planAdded ? 'Added to plan ✓' : 'Add to plan'}
				</button>
				<button class="btn" onclick={addToShoppingList}>
					{shoppingAdded ? 'Added to list ✓' : 'Add to shopping list'}
				</button>
				<button class="btn" onclick={markCooked}>
					{cookLogged ? 'Logged ✓' : 'I cooked this'}
				</button>
			</div>

			{#if showPlanForm}
				<form
					class="plan-form"
					onsubmit={(e) => {
						e.preventDefault();
						addToPlan();
					}}
				>
					<label>
						<span class="form-label">Date</span>
						<input type="date" bind:value={planDate} required />
					</label>
					<label>
						<span class="form-label">Meal</span>
						<select bind:value={planSlot}>
							<option value="breakfast">Breakfast</option>
							<option value="lunch">Lunch</option>
							<option value="dinner">Dinner</option>
						</select>
					</label>
					<button type="submit" class="btn btn--primary">Add</button>
				</form>
			{/if}

			{#if lastCooked}
				<p class="last-cooked">Last cooked {formatLastCooked(lastCooked)}</p>
			{/if}
		</header>

		<div
			class="body"
			class:relaxed={viewPrefs.current.relaxedLineHeight}
			style:font-size="{viewPrefs.current.textScale}em"
		>
			<section class="ingredients">
				<h2>Ingredients</h2>
				{#each ingredientGroups as group}
					{#if group.label}
						<h3 class="group-label">{group.label}</h3>
					{/if}
					<ul>
						{#each group.items as item}
							<li>{item}</li>
						{/each}
					</ul>
				{/each}
			</section>

			<section class="steps">
				<h2>Method</h2>
				{#if viewPrefs.current.stepsAsChecklist}
					<ul class="step-checklist">
						{#each recipe.steps as step, i}
							<li class:done={tickedSteps[i]}>
								<label>
									<input type="checkbox" bind:checked={tickedSteps[i]} />
									<span>{step}</span>
								</label>
							</li>
						{/each}
					</ul>
				{:else}
					<ol>
						{#each recipe.steps as step}
							<li>{step}</li>
						{/each}
					</ol>
				{/if}
			</section>

			{#if recipe.notes}
				<section class="notes">
					<h2>Notes</h2>
					<p>{recipe.notes}</p>
				</section>
			{/if}
		</div>
	</article>
{/if}

<style>
	.muted {
		color: var(--color-text-muted);
	}

	.recipe {
		display: flex;
		flex-direction: column;
		gap: var(--size-6);
		max-width: 52rem;
	}

	.hero-img {
		border-radius: var(--radius-card);
		max-height: 28rem;
		object-fit: cover;
		width: 100%;
	}

	.recipe-header {
		display: flex;
		flex-direction: column;
		gap: var(--size-4);
	}

	h1 {
		font-size: var(--font-size-7);
		line-height: var(--font-lineheight-1);
		margin: 0;
	}

	h2 {
		font-size: var(--font-size-4);
		margin-block-end: var(--size-2);
	}

	h3.group-label {
		color: var(--color-text-muted);
		font-size: var(--font-size-1);
		font-weight: var(--font-weight-6);
		margin-block: var(--size-4) var(--size-1);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.meta {
		align-items: center;
		display: flex;
		gap: var(--size-4);
		flex-wrap: wrap;
	}

	.rating {
		color: var(--color-accent);
		letter-spacing: 0.05em;
	}

	.source-link,
	.source-name {
		color: var(--color-text-muted);
		font-size: var(--font-size-1);
	}

	.description {
		color: var(--color-text-muted);
		font-size: var(--font-size-2);
		margin: 0;
	}

	.facts {
		display: flex;
		gap: var(--size-6);
		flex-wrap: wrap;
	}

	.fact {
		display: flex;
		flex-direction: column;
		gap: var(--size-1);
	}

	.fact-label {
		color: var(--color-text-muted);
		font-size: var(--font-size-0);
		font-weight: var(--font-weight-6);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-2);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tag {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-round);
		color: var(--color-text-muted);
		font-size: var(--font-size-0);
		padding: var(--size-1) var(--size-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-3);
	}

	.btn {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		cursor: pointer;
		font-size: var(--font-size-1);
		font-weight: var(--font-weight-6);
		padding: var(--size-2) var(--size-4);
		text-decoration: none;
	}

	.btn--primary {
		background-color: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
	}

	.plan-form {
		align-items: flex-end;
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4);
		padding: var(--size-4);
	}

	.plan-form label {
		display: flex;
		flex-direction: column;
		gap: var(--size-1);
	}

	.plan-form input,
	.plan-form select {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		padding: var(--size-2) var(--size-3);
	}

	.form-label {
		color: var(--color-text-muted);
		font-size: var(--font-size-0);
		font-weight: var(--font-weight-6);
	}

	.last-cooked {
		color: var(--color-text-muted);
		font-size: var(--font-size-1);
		margin: 0;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--size-8);
	}

	.body.relaxed :is(li, p) {
		line-height: var(--font-lineheight-5);
	}

	.step-checklist {
		display: flex;
		flex-direction: column;
		gap: var(--size-3);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.step-checklist label {
		align-items: baseline;
		cursor: pointer;
		display: flex;
		gap: var(--size-3);
	}

	.step-checklist li.done span {
		color: var(--color-text-muted);
		text-decoration: line-through;
	}

	.ingredients ul,
	.steps ol {
		display: flex;
		flex-direction: column;
		gap: var(--size-2);
		margin: 0;
		padding-inline-start: var(--size-6);
	}

	.steps li {
		line-height: var(--font-lineheight-3);
		padding-inline-start: var(--size-2);
	}

	.notes p {
		color: var(--color-text-muted);
		line-height: var(--font-lineheight-4);
		margin: 0;
		white-space: pre-wrap;
	}
</style>
