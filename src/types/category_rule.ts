import { z } from 'zod';

export const CategoryRuleSchema = z.object({
  type: z.enum(['STARTS_WITH', 'ENDS_WITH', 'REGEX', 'CONTAINS', 'EQUALS']),
  content: z.string(),
});

export type CategoryRule = z.infer<typeof CategoryRuleSchema>;
