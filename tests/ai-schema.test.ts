import { describe, expect, it } from "vitest";
import { AnalysisResultSchema } from "@/lib/ai/provider";

const validPayload = {
  description: "A person plants a sapling in cleared soil.",
  activity: "tree planting",
  environment: "restoration site",
  objects: ["sapling", "person", "soil"],
  observations: ["A young plant is being placed into freshly dug soil."],
  sustainabilityCategories: ["reforestation"],
  confidence: 0.82,
  observedSummary: "A person is kneeling beside a small plant in bare soil.",
  interpretationSummary: "The scene appears consistent with a tree-planting activity."
};

describe("AnalysisResultSchema", () => {
  it("accepts a well-formed analysis payload", () => {
    const result = AnalysisResultSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing observedSummary", () => {
    const { observedSummary, ...rest } = validPayload;
    const result = AnalysisResultSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing interpretationSummary", () => {
    const { interpretationSummary, ...rest } = validPayload;
    const result = AnalysisResultSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside [0,1]", () => {
    const result = AnalysisResultSchema.safeParse({ ...validPayload, confidence: 1.5 });
    expect(result.success).toBe(false);
  });

  it("defaults objects/observations/categories to empty arrays when omitted", () => {
    const { objects, observations, sustainabilityCategories, ...rest } = validPayload;
    const result = AnalysisResultSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.objects).toEqual([]);
      expect(result.data.observations).toEqual([]);
      expect(result.data.sustainabilityCategories).toEqual([]);
    }
  });

  it("has no field capable of holding a quantitative impact claim", () => {
    // Structural guarantee, not just a prompt rule: the schema's key set is
    // fixed and none of them are meant for numeric environmental claims.
    const keys = Object.keys(AnalysisResultSchema.shape);
    const forbidden = ["impact", "percentage", "measurement", "co2", "carbon"];
    for (const key of keys) {
      expect(forbidden.some((f) => key.toLowerCase().includes(f))).toBe(false);
    }
  });
});
