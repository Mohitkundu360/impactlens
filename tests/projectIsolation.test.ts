import { describe, expect, it } from "vitest";
import { findCrossProjectViolations } from "@/lib/projectIsolation";

describe("findCrossProjectViolations", () => {
  it("returns empty when all items belong to the expected project", () => {
    const violations = findCrossProjectViolations(
      [
        { id: "m1", projectId: "projA" },
        { id: "m2", projectId: "projA" }
      ],
      "projA"
    );
    expect(violations).toEqual([]);
  });

  it("flags an item from a different project", () => {
    const violations = findCrossProjectViolations(
      [
        { id: "m1", projectId: "projA" },
        { id: "m2", projectId: "projB" }
      ],
      "projA"
    );
    expect(violations).toEqual(["m2"]);
  });

  it("flags all items when none match", () => {
    const violations = findCrossProjectViolations(
      [
        { id: "m1", projectId: "projB" },
        { id: "m2", projectId: "projC" }
      ],
      "projA"
    );
    expect(violations).toEqual(["m1", "m2"]);
  });

  it("returns empty for an empty item list", () => {
    expect(findCrossProjectViolations([], "projA")).toEqual([]);
  });

  it("regression: catches the before/after-from-different-projects case from /api/compare", () => {
    // Mirrors the exact shape app/api/compare/route.ts checks: a before/after
    // pair where one asset actually belongs to a different project than the
    // one the comparison was requested under.
    const before = { id: "beforeMediaId", projectId: "mangrove-project" };
    const after = { id: "afterMediaId", projectId: "infrastructure-project" };
    const violations = findCrossProjectViolations([before, after], "mangrove-project");
    expect(violations).toEqual(["afterMediaId"]);
  });
});
