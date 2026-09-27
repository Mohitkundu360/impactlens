"use client";

import { useEffect, useState } from "react";
import type { MediaSummary, MediaStatus } from "@/lib/types";
import EvidencePanel from "@/components/EvidencePanel";

const STATUS_STYLES: Record<MediaStatus, string> = {
  UPLOADED: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-amber-100 text-amber-700",
  ANALYZED: "bg-blue-100 text-blue-700",
  INDEXED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700"
};

const PENDING_STATUSES: MediaStatus[] = ["UPLOADED", "PROCESSING"];
const POLL_MS = 4000;
const PHASE_OPTIONS = ["ALL", "BEFORE", "DURING", "AFTER", "UNSPECIFIED"] as const;
const TYPE_OPTIONS = ["ALL", "IMAGE", "VIDEO"] as const;

interface Props {
  projectId: string;
  initialMedia: MediaSummary[];
}

export default function MediaGrid({ projectId, initialMedia }: Props) {
  const [media, setMedia] = useState<MediaSummary[]>(initialMedia);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [updatingPhase, setUpdatingPhase] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<(typeof PHASE_OPTIONS)[number]>("ALL");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_OPTIONS)[number]>("ALL");
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  useEffect(() => {
    const hasPending = media.some((m) => PENDING_STATUSES.includes(m.status));
    if (!hasPending) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setMedia(data.media);
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [media, projectId]);

  async function handleRetry(id: string) {
  setRetrying(id);

  try {
    const retryRes = await fetch(`/api/media/${id}/retry`, {
      method: "POST"
    });

    if (!retryRes.ok) {
      const body = await retryRes.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to retry media.");
    }

    setMedia((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "UPLOADED" } : m))
    );

    const processRes = await fetch("/api/jobs/process", {
      method: "POST"
    });

    if (!processRes.ok) {
      console.warn(`Processing could not start for media ${id}.`);
    }
  } catch (error) {
    console.error("Failed to retry media:", error);
  } finally {
    setRetrying(null);
  }
}

  if (media.length === 0) {
    return <p className="text-slate-400 text-sm">No media uploaded yet.</p>;
  }

  const visibleMedia = media.filter(
    (m) => (phaseFilter === "ALL" || m.phase === phaseFilter) && (typeFilter === "ALL" || m.resourceType === typeFilter)
  );
async function handlePhaseChange(id: string, phase: MediaSummary["phase"]) {
  setUpdatingPhase(id);

  try {
    const res = await fetch(`/api/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to update media phase.");
    }

    setMedia((prev) =>
      prev.map((m) => (m.id === id ? { ...m, phase } : m))
    );
  } catch (error) {
    console.error("Failed to update media phase:", error);
  } finally {
    setUpdatingPhase(null);
  }
}
  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          className="border border-slate-300 rounded px-2 py-1 text-xs"
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value as (typeof PHASE_OPTIONS)[number])}
        >
          {PHASE_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === "ALL" ? "All phases" : p}
            </option>
          ))}
        </select>
        <select
          className="border border-slate-300 rounded px-2 py-1 text-xs"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as (typeof TYPE_OPTIONS)[number])}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === "ALL" ? "All types" : t}
            </option>
          ))}
        </select>
        {visibleMedia.length !== media.length && (
          <span className="text-xs text-slate-400 self-center">
            {visibleMedia.length} of {media.length}
          </span>
        )}
      </div>

      {visibleMedia.length === 0 ? (
        <p className="text-slate-400 text-sm">No media matches these filters.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visibleMedia.map((m) => (
        <div key={m.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => m.status === "INDEXED" && setEvidenceId(m.id)}
                className="aspect-square bg-slate-100 relative w-full block"
              >
                {m.resourceType === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.cloudinarySecureUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                    Video
                  </div>
                )}
              </button>
              <div className="p-2 flex flex-col gap-1">
                <span
                  className={`self-start text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[m.status]}`}
                >
                  {m.status}
                </span>
                <span className="text-xs text-slate-500 truncate">
                  {m.activityLabel ?? (m.status === "INDEXED" ? "No activity detected" : "—")}
                </span>
                <select
  value={m.phase}
  disabled={updatingPhase === m.id}
  onChange={(e) =>
    handlePhaseChange(
      m.id,
      e.target.value as MediaSummary["phase"]
    )
  }
  className="text-[11px] border border-slate-200 rounded px-1.5 py-1 text-slate-500 bg-white disabled:opacity-50"
>
  <option value="BEFORE">BEFORE</option>
  <option value="DURING">DURING</option>
  <option value="AFTER">AFTER</option>
  <option value="UNSPECIFIED">UNSPECIFIED</option>
</select>
                {m.status === "FAILED" && (
                  <button
                    onClick={() => handleRetry(m.id)}
                    disabled={retrying === m.id}
                    className="mt-1 text-xs text-white bg-slate-900 rounded px-2 py-1 disabled:opacity-50"
                  >
                    {retrying === m.id ? "Retrying…" : "Retry"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <EvidencePanel mediaId={evidenceId} onClose={() => setEvidenceId(null)} />
    </div>
  );
}
