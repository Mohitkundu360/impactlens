import { processNextJob } from "./processJob";

const IDLE_POLL_MS = 3000;

/**
 * Sequential polling worker: one job at a time, no Redis/BullMQ. This is
 * intentional for a 9-day hackathon scope — see Phase 1 architecture notes.
 * Run with `npm run worker` alongside `npm run dev`.
 */
async function main() {
  console.log("[worker] ImpactLens processing worker started.");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let processed = false;
    try {
      processed = await processNextJob();
    } catch (err) {
      console.error("[worker] Unexpected error while processing a job:", err);
    }

    if (!processed) {
      await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
    }
  }
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
