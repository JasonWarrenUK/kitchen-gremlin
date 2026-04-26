/** Raw shape of a Paprika recipe JSON (mirrors PAPRIKA.md §4). Every field except `name` is optional. */
export interface PaprikaRecipeRaw {
	uid?: string;
	hash?: string;
	name: string;
	description?: string;
	ingredients?: string;
	directions?: string;
	notes?: string;
	nutritional_info?: string;
	prep_time?: string;
	cook_time?: string;
	total_time?: string;
	servings?: string;
	difficulty?: string;
	rating?: number;
	source?: string;
	source_url?: string;
	image_url?: string;
	photo?: string;
	photo_hash?: string;
	photo_data?: string;
	photo_large?: string;
	photos?: unknown[];
	categories?: string[];
	created?: string;
}
