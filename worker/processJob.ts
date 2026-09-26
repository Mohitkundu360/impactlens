import { db } from "@/lib/db";
import { runImageAnalysis } from "./handlers/imageAnalysis";
import { runFrameBasedVideoAnalysis } from "./handlers/videoAnalysis";

/**
 * Picks the oldest QUEUED job, if any, and runs it to completion.
 * Returns true if a job was found and processed (caller loops again
 * immediately), false if the queue was empty (caller should back off).
 *
 * State machine:
 *   MediaAsset.status:  UPLOADED -> PROCESSING -> INDEXED
 *                                        \-> FAILED
 *   ProcessingJob.status: QUEUED -> RUNNING -> SUCCEEDED
 *                                          \-> FAILED
 */
export async function processNextJob(): Promise<boolean> {
  const job = await db.processingJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" }
  });

  if (!job) return false;

  await db.processingJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", attempts: { increment: 1 } }
  });

  const media = await db.mediaAsset.findUnique({
    where: { id: job.mediaAssetId },
    include: { project: true }
  });

  if (!media) {
    // Orphaned job (media deleted mid-flight) — fail it and move on.
    await db.processingJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: "MediaAsset no longer exists." }
    });
    return true;
  }

  await db.mediaAsset.update({ where: { id: media.id }, data: { status: "PROCESSING" } });

  try {
    switch (job.jobType) {
      case "IMAGE_ANALYSIS":
        await runImageAnalysis(media, media.project);
        break;
      case "VIDEO_ANALYSIS_FRAME":
        await runFrameBasedVideoAnalysis(media, media.project);
        break;
      case "VIDEO_ANALYSIS_NATIVE":
        // Not dispatched by the current registration logic (see
        // worker/handlers/videoAnalysis.ts) — guard here so a stray job of
        // this type fails loudly instead of silently no-op'ing.
        throw new Error("VIDEO_ANALYSIS_NATIVE is not wired into the MVP job dispatch yet.");
      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }

    await db.processingJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED" } });
    await db.mediaAsset.update({ where: { id: media.id }, data: { status: "INDEXED" } });
  } catch (err) {
    const message = (err as Error).message ?? "Unknown processing error.";
    await db.processingJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 1000) }
    });
    await db.mediaAsset.update({ where: { id: media.id }, data: { status: "FAILED" } });
  }

  return true;
}
