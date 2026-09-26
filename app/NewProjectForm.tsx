"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROJECT_TYPES = [
  "ENVIRONMENTAL_RESTORATION",
  "INFRASTRUCTURE",
  "COMMUNITY_DEVELOPMENT",
  "SUSTAINABILITY_CAMPAIGN",
  "OTHER"
] as const;

export default function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [projectType, setProjectType] = useState<(typeof PROJECT_TYPES)[number]>(
    "ENVIRONMENTAL_RESTORATION"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, locationText, projectType })
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Could not create project.");
      return;
    }

    setName("");
    setLocationText("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-white border border-slate-200 rounded-lg p-4">
      <input
        className="border border-slate-300 rounded px-3 py-2 text-sm"
        placeholder="Project name (e.g. Odisha Mangrove Restoration)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className="border border-slate-300 rounded px-3 py-2 text-sm"
        placeholder="Location (e.g. Odisha, India)"
        value={locationText}
        onChange={(e) => setLocationText(e.target.value)}
      />
      <select
        className="border border-slate-300 rounded px-3 py-2 text-sm"
        value={projectType}
        onChange={(e) => setProjectType(e.target.value as (typeof PROJECT_TYPES)[number])}
      >
        {PROJECT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-slate-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
