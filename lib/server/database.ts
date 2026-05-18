import Database from "better-sqlite3";
import { ArtifactType, JobStatus } from "@/lib/config";
import { ensureStorageDirs, storageRoot } from "@/lib/server/paths";
import path from "node:path";

export type JobRecord = {
  id: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  metadata: string;
  original_file_name: string;
  upload_path: string;
  processed_path: string | null;
  created_at: string;
  updated_at: string;
};

export type ChunkRecord = {
  id: number;
  job_id: string;
  chunk_index: number;
  start_seconds: number;
  end_seconds: number;
  status: string;
  file_path: string | null;
  transcript: string | null;
  error: string | null;
};

export type ArtifactRecord = {
  id: number;
  job_id: string;
  type: ArtifactType;
  file_path: string;
  created_at: string;
};

let db: Database.Database | null = null;

function getDb() {
  if (db) {
    return db;
  }

  ensureStorageDirs();
  db = new Database(path.join(storageRoot, "client-brief.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      metadata TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      upload_path TEXT NOT NULL,
      processed_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      start_seconds REAL NOT NULL,
      end_seconds REAL NOT NULL,
      status TEXT NOT NULL,
      file_path TEXT,
      transcript TEXT,
      error TEXT,
      UNIQUE(job_id, chunk_index)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(job_id, type)
    );
  `);

  return db;
}

export function createJob(input: {
  id: string;
  metadata: unknown;
  originalFileName: string;
  uploadPath: string;
}) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO jobs (id, status, progress, error, metadata, original_file_name, upload_path, created_at, updated_at)
       VALUES (@id, 'queued', 0, NULL, @metadata, @originalFileName, @uploadPath, @now, @now)`,
    )
    .run({
      id: input.id,
      metadata: JSON.stringify(input.metadata),
      originalFileName: input.originalFileName,
      uploadPath: input.uploadPath,
      now,
    });
}

export function updateJobStatus(id: string, status: JobStatus, progress: number, error: string | null = null) {
  getDb()
    .prepare(`UPDATE jobs SET status = ?, progress = ?, error = ?, updated_at = ? WHERE id = ?`)
    .run(status, Math.max(0, Math.min(100, Math.round(progress))), error, new Date().toISOString(), id);
}

export function updateJobMetadata(id: string, metadata: unknown) {
  getDb()
    .prepare(`UPDATE jobs SET metadata = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(metadata), new Date().toISOString(), id);
}

export function updateJobProcessedPath(id: string, processedPath: string) {
  getDb().prepare(`UPDATE jobs SET processed_path = ?, updated_at = ? WHERE id = ?`).run(processedPath, new Date().toISOString(), id);
}

export function getJob(id: string) {
  return getDb().prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as JobRecord | undefined;
}

export function listJobs(limit = 20) {
  return getDb()
    .prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as JobRecord[];
}

export function listArtifacts(jobId: string) {
  return getDb().prepare(`SELECT * FROM artifacts WHERE job_id = ? ORDER BY id ASC`).all(jobId) as ArtifactRecord[];
}

export function getArtifact(jobId: string, type: ArtifactType) {
  return getDb().prepare(`SELECT * FROM artifacts WHERE job_id = ? AND type = ?`).get(jobId, type) as ArtifactRecord | undefined;
}

export function upsertArtifact(jobId: string, type: ArtifactType, filePath: string) {
  getDb()
    .prepare(
      `INSERT INTO artifacts (job_id, type, file_path, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(job_id, type) DO UPDATE SET file_path = excluded.file_path, created_at = excluded.created_at`,
    )
    .run(jobId, type, filePath, new Date().toISOString());
}

export function insertChunk(input: {
  jobId: string;
  chunkIndex: number;
  startSeconds: number;
  endSeconds: number;
  filePath: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO chunks (job_id, chunk_index, start_seconds, end_seconds, status, file_path)
       VALUES (?, ?, ?, ?, 'created', ?)
       ON CONFLICT(job_id, chunk_index) DO UPDATE SET
       start_seconds = excluded.start_seconds,
       end_seconds = excluded.end_seconds,
       file_path = excluded.file_path,
       status = 'created',
       error = NULL`,
    )
    .run(input.jobId, input.chunkIndex, input.startSeconds, input.endSeconds, input.filePath);
}

export function updateChunkTranscript(jobId: string, chunkIndex: number, transcript: string) {
  getDb()
    .prepare(`UPDATE chunks SET status = 'complete', transcript = ?, error = NULL WHERE job_id = ? AND chunk_index = ?`)
    .run(transcript, jobId, chunkIndex);
}

export function updateChunkError(jobId: string, chunkIndex: number, error: string) {
  getDb()
    .prepare(`UPDATE chunks SET status = 'failed', error = ? WHERE job_id = ? AND chunk_index = ?`)
    .run(error, jobId, chunkIndex);
}

export function listChunks(jobId: string) {
  return getDb().prepare(`SELECT * FROM chunks WHERE job_id = ? ORDER BY chunk_index ASC`).all(jobId) as ChunkRecord[];
}
