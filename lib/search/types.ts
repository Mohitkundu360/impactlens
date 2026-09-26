import { z } from "zod";

export const StructuredFilterSchema = z.object({
  keywords: z.array(z.string()).default([]),
  activity: z.string().nullable().default(null),
  phase: z.enum(["BEFORE", "DURING", "AFTER", "UNSPECIFIED"]).nullable().default(null),
  mediaType: z.enum(["IMAGE", "VIDEO"]).nullable().default(null),
  dateFrom: z.string().nullable().default(null), // ISO date
  dateTo: z.string().nullable().default(null)
});

export type StructuredFilter = z.infer<typeof StructuredFilterSchema>;

export const EMPTY_FILTER: StructuredFilter = {
  keywords: [],
  activity: null,
  phase: null,
  mediaType: null,
  dateFrom: null,
  dateTo: null
};
