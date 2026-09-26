import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const report = await db.report.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true, locationText: true, projectType: true } },
      media: {
        orderBy: { sortOrder: "asc" },
        include: {
          mediaAsset: {
            include: { analysis: true }
          }
        }
      },
      comparisons: {
        orderBy: { sortOrder: "asc" },
        include: {
          comparisonPair: {
            include: {
              beforeMedia: { select: { id: true, cloudinarySecureUrl: true, phase: true, activityLabel: true } },
              afterMedia: { select: { id: true, cloudinarySecureUrl: true, phase: true, activityLabel: true } }
            }
          }
        }
      }
    }
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  return NextResponse.json({ report });
}
