import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import CompareClient from "./CompareClient";

export const dynamic = "force-dynamic";

export default async function ComparePage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  const media = await db.mediaAsset.findMany({
    where: { projectId: params.id, status: "INDEXED", resourceType: "IMAGE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cloudinarySecureUrl: true,
      phase: true,
      activityLabel: true,
      capturedAt: true
    }
  });

  return (
    <main className="max-w-5xl mx-auto py-12 px-4">
      <a href={`/projects/${project.id}`} className="text-sm text-slate-400 hover:text-slate-600">
        ← {project.name}
      </a>
      <h1 className="text-2xl font-semibold mt-2 mb-1">Compare</h1>
      <p className="text-slate-500 mb-6">
        Pick two analyzed photos to see what changed, with the AI observation kept separate from
        interpretation.
      </p>

      <CompareClient projectId={project.id} media={media as any} />
    </main>
  );
}
