"use client";

import { useState } from "react";

interface SearchResultItem {
  id: string;
  projectId: string;
  projectName: string;
  cloudinarySecureUrl: string;
  resourceType: "IMAGE" | "VIDEO";
  phase: string;
  activityLabel: string | null;
  observedSummary: string | null;
  interpretationSummary: string | null;
}

interface ResolvedFilter {
  keywords: string[];
  activity: string | null;
  phase: string | null;
  mediaType: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const PHASES = ["", "BEFORE", "DURING", "AFTER", "UNSPECIFIED"];
const MEDIA_TYPES = ["", "IMAGE", "VIDEO"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query || undefined,
        filters: {
          ...(phase ? { phase } : {}),
          ...(mediaType ? { mediaType } : {})
        }
      })
    });

    setLoading(false);
    if (!res.ok) return;

    const data = await res.json();
    setResolvedFilter(data.resolvedFilter);
    setUsedFallback(data.usedFallback);
    setResults(data.results);
  }

  return (
    <main className="max-w-5xl mx-auto py-12 px-4">
      <a href="/" className="text-sm text-slate-400 hover:text-slate-600">
        ← All projects
      </a>
      <h1 className="text-2xl font-semibold mt-2 mb-1">AI Search</h1>
      <p className="text-slate-500 mb-6">
        Describe what you&apos;re looking for, across every project&apos;s analyzed media.
      </p>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <input
          className="border border-slate-300 rounded px-3 py-2 text-sm"
          placeholder='e.g. "Show evidence of tree planting and community participation"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-3">
          <select className="border border-slate-300 rounded px-3 py-2 text-sm" value={phase} onChange={(e) => setPhase(e.target.value)}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p || "Any phase"}
              </option>
            ))}
          </select>
          <select
            className="border border-slate-300 rounded px-3 py-2 text-sm"
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
          >
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || "Any type"}
              </option>
            ))}
          </select>
          <button type="submit" disabled={loading} className="bg-slate-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50">
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {resolvedFilter && (
        <div className="mb-6 text-sm text-slate-500">
          <span className="font-medium text-slate-700">Understood as:</span>{" "}
          {[
            resolvedFilter.activity && `activity: "${resolvedFilter.activity}"`,
            resolvedFilter.phase && `phase: ${resolvedFilter.phase}`,
            resolvedFilter.mediaType && `type: ${resolvedFilter.mediaType}`,
            resolvedFilter.dateFrom && `from: ${resolvedFilter.dateFrom}`,
            resolvedFilter.dateTo && `to: ${resolvedFilter.dateTo}`,
            resolvedFilter.keywords.length > 0 && `keywords: ${resolvedFilter.keywords.join(", ")}`
          ]
            .filter(Boolean)
            .join(" · ") || "no specific filters (showing recent analyzed media)"}
          {usedFallback && (
            <span className="ml-2 text-amber-600">(keyword fallback — AI parsing unavailable)</span>
          )}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-slate-400 text-sm">No matching media found.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {results.map((r) => (
          <a
            key={r.id}
            href={`/projects/${r.projectId}`}
            className="border border-slate-200 rounded-lg overflow-hidden bg-white block hover:border-slate-400 transition-colors"
          >
            <div className="aspect-square bg-slate-100">
              {r.resourceType === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.cloudinarySecureUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Video</div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium truncate">{r.activityLabel ?? "Untitled"}</p>
              <p className="text-[11px] text-slate-400 truncate">{r.projectName} · {r.phase}</p>
              {r.observedSummary && (
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.observedSummary}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
