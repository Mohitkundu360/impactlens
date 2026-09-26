import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ReportBuilderClient from "./ReportBuilderClient";

export const dynamic = "force-dynamic";

export default async function NewReportPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  const [media, comparisons] = await Promise.all([
    db.mediaAsset.findMany({
      where: { projectId: params.id, status: "INDEXED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        cloudinarySecureUrl: true,
        phase: true,
        activityLabel: true,
        resourceType: true
      }
    }),
    db.comparisonPair.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
      include: {
        beforeMedia: { select: { cloudinarySecureUrl: true, activityLabel: true } },
        afterMedia: { select: { cloudinarySecureUrl: true, activityLabel: true } }
      }
    })
  ]);

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <a href={`/projects/${project.id}`} className="text-sm text-slate-400 hover:text-slate-600">
        ← {project.name}
      </a>
      <h1 className="text-2xl font-semibold mt-2 mb-1">Generate report</h1>
      <p className="text-slate-500 mb-6">
        Pick the evidence to include. The AI writes one summary paragraph from exactly what you
        select — everything else in the report is assembled directly from your choices.
      </p>

      <ReportBuilderClient projectId={project.id} media={media as any} comparisons={comparisons as any} />
    </main>
  );
}
