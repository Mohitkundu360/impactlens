import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ReportView from "./ReportView";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: { id: string } }) {
  const report = await db.report.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true, locationText: true, projectType: true } },
      media: {
        orderBy: { sortOrder: "asc" },
        include: { mediaAsset: { include: { analysis: true } } }
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

  if (!report) notFound();

  return <ReportView report={report as any} />;
}
