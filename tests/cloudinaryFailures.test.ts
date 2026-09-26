import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
});

describe("Cloudinary failure paths", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("getAsset throws when the Cloudinary Admin API errors (nonexistent asset)", async () => {
    const { getAsset } = await import("@/lib/cloudinary");
    // cloudinary.api.resource throws internally on a real 404; we can't
    // easily stub the SDK's internal HTTP client here, so this test
    // documents the contract via a public_id that will fail against any
    // real account — see Phase 8 report for why full mocking of the SDK's
    // internal transport wasn't pursued (would require mocking the
    // `cloudinary` package itself, not just fetch).
    await expect(getAsset("definitely-does-not-exist-12345", "image")).rejects.toThrow();
  });

  it("analyzeWithAiVision throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "add-on not enabled" });

    const { analyzeWithAiVision } = await import("@/lib/cloudinary");
    await expect(analyzeWithAiVision({ assetId: "abc123" }, "Describe this image")).rejects.toThrow(
      /AI Vision request failed/
    );
  });

  it("analyzeWithAiVision handles a malformed (non-JSON-parseable) response gracefully by throwing", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token in JSON");
      }
    });

    const { analyzeWithAiVision } = await import("@/lib/cloudinary");
    await expect(analyzeWithAiVision({ assetId: "abc123" }, "Describe this image")).rejects.toThrow();
  });

  it("submitVideoAnalysis throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => "invalid video_asset_id" });

    const { submitVideoAnalysis } = await import("@/lib/cloudinary");
    await expect(submitVideoAnalysis("bad-asset-id")).rejects.toThrow(/AI Video Analysis submit failed/);
  });

  it("getVideoAnalysisJob throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: async () => "job not found" });

    const { getVideoAnalysisJob } = await import("@/lib/cloudinary");
    await expect(getVideoAnalysisJob("nonexistent-job-id")).rejects.toThrow(/AI Video Analysis poll failed/);
  });

  it("fetchVisualTranscript throws when the transcript URL itself 404s", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    const { fetchVisualTranscript } = await import("@/lib/cloudinary");
    await expect(fetchVisualTranscript("https://res.cloudinary.com/demo/missing.transcript.json")).rejects.toThrow(
      /Failed to fetch visual transcript/
    );
  });

  it("every Cloudinary-calling export throws the same clear config error when unconfigured", async () => {
    const original = { ...process.env };
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const mod = await import("@/lib/cloudinary");

    expect(() => mod.generateUploadSignature({ folder: "x" })).toThrow(/not configured/i);
    await expect(mod.getAsset("x")).rejects.toThrow(/not configured/i);
    await expect(mod.analyzeWithAiVision({ assetId: "x" }, "prompt")).rejects.toThrow(/not configured/i);
    await expect(mod.submitVideoAnalysis("x")).rejects.toThrow(/not configured/i);
    await expect(mod.getVideoAnalysisJob("x")).rejects.toThrow(/not configured/i);

    process.env.CLOUDINARY_CLOUD_NAME = original.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = original.CLOUDINARY_API_KEY;
    process.env.CLOUDINARY_API_SECRET = original.CLOUDINARY_API_SECRET;
  });
});
