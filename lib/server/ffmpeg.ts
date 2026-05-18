import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getAudioDurationSeconds(inputPath: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("No se pudo detectar la duración del audio.");
  }
  return duration;
}

export async function convertAudioForSpeech(inputPath: string, outputPath: string) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-map",
    "0:a:0",
    "-c:a",
    "flac",
    outputPath,
  ]);
}

export async function extractAudioChunk(inputPath: string, outputPath: string, startSeconds: number, durationSeconds: number) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    String(startSeconds),
    "-t",
    String(durationSeconds),
    "-i",
    inputPath,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "flac",
    outputPath,
  ]);
}
