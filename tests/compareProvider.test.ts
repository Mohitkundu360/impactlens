import { describe, expect, it } from "vitest";
import { ComparisonResultSchema } from "@/lib/ai/compareProvider";

const validPayload = {
  observedSummary:
    "The before image shows bare soil with no visible plants; the after image shows the same area with small green plants covering part of the ground.",
  interpretationSummary: "This is consistent with new vegetation growth since the earlier photo was taken."
};

describe("ComparisonResultSchema", () => {
  it("accepts a well-formed comparison payload", () => {
    expect(ComparisonResultSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects a payload missing observedSummary", () => {
    const { observedSummary, ...rest } = validPayload;
    expect(ComparisonResultSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a payload missing interpretationSummary", () => {
    const { interpretationSummary, ...rest } = validPayload;
    expect(ComparisonResultSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(ComparisonResultSchema.safeParse({ observedSummary: "", interpretationSummary: "" }).success).toBe(false);
  });

  it("has no field capable of holding a quantitative impact claim", () => {
    const keys = Object.keys(ComparisonResultSchema.shape);
    const forbidden = ["impact", "percentage", "measurement", "co2", "carbon", "delta", "change_amount"];
    for (const key of keys) {
      expect(forbidden.some((f) => key.toLowerCase().includes(f))).toBe(false);
    }
  });
});
