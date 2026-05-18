export const jobStatuses = [
  "queued",
  "validating",
  "converting",
  "chunking",
  "transcribing",
  "cleaning",
  "analyzing",
  "exporting",
  "complete",
  "failed",
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export const artifactTypes = [
  "raw_transcript",
  "merged_transcript",
  "clean_transcript",
  "brief_markdown",
  "structured_json",
  "export_zip",
] as const;

export type ArtifactType = (typeof artifactTypes)[number];

export const allowedAudioExtensions = [".m4a", ".mp3", ".wav", ".mp4", ".aac"] as const;

export function getRuntimeConfig() {
  return {
    groqApiKey: process.env.GROQ_API_KEY ?? "",
    groqTranscriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo",
    groqAnalysisModel: process.env.GROQ_ANALYSIS_MODEL ?? "llama-3.3-70b-versatile",
    chunkMinutes: Number(process.env.CHUNK_MINUTES ?? 7),
    chunkOverlapSeconds: Number(process.env.CHUNK_OVERLAP_SECONDS ?? 15),
    maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 500),
  };
}
