import type { Prisma } from "@prisma/client";
import { StructuredFilter } from "./types";

/**
 * Deterministic, pure: same filter in, same where-clause out. This is the
 * "code executes" half of "AI interprets, code executes" — nothing here
 * depends on a model call, and it's testable without a database.
 */
export function buildWhereClause(filter: StructuredFilter, projectId?: string): Prisma.MediaAssetWhereInput {
  const AND: Prisma.MediaAssetWhereInput[] = [{ status: "INDEXED" }];

  if (projectId) AND.push({ projectId });
  if (filter.phase) AND.push({ phase: filter.phase });
  if (filter.mediaType) AND.push({ resourceType: filter.mediaType });

  if (filter.dateFrom || filter.dateTo) {
    AND.push({
      capturedAt: {
        ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
        ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {})
      }
    });
  }

  const textTerms = [...(filter.activity ? [filter.activity] : []), ...filter.keywords];

  if (textTerms.length > 0) {
    AND.push({
      OR: textTerms.flatMap((term) => [
        { activityLabel: { contains: term, mode: "insensitive" } },
        { analysis: { description: { contains: term, mode: "insensitive" } } },
        { analysis: { interpretationSummary: { contains: term, mode: "insensitive" } } },
        { tags: { some: { tag: { name: { contains: term.toLowerCase(), mode: "insensitive" } } } } }
      ])
    });
  }

  return { AND };
}
