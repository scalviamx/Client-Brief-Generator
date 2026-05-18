import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { calculateChunkRanges } from "@/lib/audio/chunking";
import { getRuntimeConfig } from "@/lib/config";
import { cleanTranscript, generateBrief, generateStructuredJson, transcribeChunk } from "@/lib/ai/groq";
import {
  createJob,
  getJob,
  insertChunk,
  listArtifacts,
  listChunks,
  listJobs,
  updateChunkError,
  updateChunkTranscript,
  updateJobProcessedPath,
  updateJobStatus,
  upsertArtifact,
} from "@/lib/server/database";
import { convertAudioForSpeech, extractAudioChunk, getAudioDurationSeconds } from "@/lib/server/ffmpeg";
import { getArtifactPath, getJobDir } from "@/lib/server/paths";
import { getSafeAudioFilename, validateAudioUpload } from "@/lib/audio/validation";

type JobMetadata = {
  clientName: string;
  businessName: string;
  callType: string;
  internalParticipants: string;
};

const runningJobs = new Set<string>();

export async function createJobFromUpload(file: File, metadata: JobMetadata) {
  const config = getRuntimeConfig();
  const validation = validateAudioUpload(file.name, file.size, config.maxUploadMb);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const id = randomUUID();
  const uploadDir = getJobDir("uploads", id);
  const safeName = getSafeAudioFilename(file.name);
  const uploadPath = path.join(uploadDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(uploadPath, buffer);
  createJob({
    id,
    metadata: {
      ...metadata,
      originalFileName: file.name,
      storedFileName: safeName,
    },
    originalFileName: file.name,
    uploadPath,
  });

  return id;
}

export function startJobProcessing(jobId: string) {
  if (runningJobs.has(jobId)) {
    return;
  }

  runningJobs.add(jobId);
  void processJob(jobId).finally(() => runningJobs.delete(jobId));
}

export async function processJob(jobId: string) {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} no existe.`);
  }

  try {
    const config = getRuntimeConfig();
    const metadata = JSON.parse(job.metadata) as Record<string, unknown>;

    updateJobStatus(jobId, "validating", 5);
    if (!config.groqApiKey) {
      throw new Error("Falta GROQ_API_KEY en .env.");
    }

    updateJobStatus(jobId, "converting", 12);
    const processedPath = path.join(getJobDir("processed", jobId), "speech.flac");
    await convertAudioForSpeech(job.upload_path, processedPath);
    updateJobProcessedPath(jobId, processedPath);

    const durationSeconds = await getAudioDurationSeconds(processedPath);
    const chunkSeconds = config.chunkMinutes * 60;
    const ranges = calculateChunkRanges(durationSeconds, chunkSeconds, config.chunkOverlapSeconds);
    if (!ranges.length) {
      throw new Error("El audio no tiene duración procesable.");
    }

    updateJobStatus(jobId, "chunking", 22);
    const chunksDir = getJobDir("chunks", jobId);
    for (const range of ranges) {
      const chunkPath = path.join(chunksDir, `part-${String(range.index + 1).padStart(3, "0")}.flac`);
      await extractAudioChunk(processedPath, chunkPath, range.startSeconds, range.durationSeconds);
      insertChunk({
        jobId,
        chunkIndex: range.index,
        startSeconds: range.startSeconds,
        endSeconds: range.endSeconds,
        filePath: chunkPath,
      });
    }

    const chunkRecords = listChunks(jobId);
    const transcripts: string[] = [];
    for (const chunk of chunkRecords) {
      updateJobStatus(jobId, "transcribing", 25 + (chunk.chunk_index / chunkRecords.length) * 40);
      try {
        const transcript = await transcribeChunk(chunk.file_path ?? "");
        const chunkText = `## Parte ${chunk.chunk_index + 1} (${formatTimestamp(chunk.start_seconds)} - ${formatTimestamp(chunk.end_seconds)})\n\n${transcript}`;
        updateChunkTranscript(jobId, chunk.chunk_index, transcript);
        transcripts.push(chunkText);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido al transcribir chunk.";
        updateChunkError(jobId, chunk.chunk_index, message);
        throw new Error(`Falló la transcripción de la parte ${chunk.chunk_index + 1}: ${message}`);
      }
    }

    const rawTranscript = transcripts.join("\n\n");
    const rawTranscriptPath = getArtifactPath(jobId, "raw_transcript");
    await fs.writeFile(rawTranscriptPath, rawTranscript, "utf8");
    upsertArtifact(jobId, "raw_transcript", rawTranscriptPath);

    updateJobStatus(jobId, "cleaning", 68);
    const cleanTranscriptText = await cleanTranscript(rawTranscript);
    const cleanTranscriptPath = getArtifactPath(jobId, "clean_transcript");
    await fs.writeFile(cleanTranscriptPath, cleanTranscriptText, "utf8");
    upsertArtifact(jobId, "clean_transcript", cleanTranscriptPath);

    updateJobStatus(jobId, "analyzing", 78);
    const brief = await generateBrief(cleanTranscriptText, metadata);
    const briefPath = getArtifactPath(jobId, "brief_markdown");
    await fs.writeFile(briefPath, brief, "utf8");
    upsertArtifact(jobId, "brief_markdown", briefPath);

    updateJobStatus(jobId, "exporting", 90);
    const structuredJson = await generateStructuredJson(brief, cleanTranscriptText, {
      ...metadata,
      durationMinutes: Math.round(durationSeconds / 60),
      audioFile: job.original_file_name,
    });
    const jsonPath = getArtifactPath(jobId, "structured_json");
    await fs.writeFile(jsonPath, `${JSON.stringify(structuredJson, null, 2)}\n`, "utf8");
    upsertArtifact(jobId, "structured_json", jsonPath);

    updateJobStatus(jobId, "complete", 100);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    updateJobStatus(jobId, "failed", getJob(jobId)?.progress ?? 0, message);
  }
}

export function serializeJob(jobId: string) {
  const job = getJob(jobId);
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    metadata: JSON.parse(job.metadata),
    originalFileName: job.original_file_name,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    chunks: listChunks(jobId).map((chunk) => ({
      index: chunk.chunk_index,
      startSeconds: chunk.start_seconds,
      endSeconds: chunk.end_seconds,
      status: chunk.status,
      error: chunk.error,
    })),
    artifacts: listArtifacts(jobId).map((artifact) => ({
      type: artifact.type,
      url: `/api/jobs/${jobId}/artifacts/${artifact.type}`,
      createdAt: artifact.created_at,
    })),
  };
}

export function serializeJobs(limit = 20) {
  return listJobs(limit).map((job) => ({
    id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    metadata: JSON.parse(job.metadata),
    originalFileName: job.original_file_name,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    artifacts: listArtifacts(job.id).map((artifact) => ({
      type: artifact.type,
      url: `/api/jobs/${job.id}/artifacts/${artifact.type}`,
      createdAt: artifact.created_at,
    })),
  }));
}

function formatTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}
