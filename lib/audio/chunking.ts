export type AudioChunkRange = {
  index: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

export function calculateChunkRanges(
  durationSeconds: number,
  chunkSeconds: number,
  overlapSeconds: number,
): AudioChunkRange[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return [];
  }

  const safeChunkSeconds = Math.max(1, Math.floor(chunkSeconds));
  const safeOverlapSeconds = Math.max(0, Math.min(Math.floor(overlapSeconds), safeChunkSeconds - 1));
  const ranges: AudioChunkRange[] = [];
  let startSeconds = 0;

  while (startSeconds < durationSeconds) {
    const endSeconds = Math.min(durationSeconds, startSeconds + safeChunkSeconds);
    ranges.push({
      index: ranges.length,
      startSeconds,
      endSeconds,
      durationSeconds: endSeconds - startSeconds,
    });

    if (endSeconds >= durationSeconds) {
      break;
    }

    startSeconds = endSeconds - safeOverlapSeconds;
  }

  return ranges;
}
