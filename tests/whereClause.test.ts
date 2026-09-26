import { describe, expect, it } from "vitest";
import { buildWhereClause } from "@/lib/search/whereClause";
import { EMPTY_FILTER } from "@/lib/search/types";

describe("buildWhereClause", () => {
  it("always constrains to INDEXED media", () => {
    const where = buildWhereClause(EMPTY_FILTER);
    expect(where.AND).toContainEqual({ status: "INDEXED" });
  });

  it("scopes to a project when projectId is given", () => {
    const where = buildWhereClause(EMPTY_FILTER, "proj_123");
    expect(where.AND).toContainEqual({ projectId: "proj_123" });
  });

  it("adds a phase constraint", () => {
    const where = buildWhereClause({ ...EMPTY_FILTER, phase: "BEFORE" });
    expect(where.AND).toContainEqual({ phase: "BEFORE" });
  });

  it("adds a mediaType constraint", () => {
    const where = buildWhereClause({ ...EMPTY_FILTER, mediaType: "VIDEO" });
    expect(where.AND).toContainEqual({ resourceType: "VIDEO" });
  });

  it("adds a date range constraint using capturedAt", () => {
    const where = buildWhereClause({ ...EMPTY_FILTER, dateFrom: "2026-03-01", dateTo: "2026-04-01" });
    const dateClause = (where.AND as any[])?.find((c: any) => "capturedAt" in c) as any;
    expect(dateClause.capturedAt.gte).toEqual(new Date("2026-03-01"));
    expect(dateClause.capturedAt.lte).toEqual(new Date("2026-04-01"));
  });

  it("builds an OR clause across activity/description/tags for keywords", () => {
    const where = buildWhereClause({ ...EMPTY_FILTER, keywords: ["mangrove"] });
    const orClause = (where.AND as any[])?.find((c: any) => "OR" in c) as any;
    expect(orClause.OR.length).toBe(4);
    expect(orClause.OR).toContainEqual({ activityLabel: { contains: "mangrove", mode: "insensitive" } });
  });

  it("includes activity as a search term alongside keywords", () => {
    const where = buildWhereClause({ ...EMPTY_FILTER, activity: "tree planting", keywords: ["community"] });
    const orClause = (where.AND as any[])?.find((c: any) => "OR" in c) as any;
    // 2 terms x 4 clause-types each = 8
    expect(orClause.OR.length).toBe(8);
  });

  it("adds no OR clause when there are no text terms", () => {
    const where = buildWhereClause(EMPTY_FILTER);
    expect((where.AND as any[])?.some((c: any) => "OR" in c)).toBe(false);
  });
});
