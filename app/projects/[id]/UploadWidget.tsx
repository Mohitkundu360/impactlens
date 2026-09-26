"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "BEFORE" | "DURING" | "AFTER" | "UNSPECIFIED";

const PHASES: Phase[] = ["BEFORE", "DURING", "AFTER", "UNSPECIFIED"];

interface Props {
  projectId: string;
}

export default function UploadWidget({ projectId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("UNSPECIFIED");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        setProgressLabel(`Uploading ${file.name}…`);
        await uploadOne(file);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      setProgressLabel(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function uploadOne(file: File) {
    // 1. Get a signature scoped to this project from our server.
    const sigRes = await fetch("/api/media/upload-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, phase })
    });
    if (!sigRes.ok) throw new Error("Could not get an upload signature.");
    const sig = await sigRes.json();

    // 2. Upload the file directly to Cloudinary — never touches our server.
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("signature", sig.signature);
    form.append("folder", sig.folder);
    if (sig.context) form.append("context", sig.context);
    if (sig.tags) form.append("tags", sig.tags);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
      method: "POST",
      body: form
    });
    if (!uploadRes.ok) {
  const details = await uploadRes.text();
  console.error("Cloudinary upload error:", details);
  throw new Error(`Cloudinary upload failed for ${file.name}: ${details}`);
}
    const asset = await uploadRes.json();

    // 3. Register the asset with our backend, which enqueues AI processing.
    setProgressLabel(`Registering ${file.name}…`);
    const registerRes = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        cloudinaryPublicId: asset.public_id,
        cloudinaryAssetId: asset.asset_id,
        cloudinaryUrl: asset.url,
        cloudinarySecureUrl: asset.secure_url,
        resourceType: asset.resource_type === "video" ? "VIDEO" : "IMAGE",
        format: asset.format,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.duration,
        phase
      })
    });
    if (!registerRes.ok) {
      throw new Error(`Uploaded to Cloudinary but failed to register ${file.name}.`);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <select
          className="border border-slate-300 rounded px-3 py-2 text-sm"
          value={phase}
          onChange={(e) => setPhase(e.target.value as Phase)}
          disabled={uploading}
        >
          {PHASES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)}
          className="text-sm"
        />
      </div>
      {progressLabel && <p className="text-sm text-slate-500">{progressLabel}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">
        Files upload directly to Cloudinary, then queue for AI analysis. Status updates below automatically.
      </p>
    </div>
  );
}
