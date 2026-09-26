import { describe, expect, it } from "vitest";
import { naiveFallbackParse } from "@/lib/search/queryParser";

describe("naiveFallbackParse", () => {
  it("extracts keywords, dropping stopwords", () => {
    const filter = naiveFallbackParse("Show evidence of tree planting activities");
    expect(filter.keywords).toEqual(expect.arrayContaining(["tree", "planting", "activities"]));
    expect(filter.keywords).not.toContain("show");
    expect(filter.keywords).not.toContain("evidence");
  });

  it("detects phase: before", () => {
    const filter = naiveFallbackParse("Show before images from the restoration site");
    expect(filter.phase).toBe("BEFORE");
  });

  it("detects phase: after", () => {
    const filter = naiveFallbackParse("Find after photos of the mangrove site");
    expect(filter.phase).toBe("AFTER");
  });

  it("detects media type: video", () => {
    const filter = naiveFallbackParse("Find videos showing community participation");
    expect(filter.mediaType).toBe("VIDEO");
  });

  it("detects media type: image from 'photos'", () => {
    const filter = naiveFallbackParse("Show photos of saplings");
    expect(filter.mediaType).toBe("IMAGE");
  });

  it("returns null phase/mediaType when nothing matches", () => {
    const filter = naiveFallbackParse("community engagement");
    expect(filter.phase).toBeNull();
    expect(filter.mediaType).toBeNull();
  });

  it("strips punctuation before tokenizing", () => {
    const filter = naiveFallbackParse("tree-planting, community-participation!");
    expect(filter.keywords).toEqual(expect.arrayContaining(["tree", "planting", "community", "participation"]));
  });
});
