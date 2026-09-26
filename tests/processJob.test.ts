import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory fake matching only the Prisma calls worker/processJob.ts makes.
 * This lets us test the real state-machine logic (the actual processJob.ts
 * code, not a re-implementation of it) without a live Postgres instance,
 * which this sandboxed environment doesn't have.
 */
function createFakeDb() {
  const jobs: any[] = [];
  const media: any[] = [];

  return {
    processingJob: {
      findFirst: vi.fn(async ({ where }: any) => {
        const candidates = jobs.filter((j) => j.status === where.status);
        if (candidates.length === 0) return null;
        return [...candidates].sort((a, b) => a.createdAt - b.createdAt)[0];
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const job = jobs.find((j) => j.id === where.id);
        if (!job) throw new Error("job not found");
        if (data.status) job.status = data.status;
        if (data.errorMessage !== undefined) job.errorMessage = data.errorMessage;
        if (data.attempts?.increment) job.attempts = (job.attempts ?? 0) + data.attempts.increment;
        return { ...job };
      })
    },
    mediaAsset: {
      findUnique: vi.fn(async ({ where }: any) => {
        const m = media.find((x) => x.id === where.id);
        return m ? { ...m } : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const m = media.find((x) => x.id === where.id);
        if (!m) throw new Error("media not found");
        Object.assign(m, data);
        return { ...m };
      })
    },
    __jobs: jobs,
    __media: media
  };
}

let fakeDb: ReturnType<typeof createFakeDb>;

vi.mock("@/lib/db", () => ({
  get db() {
    return fakeDb;
  }
}));

const runImageAnalysisMock = vi.fn();
const runFrameBasedVideoAnalysisMock = vi.fn();

vi.mock("@/worker/handlers/imageAnalysis", () => ({
  runImageAnalysis: (...args: any[]) => runImageAnalysisMock(...args)
}));
vi.mock("@/worker/handlers/videoAnalysis", () => ({
  runFrameBasedVideoAnalysis: (...args: any[]) => runFrameBasedVideoAnalysisMock(...args)
}));

function seedMedia(overrides: Partial<any> = {}) {
  const media = {
    id: "media1",
    status: "UPLOADED",
    resourceType: "IMAGE",
    project: { id: "proj1", name: "Test Project" },
    ...overrides
  };
  fakeDb.__media.push(media);
  return media;
}

function seedJob(overrides: Partial<any> = {}) {
  const job = {
    id: "job1",
    mediaAssetId: "media1",
    jobType: "IMAGE_ANALYSIS",
    status: "QUEUED",
    attempts: 0,
    createdAt: Date.now(),
    ...overrides
  };
  fakeDb.__jobs.push(job);
  return job;
}

describe("processNextJob (worker state machine)", () => {
  beforeEach(() => {
    fakeDb = createFakeDb();
    runImageAnalysisMock.mockReset();
    runFrameBasedVideoAnalysisMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns false when there is nothing queued", async () => {
    const { processNextJob } = await import("@/worker/processJob");
    expect(await processNextJob()).toBe(false);
  });

  it("UPLOADED -> PROCESSING -> INDEXED on a successful image analysis", async () => {
    seedMedia();
    seedJob();
    runImageAnalysisMock.mockResolvedValueOnce(undefined);

    const { processNextJob } = await import("@/worker/processJob");
    const handled = await processNextJob();

    expect(handled).toBe(true);
    expect(fakeDb.__media[0].status).toBe("INDEXED");
    expect(fakeDb.__jobs[0].status).toBe("SUCCEEDED");
    expect(fakeDb.__jobs[0].attempts).toBe(1);
    expect(runImageAnalysisMock).toHaveBeenCalledTimes(1);
  });

  it("UPLOADED -> PROCESSING -> FAILED when the handler throws", async () => {
    seedMedia();
    seedJob();
    runImageAnalysisMock.mockRejectedValueOnce(new Error("Gemini analysis failed: 500"));

    const { processNextJob } = await import("@/worker/processJob");
    await processNextJob();

    expect(fakeDb.__media[0].status).toBe("FAILED");
    expect(fakeDb.__jobs[0].status).toBe("FAILED");
    expect(fakeDb.__jobs[0].errorMessage).toMatch(/Gemini analysis failed/);
  });

  it("dispatches VIDEO_ANALYSIS_FRAME jobs to the frame-based handler, not image analysis", async () => {
    seedMedia({ resourceType: "VIDEO" });
    seedJob({ jobType: "VIDEO_ANALYSIS_FRAME" });
    runFrameBasedVideoAnalysisMock.mockResolvedValueOnce(undefined);

    const { processNextJob } = await import("@/worker/processJob");
    await processNextJob();

    expect(runFrameBasedVideoAnalysisMock).toHaveBeenCalledTimes(1);
    expect(runImageAnalysisMock).not.toHaveBeenCalled();
    expect(fakeDb.__media[0].status).toBe("INDEXED");
  });

  it("fails gracefully (does not throw) when a handler rejects with a non-Error value", async () => {
    // Some code path throws a plain string instead of an Error instance —
    // processNextJob's own catch block must not itself crash while trying
    // to record that failure (it did previously rely on `.message` existing).
    seedMedia();
    seedJob();
    runImageAnalysisMock.mockRejectedValueOnce("boom, not an Error instance");

    const { processNextJob } = await import("@/worker/processJob");
    await expect(processNextJob()).resolves.toBe(true);

    expect(fakeDb.__jobs[0].status).toBe("FAILED");
    expect(fakeDb.__jobs[0].errorMessage).toBe("Unknown processing error.");
    expect(fakeDb.__media[0].status).toBe("FAILED");
  });

  it("fails an orphaned job (media deleted mid-flight) instead of crashing", async () => {
    seedJob({ mediaAssetId: "does-not-exist" });

    const { processNextJob } = await import("@/worker/processJob");
    const handled = await processNextJob();

    expect(handled).toBe(true);
    expect(fakeDb.__jobs[0].status).toBe("FAILED");
    expect(fakeDb.__jobs[0].errorMessage).toMatch(/no longer exists/);
    expect(runImageAnalysisMock).not.toHaveBeenCalled();
  });

  it("fails unknown/unwired job types (e.g. VIDEO_ANALYSIS_NATIVE) loudly instead of silently no-op'ing", async () => {
    seedMedia({ resourceType: "VIDEO" });
    seedJob({ jobType: "VIDEO_ANALYSIS_NATIVE" });

    const { processNextJob } = await import("@/worker/processJob");
    await processNextJob();

    expect(fakeDb.__jobs[0].status).toBe("FAILED");
    expect(fakeDb.__jobs[0].errorMessage).toMatch(/not wired into the MVP job dispatch/);
    expect(runImageAnalysisMock).not.toHaveBeenCalled();
    expect(runFrameBasedVideoAnalysisMock).not.toHaveBeenCalled();
  });

  it("a failed job does not block unrelated queued media — the next call processes the other job", async () => {
    seedMedia({ id: "media1" });
    seedMedia({ id: "media2" });
    seedJob({ id: "job1", mediaAssetId: "media1", createdAt: 1 });
    seedJob({ id: "job2", mediaAssetId: "media2", createdAt: 2 });

    runImageAnalysisMock.mockRejectedValueOnce(new Error("first one fails")).mockResolvedValueOnce(undefined);

    const { processNextJob } = await import("@/worker/processJob");
    await processNextJob(); // job1 fails
    await processNextJob(); // job2 should still succeed independently

    expect(fakeDb.__jobs.find((j) => j.id === "job1").status).toBe("FAILED");
    expect(fakeDb.__jobs.find((j) => j.id === "job2").status).toBe("SUCCEEDED");
    expect(fakeDb.__media.find((m) => m.id === "media2").status).toBe("INDEXED");
  });

  it("claiming a job flips it out of QUEUED before the handler runs, so a second poll never reprocesses it", async () => {
    // This is a deterministic check of sequential polling (the actual
    // deployment model: one worker process, one job at a time — see
    // worker/index.ts). It does NOT prove the DB-level claim is atomic
    // under true concurrency; see the Phase 8 report for that caveat.
    seedMedia({ id: "media1" });
    seedMedia({ id: "media2" });
    seedJob({ id: "job1", mediaAssetId: "media1", createdAt: 1 });
    seedJob({ id: "job2", mediaAssetId: "media2", createdAt: 2 });

    runImageAnalysisMock.mockResolvedValue(undefined);

    const { processNextJob } = await import("@/worker/processJob");
    await processNextJob();
    await processNextJob();
    const thirdCallFoundNothing = !(await processNextJob());

    expect(fakeDb.__jobs.find((j) => j.id === "job1").status).toBe("SUCCEEDED");
    expect(fakeDb.__jobs.find((j) => j.id === "job2").status).toBe("SUCCEEDED");
    expect(thirdCallFoundNothing).toBe(true);
    expect(runImageAnalysisMock).toHaveBeenCalledTimes(2);
  });
});
