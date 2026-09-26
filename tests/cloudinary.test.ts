import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
});

describe("generateUploadSignature", () => {
  it("produces a signature and echoes back the scoping params", async () => {
    const { generateUploadSignature } = await import("@/lib/cloudinary");

    const result = generateUploadSignature({
      folder: "impactlens/project123",
      context: { project_id: "project123", phase: "BEFORE" },
      tags: ["impactlens", "project123"]
    });

    expect(result.cloudName).toBe("test-cloud");
    expect(result.apiKey).toBe("test-key");
    expect(result.folder).toBe("impactlens/project123");
    expect(result.signature).toBeTruthy();
    expect(typeof result.signature).toBe("string");
    expect(result.context).toBe("project_id=project123|phase=BEFORE");
    expect(result.tags).toBe("impactlens,project123");
  });

  it("throws if Cloudinary credentials are missing", async () => {
    const original = process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_API_SECRET;

    // Config is read live from process.env on every call, so no re-import is needed.
    const { generateUploadSignature } = await import("@/lib/cloudinary");
    expect(() => generateUploadSignature({ folder: "x" })).toThrow(/not configured/i);

    process.env.CLOUDINARY_API_SECRET = original;
  });
});
