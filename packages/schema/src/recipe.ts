import { z } from 'zod';

export const IngredientSchema = z.object({
	text: z.string(),
	group: z.string().optional(),
});

export const TimesSchema = z.object({
	prepMins: z.number().int().nonnegative().optional(),
	cookMins: z.number().int().nonnegative().optional(),
	totalMins: z.number().int().nonnegative().optional(),
	raw: z.object({
		prep: z.string().optional(),
		cook: z.string().optional(),
		total: z.string().optional(),
	}),
});

export const ServingsSchema = z.object({
	count: z.number().int().positive().optional(),
	raw: z.string(),
});

export const SourceSchema = z.object({
	name: z.string().optional(),
	url: z.string().optional(),
});

export const RecipeSchema = z.object({
	id: z.string().uuid(),
	paprikaUid: z.string(),
	title: z.string().min(1),
	description: z.string().optional(),
	ingredients: z.array(IngredientSchema),
	steps: z.array(z.string()),
	notes: z.string().optional(),
	times: TimesSchema,
	servings: ServingsSchema,
	rating: z.number().min(0).max(5).optional(),
	source: SourceSchema,
	tags: z.array(z.string()),
	difficulty: z.string().optional(),
	nutritionRaw: z.string().optional(),
	photoIds: z.array(z.string()),
	importedAt: z.string().datetime({ offset: true }),
	createdAt: z.string().datetime({ offset: true }),
});

export type Ingredient = z.infer<typeof IngredientSchema>;
export type Times = z.infer<typeof TimesSchema>;
export type Servings = z.infer<typeof ServingsSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
