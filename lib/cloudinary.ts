/**
 * Cloudinary service module.
 *
 * This is the ONLY file in the app that talks to the Cloudinary SDK or REST API
 * directly. Every other module (API routes, worker, UI) goes through the
 * functions exported here. That keeps Cloudinary swappable/mockable and keeps
 * the "which Cloudinary features are we actually using, and are they GA or
 * Beta" decision in one place.
 *
 * GA / stable, used unconditionally:
 *  - Upload API (signed direct-from-client upload)     -> generateUploadSignature()
 *  - Admin API (live asset lookup, for Evidence Panel)  -> getAsset()
 *  - Named/eager transformations (thumbnails, compare)  -> thumbnailUrl(), compareUrl()
 *
 * Beta / add-on gated, OFF by default, with a guaranteed fallback elsewhere
 * in the app if these fail or are disabled:
 *  - AI Vision (Analyze API)         -> analyzeWithAiVision()
 *  - AI Video Analysis (Beta)        -> submitVideoAnalysis(), getVideoAnalysisJob()
 */

import { v2 as cloudinary } from "cloudinary";

// Read config live on every call rather than caching at module-import time —
// matters for tests, and for any environment where env vars might not be
// fully populated at the moment this module first loads.
function getConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

  return { cloudName, apiKey, apiSecret };
}

// ---------- Signed direct upload ----------

export interface UploadSignatureParams {
  folder: string; // e.g. `impactlens/${projectId}`
  publicId?: string;
  context?: Record<string, string>; // e.g. { project_id, phase, uploaded_by }
  tags?: string[];
}

export interface UploadSignatureResult {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId?: string;
  context?: string;
  tags?: string;
}

/**
 * Generates a signature the client uses to upload directly to Cloudinary,
 * without the file ever passing through our server and without exposing the
 * API secret to the client. This is the core of "Cloudinary as genuine
 * infrastructure, not a passthrough."
 */
export function generateUploadSignature(params: UploadSignatureParams): UploadSignatureResult {
  const { cloudName, apiKey, apiSecret } = getConfig();

  const timestamp = Math.round(Date.now() / 1000);

  const contextString = params.context
    ? Object.entries(params.context)
        .map(([k, v]) => `${k}=${v}`)
        .join("|")
    : undefined;
  const tagsString = params.tags?.join(",");

  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder: params.folder,
    ...(params.publicId ? { public_id: params.publicId } : {}),
    ...(contextString ? { context: contextString } : {}),
    ...(tagsString ? { tags: tagsString } : {})
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    signature,
    timestamp,
    cloudName,
    apiKey,
    folder: params.folder,
    publicId: params.publicId,
    context: contextString,
    tags: tagsString
  };
}

// ---------- Asset lookup (Admin API) — powers the Evidence Panel's "live verify" ----------

export interface CloudinaryAssetInfo {
  publicId: string;
  assetId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  resourceType: "image" | "video" | "raw";
  secureUrl: string;
  createdAt: string;
  context?: Record<string, string>;
  tags: string[];
}

export async function getAsset(
  publicId: string,
  resourceType: "image" | "video" = "image"
): Promise<CloudinaryAssetInfo> {
  getConfig();

  const res = await cloudinary.api.resource(publicId, {
    resource_type: resourceType,
    context: true
  });

  return {
    publicId: res.public_id,
    assetId: res.asset_id,
    format: res.format,
    bytes: res.bytes,
    width: res.width,
    height: res.height,
    duration: res.duration,
    resourceType: res.resource_type,
    secureUrl: res.secure_url,
    createdAt: res.created_at,
    context: res.context?.custom,
    tags: res.tags ?? []
  };
}

// ---------- Delivery URL helpers ----------

export function thumbnailUrl(publicId: string, opts?: { width?: number; height?: number }) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width: opts?.width ?? 400, height: opts?.height ?? 300, crop: "fill" }]
  });
}

/** Matched dimensions for before/after so the two images line up in the Compare view. */
export function compareUrl(publicId: string) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width: 800, height: 600, crop: "fit", background: "auto" }]
  });
}

export function videoPreviewFrameUrl(publicId: string, atSecond: number | "auto" = "auto") {
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "video",
    format: "jpg",
    transformation: [{ start_offset: atSecond === "auto" ? "auto" : atSecond, width: 800, crop: "fit" }]
  });
}

// ---------- AI Vision (Analyze API, Beta add-on) — OPTIONAL alternate analysis path ----------

function basicAuthHeader(apiKey: string, apiSecret: string) {
  return "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
}

export interface AiVisionResult {
  answer: string;
  raw: unknown;
}

/**
 * Calls the AI Vision "general" model via the Analyze API. This accepts either
 * a `uri` or an `asset_id` and does NOT require the asset to already be
 * uploaded to Cloudinary — but in our pipeline it always will be, since we
 * only ever call this on assets we've already stored.
 *
 * Gated by CLOUDINARY_AI_VISION_ENABLED. If this throws, callers MUST fall
 * back to the Gemini AnalysisProvider — this is never the only analysis path.
 */
export async function analyzeWithAiVision(
  source: { assetId?: string; uri?: string },
  prompt: string
): Promise<AiVisionResult> {
  const { cloudName, apiKey, apiSecret } = getConfig();

  const res = await fetch(`https://api.cloudinary.com/v2/analysis/${cloudName}/analyze/ai_vision_general`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(apiKey, apiSecret)
    },
    body: JSON.stringify({
      source: source.assetId ? { asset_id: source.assetId } : { uri: source.uri },
      prompt
    })
  });

  if (!res.ok) {
    throw new Error(`Cloudinary AI Vision request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return { answer: data.response ?? data.answer ?? "", raw: data };
}

// ---------- AI Video Analysis (Beta) — OPTIONAL native timestamped video scenes ----------

export interface VideoAnalysisJob {
  jobId: string;
  status: "pending" | "completed" | "failed";
  transcript?: { assetId: string; publicId: string; url: string };
}

/**
 * Submits a stored video asset for native timestamped scene analysis.
 * Gated by CLOUDINARY_AI_VIDEO_ANALYSIS_ENABLED. Asynchronous — returns a
 * job_id that must be polled via getVideoAnalysisJob().
 *
 * If this is disabled, unavailable, or the job fails/times out, the worker's
 * job-processing logic (see worker/handlers/videoAnalysis.ts) automatically
 * falls back to VIDEO_ANALYSIS_FRAME (Gemini on an extracted frame). This
 * function is never the only path to an analyzed video.
 */
export async function submitVideoAnalysis(
  videoAssetId: string,
  prompt?: string
): Promise<{ jobId: string; status: string }> {
  const { cloudName, apiKey, apiSecret } = getConfig();

  const res = await fetch(`https://api.cloudinary.com/v2/video/${cloudName}/ai_video_analysis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(apiKey, apiSecret)
    },
    body: JSON.stringify({
      video_asset_id: videoAssetId,
      ...(prompt ? { visual_transcription_prompt: prompt } : {})
    })
  });

  if (!res.ok) {
    throw new Error(`Cloudinary AI Video Analysis submit failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return { jobId: data.job_id, status: data.status };
}

export async function getVideoAnalysisJob(jobId: string): Promise<VideoAnalysisJob> {
  const { cloudName, apiKey, apiSecret } = getConfig();

  const res = await fetch(`https://api.cloudinary.com/v2/video/${cloudName}/ai_video_analysis/${jobId}`, {
    headers: { Authorization: basicAuthHeader(apiKey, apiSecret) }
  });

  if (!res.ok) {
    throw new Error(`Cloudinary AI Video Analysis poll failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    jobId,
    status: data.status,
    transcript: data.visual_transcription
      ? {
          assetId: data.visual_transcription.asset_id,
          publicId: data.visual_transcription.public_id,
          url: data.visual_transcription.url
        }
      : undefined
  };
}

/** Fetches and parses the `.visual.transcript` raw file produced by AI Video Analysis. */
export async function fetchVisualTranscript(
  url: string
): Promise<Array<{ startSeconds: number; endSeconds: number; description: string }>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch visual transcript: ${res.status}`);
  const data = await res.json();
  // Transcript entries are expected as [{ start, end, description }, ...];
  // defensively validated by the caller (worker) before writing to VideoScene.
  return data.segments ?? data;
}
