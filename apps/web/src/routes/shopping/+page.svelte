<script lang="ts">
	import { onMount } from 'svelte';
	import { consolidate, formatAmounts, type ShoppingLine } from '@kitchen-gremlin/shopping';
	import { getDb } from '$lib/db/index.js';
	import type { ShoppingItemRow } from '$lib/db/client.js';

	let items = $state<ShoppingItemRow[]>([]);
	let loading = $state(true);
	let newItemText = $state('');

	const lines = $derived(
		consolidate(items.map((i) => ({ id: i.id, text: i.text, checked: i.checked }))),
	);
	const remaining = $derived(lines.filter((l) => !l.checked).length);

	async function reload() {
		const db = await getDb();
		items = await db.listShoppingItems();
	}

	async function toggleLine(line: ShoppingLine) {
		const db = await getDb();
		await db.setShoppingChecked(line.itemIds, !line.checked);
		await reload();
	}

	async function removeLine(line: ShoppingLine) {
		const db = await getDb();
		await db.removeShoppingItems(line.itemIds);
		await reload();
	}

	async function addItem() {
		const text = newItemText.trim();
		if (!text) return;
		const db = await getDb();
		await db.addShoppingItems([{ id: crypto.randomUUID(), text, recipeId: null }]);
		newItemText = '';
		await reload();
	}

	async function clearChecked() {
		const db = await getDb();
		await db.clearShopping(true);
		await reload();
	}

	async function clearAll() {
		if (!confirm('Clear the whole shopping list?')) return;
		const db = await getDb();
		await db.clearShopping(false);
		await reload();
	}

	onMount(async () => {
		await reload();
		loading = false;
	});
</script>

<svelte:head>
	<title>Shopping list — Kitchen Gremlin</title>
</svelte:head>

<div class="page">
	<header class="head">
		<h1>Shopping list</h1>
		{#if lines.length > 0}
			<p class="muted">{remaining} of {lines.length} to get</p>
		{/if}
	</header>

	<form
		class="add-form"
		onsubmit={(e) => {
			e.preventDefault();
			addItem();
		}}
	>
		<input type="text" bind:value={newItemText} placeholder="Add an item…" aria-label="Add an item" />
		<button type="submit" class="btn btn--primary">Add</button>
	</form>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if lines.length === 0}
		<p class="muted">
			Nothing to buy. Add ingredients from a recipe, the meal plan, or type an item above.
		</p>
	{:else}
		<ul class="list">
			{#each lines as line (line.key)}
				<li class="line" class:line--checked={line.checked}>
					<label class="line-main">
						<input type="checkbox" checked={line.checked} onchange={() => toggleLine(line)} />
						<span class="line-name">{line.name}</span>
						{#if formatAmounts(line)}
							<span class="line-amount">{formatAmounts(line)}</span>
						{/if}
					</label>
					{#if line.parts.length > 1}
						<details class="line-parts">
							<summary>{line.parts.length} items</summary>
							<ul>
								{#each line.parts as part}
									<li>{part}</li>
								{/each}
							</ul>
						</details>
					{/if}
					<button class="line-remove" onclick={() => removeLine(line)} aria-label="Remove {line.name}">
						✕
					</button>
				</li>
			{/each}
		</ul>

		<div class="actions">
			<button class="btn" onclick={clearChecked}>Clear ticked</button>
			<button class="btn btn--danger" onclick={clearAll}>Clear all</button>
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--size-5);
		max-width: 36rem;
	}

	.head {
		align-items: baseline;
		display: flex;
		gap: var(--size-4);
	}

	h1 {
		font-size: var(--font-size-6);
		margin: 0;
	}

	.muted {
		color: var(--color-text-muted);
		margin: 0;
	}

	.add-form {
		display: flex;
		gap: var(--size-2);
	}

	.add-form input {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		flex: 1;
		font-size: var(--font-size-2);
		padding: var(--size-2) var(--size-3);
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

	.btn--primary {
		background-color: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
		font-weight: var(--font-weight-6);
	}

	.btn--danger {
		color: var(--color-danger);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: var(--size-2);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.line {
		align-items: center;
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		display: flex;
		gap: var(--size-3);
		padding: var(--size-3) var(--size-4);
	}

	.line--checked .line-name,
	.line--checked .line-amount {
		color: var(--color-text-muted);
		text-decoration: line-through;
	}

	.line-main {
		align-items: baseline;
		cursor: pointer;
		display: flex;
		flex: 1;
		gap: var(--size-3);
	}

	.line-main input {
		transform: scale(1.3);
	}

	.line-name {
		font-size: var(--font-size-2);
	}

	.line-amount {
		color: var(--color-text-muted);
		font-size: var(--font-size-1);
		font-variant-numeric: tabular-nums;
	}

	.line-parts {
		color: var(--color-text-muted);
		font-size: var(--font-size-0);
	}

	.line-parts summary {
		cursor: pointer;
	}

	.line-parts ul {
		margin: var(--size-1) 0 0;
		padding-inline-start: var(--size-5);
	}

	.line-remove {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--font-size-1);
		padding: var(--size-1);
	}

	.actions {
		display: flex;
		gap: var(--size-3);
	}
</style>
