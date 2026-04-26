<svelte:head>
	<title>Kitchen Gremlin</title>
</svelte:head>

<section class="hero">
	<h1>Kitchen Gremlin</h1>
	<p class="tagline">Your recipe library, found again.</p>
	<div class="actions">
		<a href="/import" class="btn-primary">Import Paprika archive</a>
		<a href="/recipes" class="btn-secondary">Browse recipes</a>
	</div>
</section>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--size-6);
		min-height: 60dvh;
		text-align: center;
	}

	h1 {
		font-size: var(--font-size-8);
		font-weight: var(--font-weight-9);
		margin: 0;
	}

	.tagline {
		color: var(--color-text-muted);
		font-size: var(--font-size-4);
		margin: 0;
	}

	.actions {
		display: flex;
		gap: var(--size-4);
		flex-wrap: wrap;
		justify-content: center;
	}

	.btn-primary,
	.btn-secondary {
		border-radius: var(--radius-2);
		font-size: var(--font-size-2);
		font-weight: var(--font-weight-6);
		padding: var(--size-3) var(--size-6);
		text-decoration: none;
	}

	.btn-primary {
		background-color: var(--color-accent);
		color: var(--color-accent-text);
	}

	.btn-primary:hover {
		background-color: var(--color-accent-hover);
		color: var(--color-accent-text);
	}

	.btn-secondary {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.btn-secondary:hover {
		background-color: var(--color-border);
		color: var(--color-text);
	}
</style>
