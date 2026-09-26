import { describe, expect, it } from "vitest";
import { buildTagNames, normalizeTagName } from "@/lib/tagUtils";

describe("normalizeTagName", () => {
  it("lowercases and trims", () => {
    expect(normalizeTagName("  Tree Planting  ")).toBe("tree planting");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeTagName("tree   planting")).toBe("tree planting");
  });
});

describe("buildTagNames", () => {
  it("combines activity, objects, and categories", () => {
    const names = buildTagNames({
      activity: "Tree Planting",
      objects: ["Saplings", "People"],
      sustainabilityCategories: ["Reforestation"]
    });
    expect(names).toEqual(["tree planting", "saplings", "people", "reforestation"]);
  });

  it("dedupes case-insensitively across categories", () => {
    const names = buildTagNames({
      activity: "tree planting",
      objects: ["Tree Planting", "Soil"],
      sustainabilityCategories: []
    });
    expect(names).toEqual(["tree planting", "soil"]);
  });

  it("handles a null activity", () => {
    const names = buildTagNames({
      activity: null,
      objects: ["soil"],
      sustainabilityCategories: []
    });
    expect(names).toEqual(["soil"]);
  });

  it("drops empty/whitespace-only candidates", () => {
    const names = buildTagNames({
      activity: "   ",
      objects: ["soil", ""],
      sustainabilityCategories: []
    });
    expect(names).toEqual(["soil"]);
  });
});
