import {
  AnalysisContext,
  AnalysisProvider,
  AnalysisProviderResult,
  AnalysisResultSchema
} from "./provider";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_INSTRUCTION = `You are analyzing a single field photo from a sustainability / environmental
restoration project for an evidence-tracking platform. Respond with STRICT JSON ONLY, matching exactly
this shape, no markdown fences, no commentary before or after:

{
  "description": string,
  "activity": string | null,
  "environment": string | null,
  "objects": string[],
  "observations": string[],
  "sustainabilityCategories": string[],
  "confidence": number | null,
  "observedSummary": string,
  "interpretationSummary": string
}

Hard rules:
- Never state or imply a quantitative environmental measurement (percentages, area, counts of trees
  planted, carbon estimates, etc). You are describing a photo, not measuring anything.
- Never claim certainty about outcomes ("this proves", "this confirms"). Use "appears", "is consistent
  with", "suggests".
- observedSummary must contain no inference at all — only literally visible content.
- If the image is unclear or ambiguous, say so in observations rather than guessing specifics.`;

async function callGemini(
  imageUrl: string,
  userPrompt: string
): Promise<unknown> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  // Fetch the image and inline it as base64.
  // This avoids depending on Gemini being able to fetch the Cloudinary URL.
  const imageRes = await fetch(imageUrl);

  if (!imageRes.ok) {
    throw new Error(
      `Failed to fetch source image for analysis: ${imageRes.status}`
    );
  }

  const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await imageRes.arrayBuffer());
  const base64 = buffer.toString("base64");

  // Gemini can temporarily return 408, 429, or 5xx responses.
  // Retry those failures with exponential backoff and small random jitter.
  const maxRetries = 4;
  const baseDelayMs = 1500;

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
                { text: userPrompt },
                {
                  inline_data: {
                    mime_type: contentType,
                    data: base64
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
        throw new Error("Gemini returned no content.");
      }

      return JSON.parse(text);
    }

    const errorBody = await res.text();

    // Retry only transient failures:
    // 408 = request timeout
    // 429 = rate limited
    // 5xx = temporary Gemini/provider failure
    const retryable =
      res.status === 408 ||
      res.status === 429 ||
      res.status >= 500;

    if (!retryable || attempt === maxRetries) {
      throw new Error(
        `Gemini request failed: ${res.status} ${errorBody}`
      );
    }

    const exponentialDelay = baseDelayMs * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 500);
    const delay = exponentialDelay + jitter;

    console.warn(
      `[gemini] Request failed with ${res.status}. ` +
        `Retrying in ${delay}ms ` +
        `(attempt ${attempt + 1}/${maxRetries})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error("Gemini request failed after maximum retries.");
}

export class GeminiAnalysisProvider implements AnalysisProvider {
  async analyzeImage(
    imageUrl: string,
    context: AnalysisContext
  ): Promise<AnalysisProviderResult> {
    const prompt = `Project: ${context.projectName} (${context.projectType}). Media phase: ${context.phase}.${
      context.locationText ? ` Location: ${context.locationText}.` : ""
    } Analyze this field photo.`;

    let raw: unknown;

    try {
      raw = await callGemini(imageUrl, prompt);
    } catch (err) {
      throw new Error(
        `Gemini analysis failed: ${(err as Error).message}`
      );
    }

    // Strict validation — malformed output is never silently persisted.
    // If the first response does not match the schema, make one additional
    // request with a stricter JSON instruction.
    const parsed = AnalysisResultSchema.safeParse(raw);

    if (!parsed.success) {
      const retryRaw = await callGemini(
        imageUrl,
        `${prompt}

Your previous response did not match the required JSON schema exactly.
Return ONLY valid JSON matching the schema, with no extra fields and no missing fields.`
      );

      const retryParsed = AnalysisResultSchema.safeParse(retryRaw);

      if (!retryParsed.success) {
        throw new Error(
          `Gemini output failed schema validation twice: ${retryParsed.error.message}`
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
}

export const geminiProvider = new GeminiAnalysisProvider();
