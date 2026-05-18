import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { artifactTypes, ArtifactType } from "@/lib/config";
import { getArtifact } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string; type: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { id, type } = await params;
  if (!artifactTypes.includes(type as ArtifactType)) {
    return NextResponse.json({ error: "Artefacto no soportado." }, { status: 400 });
  }

  const artifact = getArtifact(id, type as ArtifactType);
  if (!artifact) {
    return NextResponse.json({ error: "Artefacto no encontrado." }, { status: 404 });
  }

  const content = await fs.readFile(artifact.file_path);
  const filename = path.basename(artifact.file_path);
  const contentType = type === "structured_json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8";

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
