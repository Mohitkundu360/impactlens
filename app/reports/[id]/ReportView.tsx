"use client";

import { useState } from "react";
import EvidencePanel from "@/components/EvidencePanel";

interface Props {
  report: {
    id: string;
    title: string;
    summary: string;
    generatedAt: string;
    project: { id: string; name: string; locationText: string | null; projectType: string };
    media: Array<{
      mediaAsset: {
        id: string;
        cloudinarySecureUrl: string;
        phase: string;
        activityLabel: string | null;
        analysis: { observedSummary: string; interpretationSummary: string } | null;
      };
    }>;
    comparisons: Array<{
      comparisonPair: {
        id: string;
        observedSummary: string | null;
        interpretationSummary: string | null;
        disclaimer: string;
        beforeMedia: { id: string; cloudinarySecureUrl: string; activityLabel: string | null };
        afterMedia: { id: string; cloudinarySecureUrl: string; activityLabel: string | null };
      };
    }>;
  };
}

export default function ReportView({ report }: Props) {
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <a href={`/projects/${report.project.id}`} className="text-sm text-slate-400 hover:text-slate-600">
        ← {report.project.name}
      </a>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{report.title}</h1>
      <p className="text-slate-500 mb-8">
        {report.project.name} · {report.project.locationText ?? "No location set"} ·{" "}
        {new Date(report.generatedAt).toLocaleDateString()}
      </p>

      <section className="mb-10 bg-white border border-slate-200 rounded-lg p-5">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
          AI-generated interpretation
        </p>
        <p className="text-sm text-slate-800 leading-relaxed">{report.summary}</p>
        <p className="text-xs italic text-slate-400 mt-3 border-t border-slate-200 pt-2">
          Written from the observed evidence below. Not a measured or verified environmental outcome.
        </p>
      </section>

      {report.media.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Observed evidence — media ({report.media.length})
          </h2>
          <div className="flex flex-col gap-3">
            {report.media.map(({ mediaAsset: m }) => (
              <div key={m.id} className="flex gap-3 bg-white border border-slate-200 rounded-lg p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.cloudinarySecureUrl} alt="" className="w-20 h-20 object-cover rounded flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 mb-1">
                    {m.phase} · {m.activityLabel ?? "unlabeled"}
                  </p>
                  {m.analysis ? (
                    <>
                      <p className="text-sm text-slate-800">{m.analysis.observedSummary}</p>
                      <p className="text-xs text-slate-500 mt-1">{m.analysis.interpretationSummary}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No analysis available.</p>
                  )}
                </div>
                <button
                  onClick={() => setEvidenceId(m.id)}
                  className="text-xs text-slate-400 hover:text-slate-700 underline self-start flex-shrink-0"
                >
                  View source
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.comparisons.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Observed evidence — before / after ({report.comparisons.length})
          </h2>
          <div className="flex flex-col gap-3">
            {report.comparisons.map(({ comparisonPair: c }) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex gap-2 mb-2">
                  <div className="flex-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.beforeMedia.cloudinarySecureUrl} alt="" className="w-full aspect-video object-cover rounded" />
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-slate-400">Before</span>
                      <button
                        onClick={() => setEvidenceId(c.beforeMedia.id)}
                        className="text-xs text-slate-400 hover:text-slate-700 underline"
                      >
                        View source
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.afterMedia.cloudinarySecureUrl} alt="" className="w-full aspect-video object-cover rounded" />
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-slate-400">After</span>
                      <button
                        onClick={() => setEvidenceId(c.afterMedia.id)}
                        className="text-xs text-slate-400 hover:text-slate-700 underline"
                      >
                        View source
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-800">{c.observedSummary}</p>
                <p className="text-xs text-slate-500 mt-1">{c.interpretationSummary}</p>
                <p className="text-xs italic text-slate-400 mt-2 border-t border-slate-200 pt-2">
                  {c.disclaimer}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <EvidencePanel mediaId={evidenceId} onClose={() => setEvidenceId(null)} />
    </main>
  );
}
