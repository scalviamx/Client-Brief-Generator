import { NextResponse } from "next/server";
import { createJobFromUpload, serializeJob, serializeJobs, startJobProcessing } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ jobs: serializeJobs(20) });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Sube un archivo de audio." }, { status: 400 });
    }

    const jobId = await createJobFromUpload(file, {
      clientName: String(formData.get("clientName") ?? ""),
      businessName: String(formData.get("businessName") ?? ""),
      callType: String(formData.get("callType") ?? ""),
      internalParticipants: String(formData.get("internalParticipants") ?? ""),
    });

    startJobProcessing(jobId);

    return NextResponse.json(serializeJob(jobId), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
