import { describe, expect, it } from "vitest";
import { checkForImpactClaims } from "@/lib/ai/reportProvider";

describe("checkForImpactClaims", () => {
  it("flags a percentage figure", () => {
    expect(checkForImpactClaims("Forest coverage increased by 35%.").length).toBeGreaterThan(0);
  });

  it("flags an area measurement", () => {
    expect(checkForImpactClaims("The project restored 12 hectares of mangrove.").length).toBeGreaterThan(0);
  });

  it("flags a mass/carbon claim", () => {
    expect(checkForImpactClaims("This sequestered 4 tons of CO2.").length).toBeGreaterThan(0);
  });

  it("flags a quantified increase phrase", () => {
    expect(checkForImpactClaims("Vegetation cover increased by 3 units.").length).toBeGreaterThan(0);
  });

  it("flags certainty language", () => {
    expect(checkForImpactClaims("This proves the restoration succeeded.").length).toBeGreaterThan(0);
  });

  it("flags 'succeeded' on its own, not just 'proves'/'confirms'", () => {
    // Regression: the original pattern only caught proves/confirms/guarantees
    // and missed this and similar success-claim phrasings entirely.
    expect(checkForImpactClaims("The restoration project succeeded.").length).toBeGreaterThan(0);
  });

  it("flags 'demonstrates' as certainty language", () => {
    expect(checkForImpactClaims("This demonstrates the site has recovered.").length).toBeGreaterThan(0);
  });

  it("flags a spelled-out planted-count claim ('twenty trees')", () => {
    // Regression: the original pattern only matched digit-based counts
    // (\d+), missing plausible spelled-out phrasing.
    expect(checkForImpactClaims("Twenty trees were planted at the site.").length).toBeGreaterThan(0);
  });

  it("flags a spelled-out percentage claim ('thirty percent')", () => {
    expect(checkForImpactClaims("Coverage grew by thirty percent.").length).toBeGreaterThan(0);
  });

  it("flags a specific planted-count claim", () => {
    expect(checkForImpactClaims("120 trees were planted at the site.").length).toBeGreaterThan(0);
  });

  it("does not flag appropriately hedged, qualitative language", () => {
    const issues = checkForImpactClaims(
      "The photos show newly planted saplings and active community participation. This is consistent with reforestation activity, though the evidence does not measure outcomes."
    );
    expect(issues).toEqual([]);
  });

  it("can flag multiple distinct issues in one text", () => {
    const issues = checkForImpactClaims("Coverage increased by 20% and this proves success.");
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
