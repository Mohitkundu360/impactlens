"use client";

import { useEffect, useState } from "react";

interface EvidenceData {
  media: {
    id: string;
    cloudinaryPublicId: string;
    cloudinarySecureUrl: string;
    resourceType: "IMAGE" | "VIDEO";
    phase: string;
    capturedAt: string | null;
    locationText: string | null;
    status: string;
    project: { id: string; name: string; locationText: string | null; projectType: string };
  };
  analysis: {
    observedSummary: string;
    interpretationSummary: string;
    activity: string | null;
    objects: string[];
    confidence: number | null;
    modelProvider: string;
    modelName: string;
    modelVersion: string | null;
    generatedAt: string;
  } | null;
  videoScenes: Array<{ startSeconds: number; endSeconds: number; description: string }>;
}

interface Props {
  mediaId: string | null;
  onClose: () => void;
}

/**
 * Renders as a right-side drawer overlay. mediaId === null means closed —
 * callers just set/clear the id they want to inspect, no separate open flag.
 */
export default function EvidencePanel({ mediaId, onClose }: Props) {
  const [data, setData] = useState<EvidenceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mediaId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/media/${mediaId}/evidence`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [mediaId]);

  if (!mediaId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Source Evidence</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-sm">
            Close ✕
          </button>
        </div>

        {loading && <p className="text-sm text-slate-400">Loading…</p>}

        {data && (
          <div className="flex flex-col gap-5">
            <div className="aspect-video bg-slate-100 rounded overflow-hidden">
              {data.media.resourceType === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.media.cloudinarySecureUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <video src={data.media.cloudinarySecureUrl} controls className="w-full h-full" />
              )}
            </div>

            {data.analysis ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Observed</p>
                  <p className="text-sm text-slate-800">{data.analysis.observedSummary}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">AI Interpretation</p>
                  <p className="text-sm text-slate-800">{data.analysis.interpretationSummary}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No analysis yet for this asset.</p>
            )}

            {data.videoScenes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Video scenes</p>
                <ul className="text-sm text-slate-700 flex flex-col gap-1">
                  {data.videoScenes.map((s, i) => (
                    <li key={i}>
                      <span className="text-slate-400 text-xs">
                        {Math.round(s.startSeconds)}s–{Math.round(s.endSeconds)}s
                      </span>{" "}
                      {s.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-slate-200 pt-3 text-xs text-slate-500 flex flex-col gap-1">
              <p>
                <span className="font-medium text-slate-700">Project:</span> {data.media.project.name}
              </p>
              <p>
                <span className="font-medium text-slate-700">Phase:</span> {data.media.phase}
              </p>
              <p>
                <span className="font-medium text-slate-700">Cloudinary asset:</span>{" "}
                <code className="bg-slate-100 px-1 rounded">{data.media.cloudinaryPublicId}</code>
              </p>
              {data.analysis && (
                <>
                  <p>
                    <span className="font-medium text-slate-700">Model:</span> {data.analysis.modelProvider} ·{" "}
                    {data.analysis.modelName}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">Generated:</span>{" "}
                    {new Date(data.analysis.generatedAt).toLocaleString()}
                  </p>
                  {data.analysis.confidence != null && (
                    <p>
                      <span className="font-medium text-slate-700">Confidence:</span>{" "}
                      {Math.round(data.analysis.confidence * 100)}%
                    </p>
                  )}
                </>
              )}
              <p className="italic text-slate-400 pt-1">
                AI observation of visible content, not a verified measurement.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
