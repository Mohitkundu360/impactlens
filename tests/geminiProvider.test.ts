import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ANALYSIS = {
  description: "A person plants a sapling in cleared soil.",
  activity: "tree planting",
  environment: "restoration site",
  objects: ["sapling"],
  observations: ["A young plant is visible."],
  sustainabilityCategories: ["reforestation"],
  confidence: 0.8,
  observedSummary: "A person is kneeling beside a small plant in bare soil.",
  interpretationSummary: "The scene appears consistent with a tree-planting activity."
};

function geminiTextResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
  };
}

const IMAGE_FETCH_OK = {
  ok: true,
  headers: { get: () => "image/jpeg" },
  arrayBuffer: async () => new ArrayBuffer(8)
};

beforeAll(() => {
  process.env.GEMINI_API_KEY = "test-gemini-key";
});

describe("GeminiAnalysisProvider failure paths", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const context = {
    projectName: "Odisha Mangrove Restoration",
    projectType: "ENVIRONMENTAL_RESTORATION",
    phase: "BEFORE" as const,
    locationText: "Odisha, India"
  };

  it("succeeds on a well-formed response (control case)", async () => {
    fetchMock
      .mockResolvedValueOnce(IMAGE_FETCH_OK) // fetch the source image
      .mockResolvedValueOnce(geminiTextResponse(VALID_ANALYSIS)); // Gemini call

    const { geminiProvider } = await import("@/lib/ai/gemini");
    const result = await geminiProvider.analyzeImage("https://res.cloudinary.com/demo/image.jpg", context);
    expect(result.data.activity).toBe("tree planting");
    expect(result.modelProvider).toBe("GEMINI");
  });

  it("throws when GEMINI_API_KEY is not configured", async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    fetchMock.mockResolvedValueOnce(IMAGE_FETCH_OK);

    const { geminiProvider } = await import("@/lib/ai/gemini");
    await expect(geminiProvider.analyzeImage("https://res.cloudinary.com/demo/image.jpg", context)).rejects.toThrow(
      /GEMINI_API_KEY/
    );

    process.env.GEMINI_API_KEY = original;
  });

  it("throws a clear error on an API failure (non-ok response)", async () => {
    fetchMock
      .mockResolvedValueOnce(IMAGE_FETCH_OK)
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "internal error" });

    const { geminiProvider } = await import("@/lib/ai/gemini");
    await expect(geminiProvider.analyzeImage("https://res.cloudinary.com/demo/image.jpg", context)).rejects.toThrow(
      /Gemini analysis failed/
    );
  });

  it("throws when the source image itself can't be fetched", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    const { geminiProvider } = await import("@/lib/ai/gemini");
    await expect(geminiProvider.analyzeImage("https://res.cloudinary.com/demo/missing.jpg", context)).rejects.toThrow();
  });

  it("throws on malformed JSON in the model response text", async () => {
    fetchMock.mockResolvedValueOnce(IMAGE_FETCH_OK).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "not valid json {{{" }] } }] })
    });

    const { geminiProvider } = await import("@/lib/ai/gemini");
    await expect(geminiProvider.analyzeImage("https://res.cloudinary.com/demo/image.jpg", context)).rejects.toThrow();
  });

  it("throws when the model returns no content at all", async () => {
    fetchMock.mockResolvedValueOnce(IMAGE_FETCH_OK).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [] })
    });

    const { geminiProvider } = await import("@/lib/ai/gemini");
    await expect(geminiProvider.analyzeImage("https://res.cloudinary.com/demo/image.jpg", context)).rejects.toThrow(
      /no content/
    );
  });

  it("retries once on a schema-invalid response, then succeeds if the retry is valid", async () => {
    const invalid = { description: "missing required fields" }; // fails AnalysisResultSchema

    fetchMock
      .mockResolvedValueOnce(IMAGE_FETCH_OK) // image fetch (attempt 1)
      .mockResolvedValueOnce(geminiTextResponse(invalid)) // Gemini call (attempt 1): invalid
      .mockResolvedValueOnce(IMAGE_FETCH_OK) // image fetch (retry) — callGemini re-fetches the image each attempt
      .mockResolvedValueOnce(geminiTextResponse(VALID_ANALYSIS)); // Gemini call (retry): valid

    const { geminiProvider } = await import("@/lib/ai/gemini");
    const result = await geminiProvider.analyzeImage("https://res.cloudinary.com/demo/image.jpg", context);
    expect(result.data.activity).toBe("tree planting");
    expect(fetchMock).toHaveBeenCalledTimes(4); // 2 image fetches + 2 Gemini calls
  });

  it("fails after retry exhaustion when both attempts are schema-invalid", async () => {
    const invalid = { description: "still missing required fields" };

    fetchMock
      .mockResolvedValueOnce(IMAGE_FETCH_OK)
      .mockResolvedValueOnce(geminiTextResponse(invalid))
      .mockResolvedValueOnce(IMAGE_FETCH_OK)
      .mockResolvedValueOnce(geminiTextResponse(invalid));

    const { geminiProvider } = await import("@/lib/ai/gemini");
    await expect(geminiProvider.analyzeImage("https://res.cloudinary.com/demo/image.jpg", context)).rejects.toThrow(
      /failed schema validation twice/
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("treats an empty/insufficient analysis (empty required strings) as schema-invalid", async () => {
    const empty = { ...VALID_ANALYSIS, observedSummary: "", interpretationSummary: "" };

    fetchMock
      .mockResolvedValueOnce(IMAGE_FETCH_OK)
      .mockResolvedValueOnce(geminiTextResponse(empty))
      .mockResolvedValueOnce(IMAGE_FETCH_OK)
      .mockResolvedValueOnce(geminiTextResponse(empty));

    const { geminiProvider } = await import("@/lib/ai/gemini");
    await expect(geminiProvider.analyzeImage("https://res.cloudinary.com/demo/image.jpg", context)).rejects.toThrow();
  });
});
