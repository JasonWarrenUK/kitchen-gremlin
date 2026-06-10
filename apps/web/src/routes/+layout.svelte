<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<nav>
		<a href="/" class="brand">Kitchen Gremlin</a>
		<ul>
			<li><a href="/recipes">Recipes</a></li>
			<li><a href="/plan">Plan</a></li>
			<li><a href="/shopping">Shopping</a></li>
			<li><a href="/import">Import</a></li>
			<li><a href="/settings">Settings</a></li>
		</ul>
	</nav>
</header>

<main>
	{@render children()}
</main>

<style>
	header {
		background-color: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		padding-inline: var(--size-6);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	nav {
		align-items: center;
		display: flex;
		gap: var(--size-6);
		max-width: 72rem;
		margin-inline: auto;
		min-height: var(--size-12);
	}

	.brand {
		color: var(--color-text);
		font-size: var(--font-size-3);
		font-weight: var(--font-weight-7);
		text-decoration: none;
	}

	ul {
		display: flex;
		gap: var(--size-4);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	main {
		max-width: 72rem;
		margin-inline: auto;
		padding: var(--size-6);
	}
</style>
