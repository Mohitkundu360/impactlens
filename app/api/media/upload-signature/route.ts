import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateUploadSignature } from "@/lib/cloudinary";
import { db } from "@/lib/db";

const RequestSchema = z.object({
  projectId: z.string(),
  phase: z.enum(["BEFORE", "DURING", "AFTER", "UNSPECIFIED"]).default("UNSPECIFIED")
});

/**
 * Client calls this BEFORE uploading to Cloudinary directly. We never see the
 * file itself — only issue a short-lived signature scoped to this project,
 * so large video uploads never round-trip through our server.
 *
 * Full registration of the uploaded asset (POST /api/media, creating the
 * MediaAsset + ProcessingJob rows) is Phase 3 — this route only proves the
 * signing half of the Cloudinary integration.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await db.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const signature = generateUploadSignature({
    folder: `impactlens/${project.id}`,
    context: {
      project_id: project.id,
      phase: parsed.data.phase
    },
    tags: ["impactlens", project.id]
  });

  return NextResponse.json(signature);
}
