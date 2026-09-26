import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const comparison = await db.comparisonPair.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      beforeMedia: {
        select: {
          id: true, cloudinaryPublicId: true, cloudinarySecureUrl: true,
          phase: true, activityLabel: true, capturedAt: true,
          analysis: { select: { observedSummary: true, interpretationSummary: true } }
        }
      },
      afterMedia: {
        select: {
          id: true, cloudinaryPublicId: true, cloudinarySecureUrl: true,
          phase: true, activityLabel: true, capturedAt: true,
          analysis: { select: { observedSummary: true, interpretationSummary: true } }
        }
      }
    }
  });

  if (!comparison) {
    return NextResponse.json({ error: "Comparison not found." }, { status: 404 });
  }

  return NextResponse.json({ comparison });
}
