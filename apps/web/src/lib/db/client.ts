import type { Recipe } from '@kitchen-gremlin/schema';
import type { RecipeSummary, SearchOptions } from './worker.js';

export type { RecipeSummary, SearchOptions };

type Resolve<T> = (value: T) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reject = (reason: any) => void;

interface Pending {
	resolve: Resolve<unknown>;
	reject: Reject;
}

/**
 * Typed proxy to the DB Worker.
 * Each call gets a unique requestId so concurrent calls resolve correctly.
 */
export class DbClient {
	private worker: Worker;
	private pending = new Map<string, Pending>();
	private seq = 0;

	constructor(worker: Worker) {
		this.worker = worker;
		this.worker.addEventListener('message', this.handleMessage.bind(this));
	}

	private nextId() {
		return String(++this.seq);
	}

	private handleMessage(event: MessageEvent) {
		const { requestId, ...rest } = event.data as { requestId?: string; [k: string]: unknown };
		if (requestId && this.pending.has(requestId)) {
			const { resolve, reject } = this.pending.get(requestId)!;
			this.pending.delete(requestId);
			if ('error' in rest) {
				reject(new Error(String(rest.error)));
			} else {
				resolve(rest);
			}
		}
	}

	private call<T>(message: object): Promise<T> {
		return new Promise((resolve, reject) => {
			const requestId = this.nextId();
			this.pending.set(requestId, { resolve: resolve as Resolve<unknown>, reject });
			this.worker.postMessage({ ...message, requestId });
		});
	}

	async init(): Promise<void> {
		await this.call({ type: 'init' });
	}

	async importRecipe(recipe: Recipe): Promise<'inserted' | 'skipped'> {
		const result = await this.call<{ result: 'inserted' | 'skipped' }>({
			type: 'import',
			recipe,
		});
		return result.result;
	}

	async searchRecipes(opts: SearchOptions): Promise<RecipeSummary[]> {
		const result = await this.call<{ results: RecipeSummary[] }>({ type: 'search', opts });
		return result.results;
	}

	async getRecipe(id: string): Promise<Recipe | null> {
		const result = await this.call<{ recipe: Recipe | null }>({ type: 'getRecipe', id });
		return result.recipe;
	}

	async countRecipes(): Promise<number> {
		const result = await this.call<{ count: number }>({ type: 'countRecipes' });
		return result.count;
	}
}
