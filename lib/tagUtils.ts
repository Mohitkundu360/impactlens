/** Normalizes a candidate tag string into a stable, deduped tag name. */
export function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Builds the deduped set of tag names to attach from an analysis result. */
export function buildTagNames(data: {
  activity: string | null;
  objects: string[];
  sustainabilityCategories: string[];
}): string[] {
  const candidates = [
    ...(data.activity ? [data.activity] : []),
    ...data.objects,
    ...data.sustainabilityCategories
  ];
  const seen = new Set<string>();
  for (const c of candidates) {
    const normalized = normalizeTagName(c);
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}
