import { describe, expect, it } from "vitest";
import { calculateChunkRanges } from "@/lib/audio/chunking";
import { getSafeAudioFilename, validateAudioUpload } from "@/lib/audio/validation";

describe("audio validation", () => {
  it("accepts supported audio extensions", () => {
    expect(validateAudioUpload("cliente.m4a", 1024, 500)).toEqual({ ok: true, error: "" });
    expect(validateAudioUpload("call.MP3", 1024, 500)).toEqual({ ok: true, error: "" });
  });

  it("rejects unsupported files and empty uploads", () => {
    expect(validateAudioUpload("notes.txt", 1024, 500).ok).toBe(false);
    expect(validateAudioUpload("empty.m4a", 0, 500).ok).toBe(false);
  });

  it("creates a safe filename", () => {
    expect(getSafeAudioFilename("Cliente Núñez primera llamada.m4a")).toBe("cliente-nunez-primera-llamada.m4a");
  });
});

describe("chunk range calculation", () => {
  it("creates overlapping fixed-time chunks", () => {
    const chunks = calculateChunkRanges(47 * 60, 7 * 60, 15);
    expect(chunks).toHaveLength(7);
    expect(chunks[0]).toMatchObject({ startSeconds: 0, endSeconds: 420 });
    expect(chunks[1]).toMatchObject({ startSeconds: 405, endSeconds: 825 });
    expect(chunks[6].endSeconds).toBe(2820);
  });

  it("handles short files with one chunk", () => {
    expect(calculateChunkRanges(90, 420, 15)).toEqual([
      { index: 0, startSeconds: 0, endSeconds: 90, durationSeconds: 90 },
    ]);
  });
});
