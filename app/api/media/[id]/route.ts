import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const UpdateMediaSchema = z.object({
  phase: z.enum(["BEFORE", "DURING", "AFTER", "UNSPECIFIED"])
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const media = await db.mediaAsset.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true, projectType: true, locationText: true } },
      analysis: true,
      videoScenes: { orderBy: { startSeconds: "asc" } },
      tags: { include: { tag: true } },
      processingJobs: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  return NextResponse.json({
    media: {
      ...media,
      tags: media.tags.map((mt) => mt.tag.name)
    }
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = UpdateMediaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const media = await db.mediaAsset.findUnique({
    where: { id: params.id },
    select: { id: true }
  });

  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  const updated = await db.mediaAsset.update({
    where: { id: params.id },
    data: { phase: parsed.data.phase }
  });

  return NextResponse.json({ media: updated });
}