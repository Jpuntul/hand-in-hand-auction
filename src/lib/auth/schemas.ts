import { z } from "zod";

export const profileFieldsSchema = z.object({
	display_name: z
		.string()
		.trim()
		.min(1, "Display name is required")
		.max(100, "Display name too long"),
	phone: z
		.string()
		.trim()
		.max(50, "Phone number too long")
		.optional()
		.nullable()
		.transform((val) => (val && val.length > 0 ? val : null)),
});

export type ProfileFieldsInput = z.input<typeof profileFieldsSchema>;
export type ProfileFieldsOutput = z.infer<typeof profileFieldsSchema>;
