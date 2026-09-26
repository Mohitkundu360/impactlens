import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import UploadWidget from "./UploadWidget";
import MediaGrid from "./MediaGrid";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
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
      reports: { orderBy: { generatedAt: "desc" }, select: { id: true, title: true, generatedAt: true } }
    }
  });

  if (!project) notFound();

  const total = project.media.length;
  const indexed = project.media.filter((m) => m.status === "INDEXED").length;
  const images = project.media.filter((m) => m.resourceType === "IMAGE").length;
  const videos = project.media.filter((m) => m.resourceType === "VIDEO").length;
  const byPhase = project.media.reduce<Record<string, number>>((acc, m) => {
    acc[m.phase] = (acc[m.phase] ?? 0) + 1;
    return acc;
  }, {});
  const activityCounts = project.media.reduce<Record<string, number>>((acc, m) => {
    if (!m.activityLabel) return acc;
    acc[m.activityLabel] = (acc[m.activityLabel] ?? 0) + 1;
    return acc;
  }, {});
  const topActivities = Object.entries(activityCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <main className="max-w-5xl mx-auto py-12 px-4">
      <a href="/" className="text-sm text-slate-400 hover:text-slate-600">
        ← All projects
      </a>
      <div className="flex justify-between items-start mt-2 mb-1">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <div className="flex gap-2">
          <a
            href={`/projects/${project.id}/compare`}
            className="text-sm text-slate-500 hover:text-slate-900 border border-slate-300 rounded px-3 py-1.5"
          >
            Compare →
          </a>
          <a
            href={`/projects/${project.id}/reports/new`}
            className="text-sm text-white bg-slate-900 rounded px-3 py-1.5"
          >
            Generate report →
          </a>
        </div>
      </div>
      <p className="text-slate-500 mb-8">
        {project.locationText ?? "No location set"} · {project.projectType.replaceAll("_", " ")}
      </p>

      <section className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total media" value={total} />
        <StatCard label="Analyzed" value={indexed} />
        <StatCard label="Photos / Videos" value={`${images} / ${videos}`} />
        <StatCard label="Comparisons" value={project.comparisonPairs.length} />
      </section>

      {topActivities.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Activity breakdown
          </h2>
          <div className="flex flex-wrap gap-2">
            {topActivities.map(([activity, count]) => (
              <span key={activity} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1">
                {activity} <span className="text-slate-400">× {count}</span>
              </span>
            ))}
          </div>
          <div className="flex gap-3 mt-3 text-xs text-slate-400">
            {Object.entries(byPhase).map(([phase, count]) => (
              <span key={phase}>
                {phase}: {count}
              </span>
            ))}
          </div>
        </section>
      )}

      {project.reports.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Reports ({project.reports.length})
          </h2>
          <ul className="flex flex-col gap-1">
            {project.reports.map((r) => (
              <li key={r.id}>
                <a href={`/reports/${r.id}`} className="text-sm text-slate-600 hover:text-slate-900 underline">
                  {r.title}
                </a>
                <span className="text-xs text-slate-400 ml-2">
                  {new Date(r.generatedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          Upload media
        </h2>
        <UploadWidget projectId={project.id} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          Media ({project.media.length})
        </h2>
        <MediaGrid projectId={project.id} initialMedia={project.media as any} />
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
