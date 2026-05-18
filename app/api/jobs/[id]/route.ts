import { NextResponse } from "next/server";
import { serializeJob, startJobProcessing } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const job = serializeJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job no encontrado." }, { status: 404 });
  }

  if (job.status === "queued") {
    startJobProcessing(id);
  }

  return NextResponse.json(job);
}
