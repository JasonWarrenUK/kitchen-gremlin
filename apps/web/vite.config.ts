import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		{
			// Required headers for OPFS + SharedArrayBuffer access in browser workers
			name: 'coop-coep',
			configureServer(server) {
				server.middlewares.use((_req, res, next) => {
					res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
					res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
					next();
				});
			},
		},
	],
	optimizeDeps: {
		exclude: ['@sqlite.org/sqlite-wasm'],
	},
});
