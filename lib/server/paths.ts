import fs from "node:fs";
import path from "node:path";
import { ArtifactType } from "@/lib/config";

export const storageRoot = path.join(process.cwd(), "storage");

export function ensureStorageDirs() {
  [
    storageRoot,
    path.join(storageRoot, "uploads"),
    path.join(storageRoot, "processed"),
    path.join(storageRoot, "chunks"),
    path.join(storageRoot, "transcripts"),
    path.join(storageRoot, "briefs"),
    path.join(storageRoot, "json"),
    path.join(storageRoot, "exports"),
  ].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
}

export function getJobDir(kind: "uploads" | "processed" | "chunks" | "transcripts" | "briefs" | "json" | "exports", jobId: string) {
  const dir = path.join(storageRoot, kind, jobId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getArtifactPath(jobId: string, type: ArtifactType) {
  if (type === "raw_transcript") {
    return path.join(getJobDir("transcripts", jobId), "raw-transcript.md");
  }
  if (type === "merged_transcript") {
    return path.join(getJobDir("transcripts", jobId), "merged-transcript.md");
  }
  if (type === "clean_transcript") {
    return path.join(getJobDir("transcripts", jobId), "clean-transcript.md");
  }
  if (type === "brief_markdown") {
    return path.join(getJobDir("briefs", jobId), "brief.md");
  }
  if (type === "export_zip") {
    return path.join(getJobDir("exports", jobId), "scalvia-brief-package.zip");
  }
  return path.join(getJobDir("json", jobId), "brief-data.json");
}
