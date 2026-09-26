import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/currentUser";
import { generateReportSummary, ReportEvidenceItem } from "@/lib/ai/reportProvider";

const CreateReportSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(200),
  mediaIds: z.array(z.string()).default([]),
  comparisonIds: z.array(z.string()).default([])
});

/**
 * The evidence list (ReportMedia/ReportComparison rows) is assembled here,
 * deterministically, from exactly the ids the user picked — never from a
 * model's judgment of what's relevant. The model only writes the narrative
 * summary paragraph, and only from the observed/interpretation text of
 * that same deterministic list. See lib/ai/reportProvider.ts.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { projectId, title, mediaIds, comparisonIds } = parsed.data;

  if (mediaIds.length === 0 && comparisonIds.length === 0) {
    return NextResponse.json({ error: "Select at least one media asset or comparison." }, { status: 400 });
  }

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const [mediaItems, comparisonItems] = await Promise.all([
    db.mediaAsset.findMany({
      where: { id: { in: mediaIds }, projectId },
      include: { analysis: true }
    }),
    db.comparisonPair.findMany({
      where: { id: { in: comparisonIds }, projectId }
    })
  ]);

  if (mediaItems.length !== mediaIds.length || comparisonItems.length !== comparisonIds.length) {
    return NextResponse.json({ error: "One or more selected items were not found in this project." }, { status: 400 });
  }

  const evidence: ReportEvidenceItem[] = [
    ...mediaItems.map((m) => ({
      kind: "media" as const,
      activityOrLabel: m.activityLabel,
      observedSummary: m.analysis?.observedSummary ?? null,
      interpretationSummary: m.analysis?.interpretationSummary ?? null
    })),
    ...comparisonItems.map((c) => ({
      kind: "comparison" as const,
      activityOrLabel: "before/after comparison",
      observedSummary: c.observedSummary,
      interpretationSummary: c.interpretationSummary
    }))
  ];

  let summaryResult;
  try {
    summaryResult = await generateReportSummary(
      { projectName: project.name, projectType: project.projectType, locationText: project.locationText },
      evidence
    );
  } catch (err) {
  const message = err instanceof Error ? err.message : "Unknown error";

  console.error("Report summary generation failed:", message);

  const isTemporaryGeminiError =
    message.includes("503") ||
    message.includes("UNAVAILABLE") ||
    message.includes("429") ||
    message.includes("high demand");

  return NextResponse.json(
    {
      error: isTemporaryGeminiError
        ? "Report generation is temporarily unavailable because the AI service is experiencing high demand. Your selected evidence is still intact. Please try again shortly."
        : "Report generation failed. Your selected evidence is still intact. Please try again."
    },
    { status: 502 }
  );
}

  const user = await getCurrentUser();

  const report = await db.report.create({
    data: {
      projectId,
      title,
      summary: summaryResult.summary,
      generatedById: user.id,
      media: { create: mediaIds.map((id, i) => ({ mediaAssetId: id, sortOrder: i })) },
      comparisons: { create: comparisonIds.map((id, i) => ({ comparisonPairId: id, sortOrder: i })) }
    }
  });

  return NextResponse.json({ report }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId query param is required." }, { status: 400 });
  }

  const reports = await db.report.findMany({
    where: { projectId },
    orderBy: { generatedAt: "desc" },
    select: { id: true, title: true, generatedAt: true }
  });

  return NextResponse.json({ reports });
}
