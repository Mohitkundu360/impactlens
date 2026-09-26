export type MediaStatus = "UPLOADED" | "PROCESSING" | "ANALYZED" | "FAILED" | "INDEXED";
export type MediaPhase = "BEFORE" | "DURING" | "AFTER" | "UNSPECIFIED";
export type ResourceType = "IMAGE" | "VIDEO";

export interface MediaSummary {
  id: string;
  cloudinaryPublicId: string;
  cloudinarySecureUrl: string;
  resourceType: ResourceType;
  phase: MediaPhase;
  activityLabel: string | null;
  status: MediaStatus;
  capturedAt: string | Date | null;
  createdAt: string | Date;
}
