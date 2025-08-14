import { z } from 'zod';

export const CategoryRuleSchema = z.object({
  regex: z.string().optional(),
  calendarId: z.string().optional(),
});

export type CategoryRule = z.infer<typeof CategoryRuleSchema>;
