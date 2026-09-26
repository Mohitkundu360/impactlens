import { EMPTY_FILTER, StructuredFilter, StructuredFilterSchema } from "./types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "for", "with", "and", "or",
  "show", "find", "search", "display", "give", "me", "please", "some",
  "evidence", "media", "images", "image", "photos", "photo", "videos", "video",
  "of", "from", "related", "to", "all", "any"
]);

/**
 * Zero-dependency, deterministic fallback: no LLM, no network. Used whenever
 * Gemini is unavailable, misconfigured, or returns something that fails
 * schema validation — search must never go fully offline.
 *
 * Extracts a couple of structural signals via plain keyword matching
 * (phase, media type) and treats everything else as free-text keywords.
 */
export function naiveFallbackParse(query: string): StructuredFilter {
  const lower = query.toLowerCase();

  let phase: StructuredFilter["phase"] = null;
  if (/\bbefore\b/.test(lower)) phase = "BEFORE";
  else if (/\bafter\b/.test(lower)) phase = "AFTER";
  else if (/\bduring\b/.test(lower)) phase = "DURING";

  let mediaType: StructuredFilter["mediaType"] = null;
  if (/\bvideos?\b/.test(lower)) mediaType = "VIDEO";
  else if (/\b(photos?|images?|pictures?)\b/.test(lower)) mediaType = "IMAGE";

  const keywords = lower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  return { ...EMPTY_FILTER, phase, mediaType, keywords: [...new Set(keywords)] };
}

const SYSTEM_INSTRUCTION = `You convert a natural-language search query for a sustainability media
evidence platform into a structured filter. Respond with STRICT JSON ONLY matching exactly this shape,
no markdown fences, no commentary:

{
  "keywords": string[],      // free-text terms to match against descriptions/tags, empty array if none
  "activity": string | null, // a specific activity if clearly named, e.g. "tree planting"
  "phase": "BEFORE" | "DURING" | "AFTER" | "UNSPECIFIED" | null,
  "mediaType": "IMAGE" | "VIDEO" | null,
  "dateFrom": string | null, // ISO date "YYYY-MM-DD" if a start date is implied, else null
  "dateTo": string | null    // ISO date "YYYY-MM-DD" if an end date is implied, else null
}

Only extract what is clearly stated or clearly implied (e.g. "after March 2026" -> dateFrom
"2026-03-01"). Do not guess dates or activities that aren't reasonably implied by the query.`;

async function callGeminiForFilter(query: string): Promise<unknown> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts: [{ text: `Query: "${query}"` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 }
      })
    }
  );

  if (!res.ok) throw new Error(`Gemini filter-parse request failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content for filter parsing.");
  return JSON.parse(text);
}

export interface ParseResult {
  filter: StructuredFilter;
  usedFallback: boolean;
  fallbackReason?: string;
}

/**
 * The one function API routes call. Always resolves — never throws — because
 * search must degrade gracefully to the deterministic keyword path rather
 * than fail outright.
 */
export async function parseQuery(query: string): Promise<ParseResult> {
  const trimmed = query.trim();
  if (!trimmed) return { filter: EMPTY_FILTER, usedFallback: false };

  try {
    const raw = await callGeminiForFilter(trimmed);
    const parsed = StructuredFilterSchema.safeParse(raw);
    if (!parsed.success) {
      return { filter: naiveFallbackParse(trimmed), usedFallback: true, fallbackReason: "schema_validation_failed" };
    }
    return { filter: parsed.data, usedFallback: false };
  } catch (err) {
    return {
      filter: naiveFallbackParse(trimmed),
      usedFallback: true,
      fallbackReason: (err as Error).message
    };
  }
}
