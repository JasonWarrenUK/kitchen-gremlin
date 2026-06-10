<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getDb } from '$lib/db/index.js';
	import type { Recipe } from '@kitchen-gremlin/schema';

	let recipe: Recipe | null = $state(null);
	let loading = $state(true);
	let notFound = $state(false);

	// Phases: mise en place checklist → steps → done
	let phase = $state<'mise' | 'steps' | 'done'>('mise');
	let stepIndex = $state(0);
	let prepped = $state<boolean[]>([]);
	let cookLogged = $state(false);

	interface RunningTimer {
		id: string;
		label: string;
		endsAt: number;
		remainingSecs: number;
		done: boolean;
	}
	let timers = $state<RunningTimer[]>([]);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	let wakeLock: WakeLockSentinel | null = null;

	const currentStep = $derived.by(() => {
		const r = recipe;
		return r ? (r.steps[stepIndex] ?? '') : '';
	});

	/** Durations mentioned in the current step, e.g. "simmer for 20 minutes". */
	const stepDurations = $derived.by(() => {
		const found: { label: string; secs: number }[] = [];
		const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
		let m: RegExpExecArray | null;
		while ((m = re.exec(currentStep)) !== null) {
			const value = parseFloat(m[1]!);
			const unit = m[2]!.toLowerCase();
			let secs: number;
			if (unit.startsWith('h')) secs = value * 3600;
			else if (unit.startsWith('m')) secs = value * 60;
			else secs = value;
			found.push({ label: m[0]!, secs: Math.round(secs) });
		}
		return found;
	});

	function startTimer(label: string, secs: number) {
		timers = [
			...timers,
			{
				id: crypto.randomUUID(),
				label: `Step ${stepIndex + 1}: ${label}`,
				endsAt: Date.now() + secs * 1000,
				remainingSecs: secs,
				done: false,
			},
		];
		if (!timerInterval) {
			timerInterval = setInterval(tick, 500);
		}
	}

	function tick() {
		let anyRunning = false;
		timers = timers.map((t) => {
			if (t.done) return t;
			const remaining = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
			if (remaining === 0 && !t.done) {
				beep();
				return { ...t, remainingSecs: 0, done: true };
			}
			anyRunning = true;
			return { ...t, remainingSecs: remaining };
		});
		if (!anyRunning && timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function dismissTimer(id: string) {
		timers = timers.filter((t) => t.id !== id);
	}

	function beep() {
		try {
			const ctx = new AudioContext();
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.frequency.value = 880;
			gain.gain.value = 0.3;
			osc.connect(gain).connect(ctx.destination);
			osc.start();
			osc.stop(ctx.currentTime + 0.8);
			osc.onended = () => ctx.close();
		} catch {
			// Audio unavailable — the visual "done" state still shows
		}
	}

	function formatRemaining(secs: number): string {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
	}

	function next() {
		if (!recipe) return;
		if (stepIndex < recipe.steps.length - 1) stepIndex += 1;
		else phase = 'done';
	}

	function prev() {
		if (phase === 'done') {
			phase = 'steps';
			return;
		}
		if (stepIndex > 0) stepIndex -= 1;
		else phase = 'mise';
	}

	function onKeydown(e: KeyboardEvent) {
		if (phase !== 'steps') return;
		if (e.key === 'ArrowRight' || e.key === ' ') {
			e.preventDefault();
			next();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prev();
		}
	}

	async function acquireWakeLock() {
		try {
			if ('wakeLock' in navigator) {
				wakeLock = await navigator.wakeLock.request('screen');
			}
		} catch {
			// Wake lock denied (battery saver etc.) — cooking mode still works
		}
	}

	async function finishCooking(logIt: boolean) {
		if (logIt && recipe) {
			const db = await getDb();
			await db.logCook(recipe.id);
			cookLogged = true;
		}
		goto(`/recipes/${recipe?.id ?? ''}`);
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
			prepped = r.ingredients.map(() => false);
			loading = false;
		})();

		acquireWakeLock();
		const onVisibility = () => {
			if (document.visibilityState === 'visible') acquireWakeLock();
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			wakeLock?.release().catch(() => {});
			if (timerInterval) clearInterval(timerInterval);
		};
	});
</script>

<svelte:head>
	<title>Cooking: {recipe?.title ?? '…'} — Kitchen Gremlin</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

{#if loading}
	<p class="muted">Loading…</p>
{:else if notFound || !recipe}
	<p>Recipe not found. <a href="/recipes">Back to recipes</a></p>
{:else}
	<div class="cook">
		<header class="cook-header">
			<a href="/recipes/{recipe.id}" class="exit">← Exit</a>
			<h1>{recipe.title}</h1>
		</header>

		{#if phase === 'mise'}
			<section class="mise">
				<h2>Mise en place</h2>
				<p class="muted">Tick ingredients as you get them ready.</p>
				<ul class="mise-list">
					{#each recipe.ingredients as ing, i}
						<li class:done={prepped[i]}>
							<label>
								<input type="checkbox" bind:checked={prepped[i]} />
								<span>{ing.text}</span>
							</label>
						</li>
					{/each}
				</ul>
				<button class="btn btn--primary btn--big" onclick={() => (phase = 'steps')}>
					Start cooking →
				</button>
			</section>
		{:else if phase === 'steps'}
			<section class="step-view">
				<p class="step-counter">Step {stepIndex + 1} of {recipe.steps.length}</p>
				<p class="step-text">{currentStep}</p>

				{#if stepDurations.length > 0}
					<div class="timer-starts">
						{#each stepDurations as d}
							<button class="btn" onclick={() => startTimer(d.label, d.secs)}>
								⏱ Start {d.label} timer
							</button>
						{/each}
					</div>
				{/if}

				<div class="step-nav">
					<button class="btn btn--big" onclick={prev}>← Back</button>
					<button class="btn btn--primary btn--big" onclick={next}>
						{stepIndex < recipe.steps.length - 1 ? 'Next →' : 'Finish'}
					</button>
				</div>
			</section>
		{:else}
			<section class="done-view">
				<h2>All done! 🎉</h2>
				<p class="muted">Log this cook so search and the planner know about it?</p>
				<div class="step-nav">
					<button class="btn btn--big" onclick={() => finishCooking(false)}>Skip</button>
					<button class="btn btn--primary btn--big" onclick={() => finishCooking(true)} disabled={cookLogged}>
						{cookLogged ? 'Logged ✓' : 'Mark as cooked'}
					</button>
				</div>
			</section>
		{/if}

		{#if timers.length > 0}
			<aside class="timers" aria-live="polite">
				{#each timers as t (t.id)}
					<div class="timer" class:timer--done={t.done}>
						<span class="timer-label">{t.label}</span>
						<span class="timer-time">{t.done ? 'Done!' : formatRemaining(t.remainingSecs)}</span>
						<button class="timer-dismiss" onclick={() => dismissTimer(t.id)} aria-label="Dismiss timer">
							✕
						</button>
					</div>
				{/each}
			</aside>
		{/if}
	</div>
{/if}

<style>
	.muted {
		color: var(--color-text-muted);
	}

	.cook {
		display: flex;
		flex-direction: column;
		gap: var(--size-6);
		max-width: 52rem;
		padding-block-end: 8rem; /* room for the floating timer tray */
	}

	.cook-header {
		display: flex;
		flex-direction: column;
		gap: var(--size-2);
	}

	.exit {
		color: var(--color-text-muted);
		font-size: var(--font-size-1);
		text-decoration: none;
	}

	h1 {
		font-size: var(--font-size-5);
		margin: 0;
	}

	h2 {
		font-size: var(--font-size-4);
		margin: 0;
	}

	.mise {
		display: flex;
		flex-direction: column;
		gap: var(--size-4);
	}

	.mise-list {
		display: flex;
		flex-direction: column;
		gap: var(--size-3);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.mise-list label {
		align-items: baseline;
		cursor: pointer;
		display: flex;
		font-size: var(--font-size-3);
		gap: var(--size-3);
	}

	.mise-list input {
		transform: scale(1.4);
	}

	.mise-list li.done span {
		color: var(--color-text-muted);
		text-decoration: line-through;
	}

	.step-view,
	.done-view {
		display: flex;
		flex-direction: column;
		gap: var(--size-6);
	}

	.step-counter {
		color: var(--color-text-muted);
		font-size: var(--font-size-2);
		font-weight: var(--font-weight-6);
		letter-spacing: 0.05em;
		margin: 0;
		text-transform: uppercase;
	}

	/* Kitchen-tablet readable: big text, generous line height */
	.step-text {
		font-size: var(--font-size-5);
		line-height: var(--font-lineheight-3);
		margin: 0;
		min-height: 8rem;
	}

	.timer-starts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-3);
	}

	.step-nav {
		display: flex;
		gap: var(--size-4);
	}

	.btn {
		background-color: var(--color-bg-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2);
		color: var(--color-text);
		cursor: pointer;
		font-size: var(--font-size-2);
		font-weight: var(--font-weight-6);
		padding: var(--size-3) var(--size-5);
	}

	.btn--primary {
		background-color: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-text);
	}

	.btn--big {
		font-size: var(--font-size-3);
		min-height: var(--size-9);
		padding-inline: var(--size-7);
	}

	.timers {
		bottom: var(--size-4);
		display: flex;
		flex-direction: column;
		gap: var(--size-2);
		left: 50%;
		max-width: 28rem;
		position: fixed;
		transform: translateX(-50%);
		width: calc(100% - var(--size-8));
		z-index: 20;
	}

	.timer {
		align-items: center;
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-3);
		display: flex;
		gap: var(--size-3);
		padding: var(--size-3) var(--size-4);
	}

	.timer--done {
		border-color: var(--color-accent);
		outline: 2px solid var(--color-accent);
	}

	.timer-label {
		flex: 1;
		font-size: var(--font-size-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.timer-time {
		font-size: var(--font-size-3);
		font-variant-numeric: tabular-nums;
		font-weight: var(--font-weight-7);
	}

	.timer-dismiss {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--font-size-2);
		padding: var(--size-1);
	}
</style>
