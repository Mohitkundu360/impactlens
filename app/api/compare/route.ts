import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/currentUser";
import { compareImages } from "@/lib/ai/compareProvider";
import { findCrossProjectViolations } from "@/lib/projectIsolation";

const CompareRequestSchema = z.object({
  projectId: z.string(),
  beforeMediaId: z.string(),
  afterMediaId: z.string()
});

/**
 * Comparison is a single, on-demand, user-triggered action (pick two assets,
 * click Compare) — unlike bulk upload analysis, it doesn't go through the
 * ProcessingJob queue. One Gemini call, synchronous, fast enough to await
 * directly in the request. If this changes (e.g. batch-comparing many pairs
 * at once), that's when this would move to the worker.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CompareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { projectId, beforeMediaId, afterMediaId } = parsed.data;

  if (beforeMediaId === afterMediaId) {
    return NextResponse.json({ error: "Before and after must be different assets." }, { status: 400 });
  }

  const existing = await db.comparisonPair.findUnique({
    where: { projectId_beforeMediaId_afterMediaId: { projectId, beforeMediaId, afterMediaId } }
  });
  if (existing) {
    return NextResponse.json({ comparison: existing, cached: true });
  }

  const [project, before, after] = await Promise.all([
    db.project.findUnique({ where: { id: projectId } }),
    db.mediaAsset.findUnique({ where: { id: beforeMediaId } }),
    db.mediaAsset.findUnique({ where: { id: afterMediaId } })
  ]);

  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (!before || !after) return NextResponse.json({ error: "One or both media assets not found." }, { status: 404 });

  const violations = findCrossProjectViolations(
    [
      { id: before.id, projectId: before.projectId },
      { id: after.id, projectId: after.projectId }
    ],
    projectId
  );
  if (violations.length > 0) {
    return NextResponse.json(
      { error: "Before/after media must both belong to the specified project.", offendingIds: violations },
      { status: 400 }
    );
  }

  if (before.status !== "INDEXED" || after.status !== "INDEXED") {
  return NextResponse.json(
    { error: "Both assets must be fully analyzed (INDEXED) before comparing." },
    { status: 400 }
  );
}

if (before.phase !== "BEFORE" || after.phase !== "AFTER") {
  return NextResponse.json(
    { error: "Comparison requires a BEFORE asset and an AFTER asset." },
    { status: 400 }
  );
}

  const user = await getCurrentUser();

  let aiResult;
  try {
    aiResult = await compareImages(before.cloudinarySecureUrl, after.cloudinarySecureUrl, {
      projectName: project.name,
      projectType: project.projectType,
      beforeLabel: before.activityLabel,
      afterLabel: after.activityLabel
    });
  } catch (err) {
    return NextResponse.json({ error: `AI comparison failed: ${(err as Error).message}` }, { status: 502 });
  }

  const comparison = await db.comparisonPair.create({
    data: {
      projectId,
      beforeMediaId,
      afterMediaId,
      observedSummary: aiResult.data.observedSummary,
      interpretationSummary: aiResult.data.interpretationSummary,
      modelProvider: aiResult.modelProvider,
      modelName: aiResult.modelName,
      generatedAt: aiResult.generatedAt,
      createdById: user.id
    }
  });

  return NextResponse.json({ comparison, cached: false }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId query param is required." }, { status: 400 });
  }

  const comparisons = await db.comparisonPair.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      beforeMedia: { select: { id: true, cloudinarySecureUrl: true, phase: true, activityLabel: true } },
      afterMedia: { select: { id: true, cloudinarySecureUrl: true, phase: true, activityLabel: true } }
    }
  });

  return NextResponse.json({ comparisons });
}
