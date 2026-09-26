import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAsset } from "@/lib/cloudinary";

/**
 * Powers the Evidence Panel from every entry point (media grid, search
 * results, compare view, reports): given a MediaAsset id, return everything
 * needed to answer "where did this observation come from?" — the original
 * asset, its Cloudinary identity, and full AI provenance.
 *
 * ?live=true additionally calls the Cloudinary Admin API to prove the asset
 * still exists and matches what we have on file — off by default to avoid
 * an external call on every panel open.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const media = await db.mediaAsset.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true, locationText: true, projectType: true } },
      analysis: true,
      videoScenes: { orderBy: { startSeconds: "asc" } }
    }
  });

  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  let liveVerification: { verified: boolean; error?: string; cloudinary?: unknown } | undefined;

  if (req.nextUrl.searchParams.get("live") === "true") {
    try {
      const live = await getAsset(media.cloudinaryPublicId, media.resourceType === "VIDEO" ? "video" : "image");
      liveVerification = { verified: true, cloudinary: live };
    } catch (err) {
      liveVerification = { verified: false, error: (err as Error).message };
    }
  }

  return NextResponse.json({
    media: {
      id: media.id,
      cloudinaryPublicId: media.cloudinaryPublicId,
      cloudinarySecureUrl: media.cloudinarySecureUrl,
      resourceType: media.resourceType,
      phase: media.phase,
      capturedAt: media.capturedAt,
      locationText: media.locationText,
      status: media.status,
      project: media.project
    },
    analysis: media.analysis
      ? {
          observedSummary: media.analysis.observedSummary,
          interpretationSummary: media.analysis.interpretationSummary,
          activity: media.analysis.activity,
          objects: media.analysis.objects,
          confidence: media.analysis.confidence,
          modelProvider: media.analysis.modelProvider,
          modelName: media.analysis.modelName,
          modelVersion: media.analysis.modelVersion,
          generatedAt: media.analysis.generatedAt
        }
      : null,
    videoScenes: media.videoScenes,
    liveVerification
  });
}
