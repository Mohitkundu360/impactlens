import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/currentUser";

const ProjectTypeEnum = z.enum([
  "ENVIRONMENTAL_RESTORATION",
  "INFRASTRUCTURE",
  "COMMUNITY_DEVELOPMENT",
  "SUSTAINABILITY_CAMPAIGN",
  "OTHER"
]);

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  locationText: z.string().max(200).optional(),
  projectType: ProjectTypeEnum.default("OTHER")
});

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { media: true, comparisonPairs: true, reports: true } }
    }
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      locationText: p.locationText,
      projectType: p.projectType,
      createdAt: p.createdAt,
      mediaCount: p._count.media,
      comparisonCount: p._count.comparisonPairs,
      reportCount: p._count.reports
    }))
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await getCurrentUser();

  const project = await db.project.create({
    data: {
      ...parsed.data,
      createdById: user.id
    }
  });

  return NextResponse.json({ project }, { status: 201 });
}
