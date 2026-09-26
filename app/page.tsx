import { db } from "@/lib/db";
import NewProjectForm from "./NewProjectForm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { media: true } } }
  });

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex justify-between items-start mb-1">
        <h1 className="text-2xl font-semibold">ImpactLens</h1>
        <a href="/search" className="text-sm text-slate-500 hover:text-slate-900 border border-slate-300 rounded px-3 py-1.5">
          AI Search →
        </a>
      </div>
      <p className="text-slate-500 mb-8">
        Create a project, then open it to upload media and watch AI analysis run.
      </p>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          New project
        </h2>
        <NewProjectForm />
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          Projects ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="text-slate-400 text-sm">No projects yet.</p>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <a
                  href={`/projects/${p.id}`}
                  className="block border border-slate-200 rounded-lg p-4 bg-white hover:border-slate-400 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {p.locationText && (
                        <p className="text-sm text-slate-500">{p.locationText}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{p._count.media} media</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
