import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Requeues processing for a media asset. We create a NEW ProcessingJob row
 * rather than mutating the failed one, so failure history stays intact and
 * auditable — the ProcessingJob list for an asset is a real log, not a
 * single mutable status field.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const media = await db.mediaAsset.findUnique({ where: { id: params.id } });
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  if (media.status !== "FAILED") {
    return NextResponse.json({ error: "Only failed media can be retried." }, { status: 400 });
  }

  const jobType = media.resourceType === "VIDEO" ? "VIDEO_ANALYSIS_FRAME" : "IMAGE_ANALYSIS";

  const job = await db.processingJob.create({
    data: { mediaAssetId: media.id, jobType, status: "QUEUED" }
  });

  await db.mediaAsset.update({
    where: { id: media.id },
    data: { status: "UPLOADED" }
  });

  return NextResponse.json({ job }, { status: 201 });
}
