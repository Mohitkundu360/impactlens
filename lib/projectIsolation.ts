export interface ProjectScoped {
  id: string;
  projectId: string;
}

/**
 * Returns the ids of items that do NOT belong to expectedProjectId.
 * Empty array means isolation holds. Pure — no DB, fully unit-testable.
 *
 * There's no auth/multi-tenancy in this app (explicit non-goal), so this
 * isn't a security boundary between users — it's a data-integrity boundary
 * that stops one project's media/comparisons from silently leaking into
 * another project's report or comparison just because a client sent an id
 * that happened to resolve.
 */
export function findCrossProjectViolations(items: ProjectScoped[], expectedProjectId: string): string[] {
  return items.filter((item) => item.projectId !== expectedProjectId).map((item) => item.id);
}
