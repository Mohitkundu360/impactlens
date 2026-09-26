import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      cloudinaryConfigured: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
      ),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", database: "unreachable", message: (err as Error).message },
      { status: 500 }
    );
  }
}
