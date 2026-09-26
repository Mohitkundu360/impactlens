import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/currentUser";

const RegisterMediaSchema = z.object({
  projectId: z.string(),
  cloudinaryPublicId: z.string(),
  cloudinaryAssetId: z.string().optional(),
  cloudinaryUrl: z.string().url(),
  cloudinarySecureUrl: z.string().url(),
  resourceType: z.enum(["IMAGE", "VIDEO"]),
  format: z.string().optional(),
  bytes: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSeconds: z.number().optional(),
  phase: z.enum(["BEFORE", "DURING", "AFTER", "UNSPECIFIED"]).default("UNSPECIFIED"),
  capturedAt: z.string().datetime().optional(),
  locationText: z.string().max(200).optional()
});

/**
 * Registers an already-uploaded Cloudinary asset as a MediaAsset and enqueues
 * the appropriate ProcessingJob. The worker (worker/index.ts) picks it up
 * from there — this route does no AI work itself, keeping upload
 * registration fast and processing async/observable.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterMediaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const project = await db.project.findUnique({ where: { id: data.projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const user = await getCurrentUser();

  const jobType = data.resourceType === "VIDEO" ? "VIDEO_ANALYSIS_FRAME" : "IMAGE_ANALYSIS";

  const media = await db.mediaAsset.create({
    data: {
      projectId: data.projectId,
      cloudinaryPublicId: data.cloudinaryPublicId,
      cloudinaryAssetId: data.cloudinaryAssetId,
      cloudinaryUrl: data.cloudinaryUrl,
      cloudinarySecureUrl: data.cloudinarySecureUrl,
      resourceType: data.resourceType,
      format: data.format,
      bytes: data.bytes,
      width: data.width,
      height: data.height,
      durationSeconds: data.durationSeconds,
      phase: data.phase,
      capturedAt: data.capturedAt ? new Date(data.capturedAt) : undefined,
      locationText: data.locationText,
      status: "UPLOADED",
      uploadedById: user.id,
      processingJobs: {
        create: { jobType, status: "QUEUED" }
      }
    },
    include: { processingJobs: true }
  });

  return NextResponse.json({ media }, { status: 201 });
}
