type TranscriptPart = {
  heading: string;
  text: string;
};

export function mergeChunkTranscripts(parts: TranscriptPart[]) {
  const merged: string[] = [];
  let previousText = "";

  for (const part of parts) {
    const text = part.text.trim();
    const deduped = previousText ? removeOverlappingPrefix(previousText, text) : text;
    merged.push(`${part.heading}\n\n${deduped.trim()}`);
    previousText = `${previousText} ${deduped}`.trim();
  }

  return merged.join("\n\n");
}

export function removeOverlappingPrefix(previous: string, current: string, maxWords = 80) {
  const previousWords = normalizeWords(previous).slice(-maxWords);
  const currentWords = normalizeWords(current).slice(0, maxWords);
  let bestOverlap = 0;

  for (let size = Math.min(previousWords.length, currentWords.length); size >= 8; size -= 1) {
    const previousSlice = previousWords.slice(previousWords.length - size).join(" ");
    const currentSlice = currentWords.slice(0, size).join(" ");
    if (previousSlice === currentSlice) {
      bestOverlap = size;
      break;
    }
  }

  if (!bestOverlap) {
    return current;
  }

  return current.split(/\s+/).slice(bestOverlap).join(" ");
}

function normalizeWords(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
