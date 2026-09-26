import { MediaAsset, Project } from "@prisma/client";
import { geminiProvider } from "@/lib/ai/gemini";
import { persistAnalysisResult } from "@/lib/persistAnalysis";

/**
 * Runs image analysis for a single MediaAsset and persists the result.
 * Throws on failure — the caller (worker/processJob.ts) is responsible for
 * turning that into a FAILED ProcessingJob / MediaAsset state. This function
 * does not touch status fields itself, to keep the state-machine logic in
 * one place.
 */
export async function runImageAnalysis(media: MediaAsset, project: Project) {
  const result = await geminiProvider.analyzeImage(media.cloudinarySecureUrl, {
    projectName: project.name,
    projectType: project.projectType,
    phase: media.phase,
    locationText: media.locationText ?? project.locationText
  });

  await persistAnalysisResult(media.id, result);
}
