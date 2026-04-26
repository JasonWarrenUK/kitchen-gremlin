import type { PaprikaRecipeRaw } from '../../src/paprika/types.js';

/** Minimal valid recipe — only required field is `name`. */
export const minimal: PaprikaRecipeRaw = {
	uid: 'test-uid-001',
	name: 'Simple Soup',
};

/** Full recipe with all optional fields populated. */
export const full: PaprikaRecipeRaw = {
	uid: 'test-uid-002',
	name: 'Butter Chickpeas’', // smart quote in title
	description: 'A comforting weeknight dish.',
	ingredients: 'For the sauce:\n50g butter\n1 onion, diced\n\n400g chickpeas\nsalt to taste',
	directions: 'Heat the butter in a pan.\nAdd the onion and cook until soft.\nAdd chickpeas and heat through.',
	notes: 'Great with rice or naan.',
	nutritional_info: 'Approx 350 kcal per serving',
	prep_time: '10 mins',
	cook_time: '20 mins',
	total_time: '30 mins',
	servings: '4',
	difficulty: 'Easy',
	rating: 4,
	source: 'Family Kitchen',
	source_url: 'https://example.com/butter-chickpeas',
	categories: ['Quick', 'Vegetarian'],
	created: '2023-06-15T12:00:00Z',
};

/** Recipe with malformed time strings. */
export const badTimes: PaprikaRecipeRaw = {
	uid: 'test-uid-003',
	name: 'Mystery Casserole',
	prep_time: 'overnight',
	cook_time: 'until done',
	total_time: '',
};

/** Recipe with sub-headers in ingredients and directions. */
export const withSubHeaders: PaprikaRecipeRaw = {
	uid: 'test-uid-004',
	name: 'Layered Lasagne',
	ingredients: 'For the meat sauce:\n500g minced beef\n1 onion\n\nFor the béchamel:\n50g butter\n50g flour\n500ml milk',
	directions: 'Brown the beef.\nAdd onion.\nMake the béchamel: melt butter then add flour.',
};

/** Minimal base64 1×1 white JPEG for photo tests. */
// prettier-ignore
export const tinyJpegBase64 =
	'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
