import { db } from "@/lib/db";
import { StructuredFilter } from "./types";
import { buildWhereClause } from "./whereClause";

export interface SearchProvider {
  search(filter: StructuredFilter, projectId?: string): Promise<SearchResultItem[]>;
}

export interface SearchResultItem {
  id: string;
  projectId: string;
  projectName: string;
  cloudinaryPublicId: string;
  cloudinarySecureUrl: string;
  resourceType: "IMAGE" | "VIDEO";
  phase: string;
  activityLabel: string | null;
  capturedAt: Date | null;
  description: string | null;
  observedSummary: string | null;
  interpretationSummary: string | null;
  confidence: number | null;
}

/**
 * MVP search: LLM-parsed (or fallback-parsed) filter -> deterministic
 * Postgres query via Prisma. No vector DB, no embeddings. Swappable later
 * for a SemanticSearchProvider behind this same interface — see Phase 1
 * architecture notes — without any change to the API route or UI.
 */
export class FilterSearchProvider implements SearchProvider {
  async search(filter: StructuredFilter, projectId?: string): Promise<SearchResultItem[]> {
    const where = buildWhereClause(filter, projectId);

    const results = await db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        project: { select: { id: true, name: true } },
        analysis: {
          select: { description: true, observedSummary: true, interpretationSummary: true, confidence: true }
        }
      }
    });

    return results.map((m) => ({
      id: m.id,
      projectId: m.project.id,
      projectName: m.project.name,
      cloudinaryPublicId: m.cloudinaryPublicId,
      cloudinarySecureUrl: m.cloudinarySecureUrl,
      resourceType: m.resourceType,
      phase: m.phase,
      activityLabel: m.activityLabel,
      capturedAt: m.capturedAt,
      description: m.analysis?.description ?? null,
      observedSummary: m.analysis?.observedSummary ?? null,
      interpretationSummary: m.analysis?.interpretationSummary ?? null,
      confidence: m.analysis?.confidence ?? null
    }));
  }
}

export const filterSearchProvider = new FilterSearchProvider();
