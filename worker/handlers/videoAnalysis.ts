import { MediaAsset, Project } from "@prisma/client";
import { geminiProvider } from "@/lib/ai/gemini";
import { persistAnalysisResult } from "@/lib/persistAnalysis";
import { videoPreviewFrameUrl, submitVideoAnalysis, getVideoAnalysisJob, fetchVisualTranscript } from "@/lib/cloudinary";
import { db } from "@/lib/db";

/**
 * Guaranteed MVP path: extract a representative frame from the video via a
 * Cloudinary video transformation, then run the same image-analysis pipeline
 * on that frame. This is what VIDEO_ANALYSIS_FRAME jobs run, always.
 */
export async function runFrameBasedVideoAnalysis(media: MediaAsset, project: Project) {
  const frameUrl = videoPreviewFrameUrl(media.cloudinaryPublicId, "auto");

  const result = await geminiProvider.analyzeImage(frameUrl, {
    projectName: project.name,
    projectType: project.projectType,
    phase: media.phase,
    locationText: media.locationText ?? project.locationText
  });

  await persistAnalysisResult(media.id, result);
}

/**
 * STRETCH / not wired into the default job dispatch (worker/processJob.ts
 * only ever creates VIDEO_ANALYSIS_FRAME jobs today). Left here, fully
 * implemented against the real Cloudinary AI Video Analysis (Beta) API
 * shape, so it can be turned on later by:
 *   1. setting CLOUDINARY_AI_VIDEO_ANALYSIS_ENABLED=true
 *   2. having media registration create a VIDEO_ANALYSIS_NATIVE job instead
 *   3. adding a case for it in worker/processJob.ts that calls this AND
 *      falls back to runFrameBasedVideoAnalysis on any failure/timeout.
 *
 * This is intentionally not wired up yet — multi-step async polling for a
 * Beta endpoint is exactly the kind of complexity the project brief says to
 * defer unless the guaranteed path is already solid and there's time left.
 */
export async function runNativeVideoAnalysisBeta(media: MediaAsset) {
  if (!media.cloudinaryAssetId) {
    throw new Error("Cannot run native video analysis without a cloudinaryAssetId.");
  }

  const { jobId } = await submitVideoAnalysis(media.cloudinaryAssetId);

  const POLL_INTERVAL_MS = 3000;
  const MAX_POLLS = 40; // ~2 minutes

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const job = await getVideoAnalysisJob(jobId);

    if (job.status === "completed" && job.transcript) {
      const segments = await fetchVisualTranscript(job.transcript.url);
      await db.videoScene.createMany({
        data: segments.map((s) => ({
          mediaAssetId: media.id,
          startSeconds: s.startSeconds,
          endSeconds: s.endSeconds,
          description: s.description,
          modelProvider: "CLOUDINARY_AI_VIDEO_ANALYSIS" as const
        }))
      });
      return;
    }

    if (job.status === "failed") {
      throw new Error("Cloudinary AI Video Analysis job failed.");
    }
  }

  throw new Error("Cloudinary AI Video Analysis job timed out.");
}
