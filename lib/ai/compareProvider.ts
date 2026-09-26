import { z } from "zod";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Same two-field discipline as single-image analysis (lib/ai/provider.ts):
 * observedSummary holds only visible differences, interpretationSummary
 * holds inference. No field exists here for a quantitative claim either.
 */
export const ComparisonResultSchema = z.object({
  observedSummary: z.string().min(1),
  interpretationSummary: z.string().min(1)
});

export type ComparisonResultData = z.infer<typeof ComparisonResultSchema>;

export interface ComparisonProviderResult {
  data: ComparisonResultData;
  raw: unknown;
  modelProvider: "GEMINI";
  modelName: string;
  generatedAt: Date;
}

export interface ComparisonContext {
  projectName: string;
  projectType: string;
  beforeLabel?: string | null;
  afterLabel?: string | null;
}

const SYSTEM_INSTRUCTION = `You are comparing two field photos from a sustainability/environmental
restoration project — a "before" photo and an "after" photo of approximately the same location.
Respond with STRICT JSON ONLY, no markdown fences, no commentary:

{
  "observedSummary": string,
  "interpretationSummary": string
}

Hard rules:
- observedSummary must contain ONLY visible differences between the two images. No inference.
- interpretationSummary must contain inference about what the visible change suggests.
- Never state or imply a quantitative measurement (percentage change, area, counts, carbon/biomass
  estimates). You are comparing two photos, not measuring anything.
- Never claim certainty about environmental outcomes ("this proves", "this confirms the project
  succeeded"). Use "appears", "is consistent with", "suggests".
- If the two images don't show a comparable location or the difference is unclear, say so plainly
  in observedSummary rather than inventing a change.
- Do not use activity labels as evidence if they conflict with what is visibly shown in the images.
- Describe people, vegetation, water, soil, structures, and other visible features accurately.
`;

async function fetchAsBase64(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch comparison image: ${res.status}`);
  }

  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());

  return {
    base64: buffer.toString("base64"),
    mimeType
  };
}

async function callGemini(
  beforeUrl: string,
  afterUrl: string,
  prompt: string
): Promise<unknown> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const [before, after] = await Promise.all([
    fetchAsBase64(beforeUrl),
    fetchAsBase64(afterUrl)
  ]);

  const maxRetries = 4;
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          contents: [
            {
              parts: [
                {
                  text: `${prompt}

Image 1 is BEFORE.
Image 2 is AFTER.`
                },
                {
                  inline_data: {
                    mime_type: before.mimeType,
                    data: before.base64
                  }
                },
                {
                  inline_data: {
                    mime_type: after.mimeType,
                    data: after.base64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      }
    );

    if (res.ok) {
      const data = await res.json();

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("Gemini returned no content for comparison.");
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Gemini returned invalid JSON for comparison.");
      }
    }

    const errorText = await res.text();

    if (!retryableStatuses.has(res.status) || attempt === maxRetries) {
      throw new Error(
        `Gemini comparison request failed: ${res.status} ${errorText}`
      );
    }

    const baseDelay = 1500 * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 500);
    const delay = baseDelay + jitter;

    console.warn(
      `[gemini] comparison request returned ${res.status}; ` +
        `retrying in ${delay}ms ` +
        `(attempt ${attempt + 1}/${maxRetries})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error("Gemini comparison request failed after retries.");
}

export async function compareImages(
  beforeUrl: string,
  afterUrl: string,
  context: ComparisonContext
): Promise<ComparisonProviderResult> {
  const prompt = `Project: ${context.projectName} (${context.projectType}).${
    context.beforeLabel
      ? ` Before image activity: ${context.beforeLabel}.`
      : ""
  }${
    context.afterLabel
      ? ` After image activity: ${context.afterLabel}.`
      : ""
  }

Compare these two photos.`;

  let raw: unknown;

  try {
    raw = await callGemini(beforeUrl, afterUrl, prompt);
  } catch (err) {
    throw new Error(
      `Gemini comparison failed: ${(err as Error).message}`
    );
  }

  const parsed = ComparisonResultSchema.safeParse(raw);

  if (!parsed.success) {
    const retryRaw = await callGemini(
      beforeUrl,
      afterUrl,
      `${prompt}

Your previous response did not match the required JSON schema.
Return ONLY valid JSON matching the schema exactly.`
    );

    const retryParsed = ComparisonResultSchema.safeParse(retryRaw);

    if (!retryParsed.success) {
      throw new Error(
        `Gemini comparison output failed schema validation twice: ${retryParsed.error.message}`
      );
    }

    return {
      data: retryParsed.data,
      raw: retryRaw,
      modelProvider: "GEMINI",
      modelName: GEMINI_MODEL,
      generatedAt: new Date()
    };
  }

  return {
    data: parsed.data,
    raw,
    modelProvider: "GEMINI",
    modelName: GEMINI_MODEL,
    generatedAt: new Date()
  };
}