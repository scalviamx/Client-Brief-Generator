import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { convertAudioForSpeech, extractAudioChunk, getAudioDurationSeconds } from "@/lib/server/ffmpeg";

const execFileAsync = promisify(execFile);

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.runIf(hasFfmpeg())("ffmpeg pipeline", () => {
  it("converts and extracts a short synthetic audio chunk", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scalvia-brief-test-"));
    const inputPath = path.join(dir, "input.wav");
    const convertedPath = path.join(dir, "speech.flac");
    const chunkPath = path.join(dir, "part-001.flac");

    await execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=1000:duration=2", inputPath]);
    await convertAudioForSpeech(inputPath, convertedPath);
    const duration = await getAudioDurationSeconds(convertedPath);
    await extractAudioChunk(convertedPath, chunkPath, 0, 1);
    const stat = await fs.stat(chunkPath);

    expect(duration).toBeGreaterThan(1.8);
    expect(stat.size).toBeGreaterThan(0);
  });
});
