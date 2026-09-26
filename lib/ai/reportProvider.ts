import { z } from "zod";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ReportSummarySchema = z.object({
  summary: z.string().min(1)
});

export interface ReportEvidenceItem {
  kind: "media" | "comparison";
  activityOrLabel: string | null;
  observedSummary: string | null;
  interpretationSummary: string | null;
}

export interface ReportContext {
  projectName: string;
  projectType: string;
  locationText?: string | null;
}

export interface ReportSummaryResult {
  summary: string;
  raw: unknown;
  modelProvider: "GEMINI";
  modelName: string;
  generatedAt: Date;
}

/**
 * Pure, regex-based guard against quantitative/scientific impact claims —
 * the kind of thing a prompt can ask a model to avoid but can't guarantee it
 * will. Run on every generated summary before it's ever persisted or shown.
 * Deliberately broad/over-inclusive: a false positive costs a retry, a false
 * negative costs shipping an unsupported claim.
 */
export function checkForImpactClaims(text: string): string[] {
  const issues: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/\d+(\.\d+)?\s?%/g, "percentage figure"],
    [/\b\d+(\.\d+)?\s?(hectares?|acres?|km2|square (meters|metres|feet))\b/gi, "area measurement"],
    [/\b\d+(\.\d+)?\s?(tons?|tonnes?|kg|kilograms?)\b/gi, "mass measurement"],
    [/\bco2\b|\bcarbon (offset|sequestration|capture)\b/gi, "carbon/CO2 claim"],
    [/\bincreased?\s+by\s+\d/gi, "quantified increase"],
    [/\bdecreased?\s+by\s+\d/gi, "quantified decrease"],
    [/\b(proves?|proven|confirms?|guarantees?|succeeded|successful(ly)?|demonstrates?|verified)\b/gi, "certainty claim"],
    [/\b\d+\s+(trees?|saplings?)\s+(planted|were planted)\b/gi, "specific count claim"],
    [
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|dozen|dozens|hundred|hundreds|thousand|thousands)\s+(trees?|saplings?|plants?)\s+(were\s+)?planted\b/gi,
      "specific count claim (spelled out)"
    ],
    [/\b(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+percent\b/gi, "percentage figure (spelled out)"]
  ];

  for (const [pattern, label] of patterns) {
    if (pattern.test(text)) issues.push(label);
  }
  return issues;
}

const SYSTEM_INSTRUCTION = `You write a short narrative summary paragraph (3-5 sentences) for a
sustainability project evidence report, using ONLY the observations provided to you. Respond with
STRICT JSON ONLY: { "summary": string }

Hard rules:
- Use ONLY the "observed" and "interpretation" text given to you as input. Do not invent details,
  do not infer anything beyond what those texts say.
- NEVER state or imply a quantitative measurement of environmental impact: no percentages, areas,
  weights, counts of items planted, carbon/CO2 figures. You are summarizing photo evidence and AI
  interpretations of photos, not reporting measured outcomes.
- NEVER claim the evidence "proves" or "confirms" project success. Use language like "the collected
  evidence suggests" or "photos indicate".
- If the evidence is sparse or mixed, say so plainly rather than papering over it.`;

async function callGemini(prompt: string): Promise<unknown> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const maxAttempts = 3;
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3
        }
      })
    }
  );

  if (res.ok) {
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini returned no content for report summary.");
    }

    return JSON.parse(text);
  }

  const errorText = await res.text();

  if (!retryableStatuses.has(res.status) || attempt === maxAttempts) {
    throw new Error(
      `Gemini report-summary request failed: ${res.status} ${errorText}`
    );
  }

  const delayMs = 2000 * 2 ** (attempt - 1);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
  throw new Error("Gemini report-summary request failed after retries.");
}

function buildPrompt(context: ReportContext, evidence: ReportEvidenceItem[], extraGuard?: string): string {
  const evidenceLines = evidence
    .map((e, i) => {
      const label = e.activityOrLabel ?? (e.kind === "media" ? "unlabeled media" : "comparison");
      return `${i + 1}. [${e.kind}] ${label}\n   Observed: ${e.observedSummary ?? "n/a"}\n   Interpretation: ${e.interpretationSummary ?? "n/a"}`;
    })
    .join("\n");

  return `Project: ${context.projectName} (${context.projectType}).${
    context.locationText ? ` Location: ${context.locationText}.` : ""
  }

Evidence:
${evidenceLines}

Write the summary paragraph now.${extraGuard ? `\n\n${extraGuard}` : ""}`;
}

/**
 * Generates the one AI-written piece of a report: the narrative summary.
 * Everything else in a report (the evidence list itself) is assembled
 * deterministically by the caller from the database — see app/api/reports.
 */
export async function generateReportSummary(
  context: ReportContext,
  evidence: ReportEvidenceItem[]
): Promise<ReportSummaryResult> {
  if (evidence.length === 0) {
    throw new Error("Cannot generate a report summary with no evidence selected.");
  }

  const attempt = async (extraGuard?: string) => {
    const raw = await callGemini(buildPrompt(context, evidence, extraGuard));
    const parsed = ReportSummarySchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Report summary failed schema validation: ${parsed.error.message}`);
    return { raw, summary: parsed.data.summary };
  };

  let { raw, summary } = await attempt();
  let issues = checkForImpactClaims(summary);

  if (issues.length > 0) {
    const retry = await attempt(
      `Your previous draft contained language resembling: ${issues.join(", ")}. Rewrite it with no ` +
        `quantitative claims or certainty language at all — describe only what the evidence shows.`
    );
    raw = retry.raw;
    summary = retry.summary;
    issues = checkForImpactClaims(summary);
    if (issues.length > 0) {
      throw new Error(
        `Report summary still contains unsupported-claim-like language after retry: ${issues.join(", ")}`
      );
    }
  }

  return { summary, raw, modelProvider: "GEMINI", modelName: GEMINI_MODEL, generatedAt: new Date() };
}
