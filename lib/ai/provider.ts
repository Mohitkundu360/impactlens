import { z } from "zod";

/**
 * Three-level AI output model, enforced at the schema level:
 *  - observedSummary: only what's visibly present in the media
 *  - interpretationSummary: the model's inference about what's happening
 *  - there is deliberately NO field for a quantitative/scientific "impact claim" —
 *    that data simply has nowhere to go in this schema.
 */
export const AnalysisResultSchema = z.object({
  description: z.string().min(1),
  activity: z.string().nullable(),
  environment: z.string().nullable(),
  objects: z.array(z.string()).default([]),
  observations: z.array(z.string()).default([]),
  sustainabilityCategories: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).nullable(),
  observedSummary: z.string().min(1),
  interpretationSummary: z.string().min(1)
});

export type AnalysisResultData = z.infer<typeof AnalysisResultSchema>;

export interface AnalysisProviderResult {
  data: AnalysisResultData;
  raw: unknown;
  modelProvider: "GEMINI" | "CLOUDINARY_AI_VISION";
  modelName: string;
  modelVersion?: string;
  generatedAt: Date;
}

/**
 * Every analysis backend (Gemini today, Cloudinary AI Vision optionally)
 * implements this. The worker and API routes only ever depend on this
 * interface, never on a specific provider's SDK.
 */
export interface AnalysisProvider {
  analyzeImage(imageUrl: string, context: AnalysisContext): Promise<AnalysisProviderResult>;
}

export interface AnalysisContext {
  projectName: string;
  projectType: string;
  phase: "BEFORE" | "DURING" | "AFTER" | "UNSPECIFIED";
  locationText?: string | null;
}
