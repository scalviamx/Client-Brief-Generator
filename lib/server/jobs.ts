import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { calculateChunkRanges } from "@/lib/audio/chunking";
import { getRuntimeConfig } from "@/lib/config";
import { cleanTranscript, generateBrief, generateStructuredJson, transcribeChunk } from "@/lib/ai/groq";
import { mergeChunkTranscripts } from "@/lib/ai/merge";
import { PromptOverrides } from "@/lib/ai/prompts";
import {
  createJob,
  getArtifact,
  getJob,
  insertChunk,
  listArtifacts,
  listChunks,
  listJobs,
  updateChunkError,
  updateChunkTranscript,
  updateJobMetadata,
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
  promptOverrides?: PromptOverrides;
  processing?: Record<string, unknown>;
};

export type JobAction = "regenerate_json" | "regenerate_brief" | "regenerate_clean_transcript" | "reprocess_all";

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
  startJobTask(jobId, () => processJob(jobId));
}

export function startJobAction(jobId: string, action: JobAction, promptOverrides?: PromptOverrides) {
  startJobTask(jobId, () => processJobAction(jobId, action, promptOverrides));
}

function startJobTask(jobId: string, task: () => Promise<void>) {
  if (runningJobs.has(jobId)) {
    return;
  }

  runningJobs.add(jobId);
  void task().finally(() => runningJobs.delete(jobId));
}

export async function processJob(jobId: string) {
  const startedAt = Date.now();
  const job = assertJob(jobId);

  try {
    const config = getRuntimeConfig();
    const metadata = getJobMetadata(jobId);
    const promptOverrides = metadata.promptOverrides || {};

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
    for (const chunk of chunkRecords) {
      updateJobStatus(jobId, "transcribing", 25 + (chunk.chunk_index / chunkRecords.length) * 40);
      try {
        const transcript = await transcribeChunk(chunk.file_path ?? "");
        updateChunkTranscript(jobId, chunk.chunk_index, transcript);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido al transcribir chunk.";
        updateChunkError(jobId, chunk.chunk_index, message);
        throw new Error(`Falló la transcripción de la parte ${chunk.chunk_index + 1}: ${message}`);
      }
    }

    await writeRawAndMergedTranscripts(jobId);
    await regenerateCleanTranscript(jobId, promptOverrides, false);
    await writeProcessingMetrics(jobId, startedAt, {
      durationSeconds,
      chunkCount: ranges.length,
      action: "full_process",
    });
    updateJobStatus(jobId, "complete", 100);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    updateJobStatus(jobId, "failed", getJob(jobId)?.progress ?? 0, message);
  }
}

export async function processJobAction(jobId: string, action: JobAction, promptOverrides?: PromptOverrides) {
  const startedAt = Date.now();
  try {
    assertJob(jobId);
    const metadata = mergePromptOverrides(jobId, promptOverrides);

    if (action === "reprocess_all") {
      await processJob(jobId);
      return;
    }

    if (action === "regenerate_clean_transcript") {
      await regenerateCleanTranscript(jobId, metadata.promptOverrides || {}, true);
    }

    if (action === "regenerate_brief") {
      await regenerateBriefAndJson(jobId, metadata.promptOverrides || {}, true);
    }

    if (action === "regenerate_json") {
      await regenerateJsonOnly(jobId, metadata.promptOverrides || {}, true);
    }

    await writeProcessingMetrics(jobId, startedAt, { action });
    updateJobStatus(jobId, "complete", 100);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    updateJobStatus(jobId, "failed", getJob(jobId)?.progress ?? 0, message);
  }
}

async function regenerateCleanTranscript(jobId: string, promptOverrides: PromptOverrides, shouldSetStatus: boolean) {
  if (shouldSetStatus) {
    updateJobStatus(jobId, "cleaning", 68);
  } else {
    updateJobStatus(jobId, "cleaning", 68);
  }

  const mergedTranscript = await readMergedTranscript(jobId);
  const cleanTranscriptText = await cleanTranscript(mergedTranscript, promptOverrides.cleanupPrompt);
  const cleanTranscriptPath = getArtifactPath(jobId, "clean_transcript");
  await fs.writeFile(cleanTranscriptPath, cleanTranscriptText, "utf8");
  upsertArtifact(jobId, "clean_transcript", cleanTranscriptPath);

  await regenerateBriefAndJson(jobId, promptOverrides, false);
}

async function regenerateBriefAndJson(jobId: string, promptOverrides: PromptOverrides, shouldSetStatus: boolean) {
  if (shouldSetStatus) {
    updateJobStatus(jobId, "analyzing", 78);
  } else {
    updateJobStatus(jobId, "analyzing", 78);
  }

  const metadata = getJobMetadata(jobId);
  const cleanTranscriptText = await readArtifactText(jobId, "clean_transcript");
  const brief = await generateBrief(cleanTranscriptText, metadata, promptOverrides.briefPrompt);
  const briefPath = getArtifactPath(jobId, "brief_markdown");
  await fs.writeFile(briefPath, brief, "utf8");
  upsertArtifact(jobId, "brief_markdown", briefPath);

  await regenerateJsonOnly(jobId, promptOverrides, false);
}

async function regenerateJsonOnly(jobId: string, promptOverrides: PromptOverrides, shouldSetStatus: boolean) {
  if (shouldSetStatus) {
    updateJobStatus(jobId, "exporting", 90);
  } else {
    updateJobStatus(jobId, "exporting", 90);
  }

  const job = assertJob(jobId);
  const metadata = getJobMetadata(jobId);
  const cleanTranscriptText = await readArtifactText(jobId, "clean_transcript");
  const brief = await readArtifactText(jobId, "brief_markdown");
  const durationSeconds = getDurationSeconds(jobId);
  const structuredJson = await generateStructuredJson(
    brief,
    cleanTranscriptText,
    {
      ...metadata,
      durationMinutes: durationSeconds ? Math.round(durationSeconds / 60) : "No mencionado",
      audioFile: job.original_file_name,
    },
    promptOverrides.jsonPrompt,
  );
  const jsonPath = getArtifactPath(jobId, "structured_json");
  await fs.writeFile(jsonPath, `${JSON.stringify(structuredJson, null, 2)}\n`, "utf8");
  upsertArtifact(jobId, "structured_json", jsonPath);

  await writeExportZip(jobId);
}

async function writeRawAndMergedTranscripts(jobId: string) {
  const chunkRecords = listChunks(jobId);
  const parts = chunkRecords.map((chunk) => ({
    heading: `## Parte ${chunk.chunk_index + 1} (${formatTimestamp(chunk.start_seconds)} - ${formatTimestamp(chunk.end_seconds)})`,
    text: chunk.transcript ?? "",
  }));
  const rawTranscript = parts.map((part) => `${part.heading}\n\n${part.text.trim()}`).join("\n\n");
  const mergedTranscript = mergeChunkTranscripts(parts);

  const rawTranscriptPath = getArtifactPath(jobId, "raw_transcript");
  await fs.writeFile(rawTranscriptPath, rawTranscript, "utf8");
  upsertArtifact(jobId, "raw_transcript", rawTranscriptPath);

  const mergedTranscriptPath = getArtifactPath(jobId, "merged_transcript");
  await fs.writeFile(mergedTranscriptPath, mergedTranscript, "utf8");
  upsertArtifact(jobId, "merged_transcript", mergedTranscriptPath);
}

async function writeExportZip(jobId: string) {
  const zip = new JSZip();
  const artifacts = listArtifacts(jobId).filter((artifact) => artifact.type !== "export_zip");
  for (const artifact of artifacts) {
    const fileName = path.basename(artifact.file_path);
    zip.file(fileName, await fs.readFile(artifact.file_path));
  }

  const job = assertJob(jobId);
  zip.file(
    "metadata.json",
    `${JSON.stringify(
      {
        id: job.id,
        originalFileName: job.original_file_name,
        metadata: getJobMetadata(jobId),
        chunks: listChunks(jobId).map((chunk) => ({
          index: chunk.chunk_index,
          startSeconds: chunk.start_seconds,
          endSeconds: chunk.end_seconds,
          status: chunk.status,
        })),
      },
      null,
      2,
    )}\n`,
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipPath = getArtifactPath(jobId, "export_zip");
  await fs.writeFile(zipPath, buffer);
  upsertArtifact(jobId, "export_zip", zipPath);
}

async function writeProcessingMetrics(jobId: string, startedAt: number, extra: Record<string, unknown>) {
  const config = getRuntimeConfig();
  const metadata = getJobMetadata(jobId);
  const durationSeconds = typeof extra.durationSeconds === "number" ? extra.durationSeconds : getDurationSeconds(jobId);
  updateJobMetadata(jobId, {
    ...metadata,
    processing: {
      ...(metadata.processing || {}),
      ...extra,
      durationSeconds,
      durationMinutes: durationSeconds ? Math.round(durationSeconds / 60) : null,
      chunkCount: listChunks(jobId).length,
      chunkMinutes: config.chunkMinutes,
      overlapSeconds: config.chunkOverlapSeconds,
      transcriptionModel: config.groqTranscriptionModel,
      analysisModel: config.groqAnalysisModel,
      totalProcessingSeconds: Math.round((Date.now() - startedAt) / 1000),
      completedAt: new Date().toISOString(),
    },
  });
}

function mergePromptOverrides(jobId: string, promptOverrides?: PromptOverrides) {
  const metadata = getJobMetadata(jobId);
  const nextMetadata = {
    ...metadata,
    promptOverrides: {
      ...(metadata.promptOverrides || {}),
      ...(promptOverrides || {}),
    },
  };
  updateJobMetadata(jobId, nextMetadata);
  return nextMetadata;
}

async function readArtifactText(jobId: string, type: "raw_transcript" | "merged_transcript" | "clean_transcript" | "brief_markdown") {
  const artifact = getArtifact(jobId, type);
  if (!artifact) {
    throw new Error(`Falta el artefacto requerido: ${type}.`);
  }
  return fs.readFile(artifact.file_path, "utf8");
}

async function readMergedTranscript(jobId: string) {
  const existing = getArtifact(jobId, "merged_transcript");
  if (existing) {
    return fs.readFile(existing.file_path, "utf8");
  }

  const chunks = listChunks(jobId);
  if (chunks.some((chunk) => chunk.transcript)) {
    await writeRawAndMergedTranscripts(jobId);
    return readArtifactText(jobId, "merged_transcript");
  }

  return readArtifactText(jobId, "raw_transcript");
}

function getDurationSeconds(jobId: string) {
  return listChunks(jobId).reduce((max, chunk) => Math.max(max, chunk.end_seconds), 0);
}

function assertJob(jobId: string) {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} no existe.`);
  }
  return job;
}

function getJobMetadata(jobId: string) {
  return JSON.parse(assertJob(jobId).metadata) as JobMetadata;
}

export function serializeJob(jobId: string) {
  const job = getJob(jobId);
  if (!job) {
    return null;
  }

  const metadata = JSON.parse(job.metadata);
  const chunks = listChunks(jobId);
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    metadata,
    originalFileName: job.original_file_name,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    metrics: {
      ...(metadata.processing || {}),
      chunkCount: chunks.length,
      durationSeconds: getDurationSeconds(jobId),
    },
    chunks: chunks.map((chunk) => ({
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
  return listJobs(limit).map((job) => {
    const metadata = JSON.parse(job.metadata);
    const chunks = listChunks(job.id);
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      metadata,
      originalFileName: job.original_file_name,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      metrics: {
        ...(metadata.processing || {}),
        chunkCount: chunks.length,
        durationSeconds: getDurationSeconds(job.id),
      },
      artifacts: listArtifacts(job.id).map((artifact) => ({
        type: artifact.type,
        url: `/api/jobs/${job.id}/artifacts/${artifact.type}`,
        createdAt: artifact.created_at,
      })),
    };
  });
}

function formatTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}
