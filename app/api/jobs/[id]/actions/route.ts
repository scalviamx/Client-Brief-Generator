import { NextResponse } from "next/server";
import { JobAction, serializeJob, startJobAction } from "@/lib/server/jobs";
import { PromptOverrides } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

const allowedActions = ["regenerate_json", "regenerate_brief", "regenerate_clean_transcript", "reprocess_all"];

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { action?: JobAction; promptOverrides?: PromptOverrides };
    if (!body.action || !allowedActions.includes(body.action)) {
      return NextResponse.json({ error: "Acción no soportada." }, { status: 400 });
    }

    const job = serializeJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job no encontrado." }, { status: 404 });
    }

    startJobAction(id, body.action, body.promptOverrides);
    return NextResponse.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar la acción.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
