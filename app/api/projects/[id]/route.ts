import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      media: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          cloudinaryPublicId: true,
          cloudinarySecureUrl: true,
          resourceType: true,
          phase: true,
          activityLabel: true,
          status: true,
          capturedAt: true,
          createdAt: true
        }
      },
      comparisonPairs: { select: { id: true } },
      reports: {
        orderBy: { generatedAt: "desc" },
        select: { id: true, title: true, generatedAt: true }
      }
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const phaseCounts = project.media.reduce<Record<string, number>>((acc, m) => {
    acc[m.phase] = (acc[m.phase] ?? 0) + 1;
    return acc;
  }, {});

  const statusCounts = project.media.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});

  const resourceTypeCounts = project.media.reduce<Record<string, number>>((acc, m) => {
    acc[m.resourceType] = (acc[m.resourceType] ?? 0) + 1;
    return acc;
  }, {});

  const activityCounts = project.media.reduce<Record<string, number>>((acc, m) => {
    if (!m.activityLabel) return acc;
    acc[m.activityLabel] = (acc[m.activityLabel] ?? 0) + 1;
    return acc;
  }, {});
  const topActivities = Object.entries(activityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([activity, count]) => ({ activity, count }));

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      locationText: project.locationText,
      projectType: project.projectType,
      createdAt: project.createdAt
    },
    media: project.media,
    reports: project.reports,
    stats: {
      totalMedia: project.media.length,
      byPhase: phaseCounts,
      byStatus: statusCounts,
      byResourceType: resourceTypeCounts,
      topActivities,
      comparisonCount: project.comparisonPairs.length,
      reportCount: project.reports.length
    }
  });
}
