import { describe, expect, it } from "vitest";
import { optimizedImageUrl, withCloudinaryTransform } from "@/lib/cloudinaryUrl";

const SAMPLE_URL = "https://res.cloudinary.com/demo-cloud/image/upload/v1700000000/impactlens/proj1/photo.jpg";

describe("withCloudinaryTransform", () => {
  it("inserts the transformation right after /upload/", () => {
    expect(withCloudinaryTransform(SAMPLE_URL, "f_auto,q_auto")).toBe(
      "https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/v1700000000/impactlens/proj1/photo.jpg"
    );
  });

  it("returns the URL unchanged if it doesn't look like a Cloudinary delivery URL", () => {
    const other = "https://example.com/some/image.jpg";
    expect(withCloudinaryTransform(other, "f_auto,q_auto")).toBe(other);
  });
});

describe("optimizedImageUrl", () => {
  it("applies f_auto and q_auto by default", () => {
    const result = optimizedImageUrl(SAMPLE_URL);
    expect(result).toContain("/upload/f_auto,q_auto/");
  });

  it("adds a width cap when requested", () => {
    const result = optimizedImageUrl(SAMPLE_URL, { width: 400 });
    expect(result).toContain("/upload/f_auto,q_auto,w_400/");
  });

  it("still returns a usable (unchanged) URL for a non-Cloudinary source", () => {
    const other = "https://example.com/some/image.jpg";
    expect(optimizedImageUrl(other)).toBe(other);
  });
});
