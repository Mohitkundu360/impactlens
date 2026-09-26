import { db } from "@/lib/db";
import { AnalysisProviderResult } from "@/lib/ai/provider";
import { buildTagNames } from "@/lib/tagUtils";

export { normalizeTagName, buildTagNames } from "@/lib/tagUtils";

/**
 * Persists an AnalysisProviderResult against a MediaAsset:
 *  - upserts the 1:1 AnalysisResult row (with full provenance)
 *  - creates/links AI-sourced Tag rows
 *  - denormalizes activity onto MediaAsset.activityLabel for fast filtering
 *
 * Does NOT change MediaAsset.status — the caller (worker) owns that
 * transition so it can also log the ProcessingJob outcome atomically.
 */
export async function persistAnalysisResult(mediaAssetId: string, result: AnalysisProviderResult) {
  const { data } = result;

  await db.analysisResult.upsert({
    where: { mediaAssetId },
    create: {
      mediaAssetId,
      description: data.description,
      activity: data.activity,
      environment: data.environment,
      objects: data.objects,
      observations: data.observations,
      sustainabilityCategories: data.sustainabilityCategories,
      confidence: data.confidence,
      observedSummary: data.observedSummary,
      interpretationSummary: data.interpretationSummary,
      rawModelResponse: result.raw as any,
      modelProvider: result.modelProvider,
      modelName: result.modelName,
      modelVersion: result.modelVersion,
      generatedAt: result.generatedAt
    },
    update: {
      description: data.description,
      activity: data.activity,
      environment: data.environment,
      objects: data.objects,
      observations: data.observations,
      sustainabilityCategories: data.sustainabilityCategories,
      confidence: data.confidence,
      observedSummary: data.observedSummary,
      interpretationSummary: data.interpretationSummary,
      rawModelResponse: result.raw as any,
      modelProvider: result.modelProvider,
      modelName: result.modelName,
      modelVersion: result.modelVersion,
      generatedAt: result.generatedAt
    }
  });

  const tagNames = buildTagNames(data);
  for (const name of tagNames) {
    const tag = await db.tag.upsert({
      where: { name },
      create: { name, source: "AI" },
      update: {}
    });
    await db.mediaTag.upsert({
      where: { mediaAssetId_tagId: { mediaAssetId, tagId: tag.id } },
      create: { mediaAssetId, tagId: tag.id },
      update: {}
    });
  }

  await db.mediaAsset.update({
    where: { id: mediaAssetId },
    data: { activityLabel: data.activity }
  });
}
