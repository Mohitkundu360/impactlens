import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EMPTY_FILTER, StructuredFilterSchema } from "@/lib/search/types";
import { parseQuery } from "@/lib/search/queryParser";
import { filterSearchProvider } from "@/lib/search/filterSearchProvider";

const RequestSchema = z.object({
  query: z.string().optional(),
  filters: StructuredFilterSchema.partial().optional(),
  projectId: z.string().optional()
});

/**
 * Body: { query?, filters?, projectId? }
 *  - query: natural language, parsed via Gemini with a deterministic fallback
 *  - filters: explicit UI controls (phase/mediaType/date pickers) — these
 *    override whatever the query parser produced for the same field, so a
 *    person can type a loose query and then narrow it with dropdowns
 *  - projectId: optional scope to a single project
 *
 * Response includes the resolved filter so the UI can show "Understood as: …"
 * — making the "AI interprets, code executes" boundary visible, not just true.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsedReq = RequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json({ error: parsedReq.error.flatten() }, { status: 400 });
  }
  const { query, filters, projectId } = parsedReq.data;

  const parseResult = query ? await parseQuery(query) : { filter: EMPTY_FILTER, usedFallback: false };

  const resolvedFilter = {
    ...parseResult.filter,
    ...Object.fromEntries(Object.entries(filters ?? {}).filter(([, v]) => v !== undefined))
  };

  const results = await filterSearchProvider.search(resolvedFilter, projectId);

  return NextResponse.json({
    resolvedFilter,
    usedFallback: parseResult.usedFallback,
    resultCount: results.length,
    results
  });
}
