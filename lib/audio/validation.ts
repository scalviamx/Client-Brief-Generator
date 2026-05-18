import path from "node:path";
import { allowedAudioExtensions } from "@/lib/config";

export function sanitizeBaseName(input: string) {
  const parsed = path.parse(input);
  const base = parsed.name || "audio";
  return base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .toLowerCase() || "audio";
}

export function getSafeAudioFilename(originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return `${sanitizeBaseName(originalName)}${extension}`;
}

export function validateAudioUpload(originalName: string, sizeBytes: number, maxUploadMb: number) {
  const extension = path.extname(originalName).toLowerCase();

  if (!allowedAudioExtensions.includes(extension as (typeof allowedAudioExtensions)[number])) {
    return {
      ok: false,
      error: `Formato no soportado. Usa ${allowedAudioExtensions.join(", ")}.`,
    };
  }

  const maxBytes = maxUploadMb * 1024 * 1024;
  if (sizeBytes <= 0) {
    return { ok: false, error: "El archivo está vacío." };
  }

  if (sizeBytes > maxBytes) {
    return { ok: false, error: `El archivo excede el límite de ${maxUploadMb} MB.` };
  }

  return { ok: true, error: "" };
}
