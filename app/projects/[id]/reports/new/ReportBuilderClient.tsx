"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MediaOption {
  id: string;
  cloudinarySecureUrl: string;
  phase: string;
  activityLabel: string | null;
  resourceType: string;
}

interface ComparisonOption {
  id: string;
  beforeMedia: { cloudinarySecureUrl: string; activityLabel: string | null };
  afterMedia: { cloudinarySecureUrl: string; activityLabel: string | null };
}

interface Props {
  projectId: string;
  media: MediaOption[];
  comparisons: ComparisonOption[];
}

export default function ReportBuilderClient({ projectId, media, comparisons }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [selectedComparisons, setSelectedComparisons] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  async function handleGenerate() {
  if (!title.trim()) {
    setError("Give the report a title.");
    return;
  }

  if (selectedMedia.size === 0 && selectedComparisons.size === 0) {
    setError("Select at least one media asset or comparison.");
    return;
  }

  setGenerating(true);
  setError(null);

  try {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        mediaIds: [...selectedMedia],
        comparisonIds: [...selectedComparisons]
      })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Report generation failed.");
      return;
    }

    const data = await res.json();
    router.push(`/reports/${data.report.id}`);
  } catch {
    setError(
      "Could not reach the report service. Check your connection and try again."
    );
  } finally {
    setGenerating(false);
  }
}
  return (
    <div className="flex flex-col gap-6">
      <input
        className="border border-slate-300 rounded px-3 py-2 text-sm"
        placeholder="Report title (e.g. Odisha Mangrove Restoration — Q1 2026 Evidence)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div>
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
          Media ({selectedMedia.size} selected)
        </h2>
        {media.length === 0 ? (
          <p className="text-sm text-slate-400">No analyzed media in this project yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {media.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(selectedMedia, setSelectedMedia, m.id)}
                className={`relative aspect-square rounded overflow-hidden border-2 ${
                  selectedMedia.has(m.id) ? "border-slate-900" : "border-transparent"
                }`}
              >
                {m.resourceType === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.cloudinarySecureUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                    Video
                  </div>
                )}
                {selectedMedia.has(m.id) && (
                  <span className="absolute top-1 right-1 bg-slate-900 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {comparisons.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
            Comparisons ({selectedComparisons.size} selected)
          </h2>
          <div className="flex flex-col gap-2">
            {comparisons.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(selectedComparisons, setSelectedComparisons, c.id)}
                className={`flex gap-2 items-center border rounded-lg p-2 text-left ${
                  selectedComparisons.has(c.id) ? "border-slate-900" : "border-slate-200"
                }`}
              >
                <div className="flex gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.beforeMedia.cloudinarySecureUrl} alt="" className="w-12 h-12 object-cover rounded" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.afterMedia.cloudinarySecureUrl} alt="" className="w-12 h-12 object-cover rounded" />
                </div>
                <span className="text-xs text-slate-600">
                  {c.beforeMedia.activityLabel ?? "before"} → {c.afterMedia.activityLabel ?? "after"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="self-start bg-slate-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate report"}
      </button>
    </div>
  );
}
