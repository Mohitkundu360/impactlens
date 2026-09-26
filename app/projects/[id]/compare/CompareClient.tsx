"use client";

import { useEffect, useState } from "react";
import EvidencePanel from "@/components/EvidencePanel";

interface MediaOption {
  id: string;
  cloudinarySecureUrl: string;
  phase: string;
  activityLabel: string | null;
  capturedAt: string | null;
}

interface ComparisonResult {
  id: string;
  beforeMediaId: string;
  afterMediaId: string;
  observedSummary: string | null;
  interpretationSummary: string | null;
  disclaimer: string;
  modelProvider: string | null;
  modelName: string | null;
  generatedAt: string | null;
}

interface ComparisonHistoryItem extends ComparisonResult {
  beforeMedia?: {
    activityLabel: string | null;
    phase: string;
  };
  afterMedia?: {
    activityLabel: string | null;
    phase: string;
  };
}

interface Props {
  projectId: string;
  media: MediaOption[];
}

function label(m: MediaOption) {
  return `${m.phase} · ${m.activityLabel ?? "unlabeled"} · ${m.id.slice(-6)}`;
}

export default function CompareClient({ projectId, media }: Props) {
  /*
   * Before/After semantics are intentional:
   * - BEFORE assets can only be selected as Before.
   * - AFTER assets can only be selected as After.
   * - UNSPECIFIED assets are not silently treated as either phase.
   */
  const beforeCandidates = media.filter((m) => m.phase === "BEFORE");
  const afterCandidates = media.filter((m) => m.phase === "AFTER");

  const [beforeId, setBeforeId] = useState(beforeCandidates[0]?.id ?? "");
  const [afterId, setAfterId] = useState(afterCandidates[0]?.id ?? "");

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [history, setHistory] = useState<ComparisonHistoryItem[]>([]);

  /*
   * Keep the selected IDs valid if the media prop changes.
   * This prevents stale selections after a new asset is uploaded,
   * reclassified, or removed.
   */
  useEffect(() => {
  const beforeCandidates = media.filter((m) => m.phase === "BEFORE");
  const afterCandidates = media.filter((m) => m.phase === "AFTER");

  setBeforeId((current) => {
    if (beforeCandidates.some((m) => m.id === current)) {
      return current;
    }

    return beforeCandidates[0]?.id ?? "";
  });

  setAfterId((current) => {
    if (afterCandidates.some((m) => m.id === current)) {
      return current;
    }

    return afterCandidates[0]?.id ?? "";
  });
}, [media]);

  /*
   * Load previous comparisons for this project.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const res = await fetch(`/api/compare?projectId=${projectId}`);

        if (!res.ok) {
          throw new Error("Failed to load previous comparisons.");
        }

        const data = await res.json();

        if (!cancelled) {
          setHistory(data.comparisons ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error
              ? err.message
              : "Failed to load previous comparisons."
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [projectId, result]);

  async function handleCompare() {
    if (!beforeId || !afterId || beforeId === afterId) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          beforeMediaId: beforeId,
          afterMediaId: afterId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));

        setError(body.error ?? "Comparison failed.");
        return;
      }

      const data = await res.json();

      if (!data.comparison) {
        setError("Comparison completed but returned no result.");
        return;
      }

      setResult(data.comparison);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the comparison service."
      );
    } finally {
      setLoading(false);
    }
  }

  const beforeMedia = media.find((m) => m.id === beforeId);
  const afterMedia = media.find((m) => m.id === afterId);

  /*
   * A valid Before/After comparison requires one asset in each phase.
   * Two BEFORE images are not sufficient.
   */
  if (beforeCandidates.length === 0 || afterCandidates.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">
          Before/After comparison is not ready
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          This comparison requires at least one analyzed BEFORE photo and one
          analyzed AFTER photo.
        </p>

        <div className="mt-4 flex flex-col gap-2 text-xs text-slate-500">
          <p>
            <span className="font-medium text-slate-700">BEFORE:</span>{" "}
            {beforeCandidates.length > 0
              ? `${beforeCandidates.length} available`
              : "No BEFORE evidence available"}
          </p>

          <p>
            <span className="font-medium text-slate-700">AFTER:</span>{" "}
            {afterCandidates.length > 0
              ? `${afterCandidates.length} available`
              : "No AFTER evidence available"}
          </p>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Upload and analyze evidence for the missing phase before comparing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Selection controls */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label
            htmlFor="before-media"
            className="mb-1 block text-xs text-slate-500"
          >
            Before
          </label>

          <select
            id="before-media"
            className="w-full rounded border border-slate-300 px-2 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            value={beforeId}
            onChange={(e) => {
              setBeforeId(e.target.value);
              setResult(null);
              setError(null);
            }}
            disabled={loading}
          >
            {beforeCandidates.map((m) => (
              <option key={m.id} value={m.id}>
                {label(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="after-media"
            className="mb-1 block text-xs text-slate-500"
          >
            After
          </label>

          <select
            id="after-media"
            className="w-full rounded border border-slate-300 px-2 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            value={afterId}
            onChange={(e) => {
              setAfterId(e.target.value);
              setResult(null);
              setError(null);
            }}
            disabled={loading}
          >
            {afterCandidates.map((m) => (
              <option key={m.id} value={m.id}>
                {label(m)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleCompare}
          disabled={loading || !beforeId || !afterId || beforeId === afterId}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Comparing…" : "Compare"}
        </button>
      </div>

      {/* Comparison error */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Selected media */}
      {beforeMedia && afterMedia && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { media: beforeMedia, tag: "Before" },
            { media: afterMedia, tag: "After" },
          ].map(({ media: selectedMedia, tag }) => (
            <div
              key={`${tag}-${selectedMedia.id}`}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <div className="aspect-video bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedMedia.cloudinarySecureUrl}
                  alt={`${tag} evidence`}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex items-center justify-between p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-500">
                    {tag}
                  </span>

                  <span className="text-xs text-slate-400">
                    {selectedMedia.activityLabel ?? "Unlabeled"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setEvidenceId(selectedMedia.id)}
                  className="text-xs text-slate-400 underline hover:text-slate-700"
                >
                  View source
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison result */}
      {result && (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Observed
            </p>

            <p className="text-sm leading-6 text-slate-800">
              {result.observedSummary ?? "No observed summary available."}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
              AI Interpretation
            </p>

            <p className="text-sm leading-6 text-slate-800">
              {result.interpretationSummary ??
                "No AI interpretation available."}
            </p>
          </div>

          <p className="border-t border-slate-200 pt-2 text-xs italic text-slate-400">
            {result.disclaimer}
          </p>

          <p className="text-xs text-slate-400">
            {result.modelProvider ?? "AI provider unavailable"} ·{" "}
            {result.modelName ?? "Model unavailable"} ·{" "}
            {result.generatedAt
              ? new Date(result.generatedAt).toLocaleString()
              : "Generation time unavailable"}
          </p>
        </div>
      )}

      {/* Previous comparisons */}
      <div>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
          Previous comparisons
        </h3>

        {historyLoading && (
          <p className="text-sm text-slate-400">
            Loading previous comparisons…
          </p>
        )}

        {!historyLoading && historyError && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            {historyError}
          </div>
        )}

        {!historyLoading && !historyError && history.length === 0 && (
          <p className="text-sm text-slate-400">
            No previous comparisons for this project.
          </p>
        )}

        {!historyLoading && !historyError && history.length > 0 && (
          <ul className="flex flex-col gap-2">
            {history.map((comparison) => (
              <li key={comparison.id}>
                <button
                  type="button"
                  onClick={() => {
                    setBeforeId(comparison.beforeMediaId);
                    setAfterId(comparison.afterMediaId);
                    setResult(comparison);
                    setError(null);
                  }}
                  className="text-left text-sm text-slate-600 underline hover:text-slate-900"
                >
                  {comparison.beforeMedia?.activityLabel ?? "before"} →{" "}
                  {comparison.afterMedia?.activityLabel ?? "after"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EvidencePanel
        mediaId={evidenceId}
        onClose={() => setEvidenceId(null)}
      />
    </div>
  );
}