import { NextResponse } from "next/server";
import { processNextJob } from "@/worker/processJob";

export const runtime = "nodejs";

export async function POST() {
  try {
    const processed = await processNextJob();

    return NextResponse.json({
      processed
    });
  } catch (error) {
    console.error("[api/jobs/process] Unexpected processing error:", error);

    return NextResponse.json(
      { error: "Job processing failed." },
      { status: 500 }
    );
  }
}
