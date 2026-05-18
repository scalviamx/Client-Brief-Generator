import fs from "node:fs";
import Groq from "groq-sdk";
import { getRuntimeConfig } from "@/lib/config";
import { buildBriefPrompt, buildStructuredJsonPrompt, buildTranscriptCleanupPrompt } from "@/lib/ai/prompts";
import { parseJsonFromModel } from "@/lib/ai/schema";

function getGroqClient() {
  const config = getRuntimeConfig();
  if (!config.groqApiKey) {
    throw new Error("Falta GROQ_API_KEY en .env.");
  }
  return new Groq({ apiKey: config.groqApiKey });
}

export async function transcribeChunk(chunkPath: string) {
  const config = getRuntimeConfig();
  const client = getGroqClient();
  const result = await client.audio.transcriptions.create({
    file: fs.createReadStream(chunkPath),
    model: config.groqTranscriptionModel,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    language: "es",
    temperature: 0,
  });

  return "text" in result && typeof result.text === "string" ? result.text.trim() : JSON.stringify(result);
}

async function runAnalysisPrompt(prompt: string) {
  const config = getRuntimeConfig();
  const client = getGroqClient();
  const response = await client.chat.completions.create({
    model: config.groqAnalysisModel,
    messages: [
      {
        role: "system",
        content: "Eres un asistente comercial preciso. No inventes información y respeta el formato pedido.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Groq no devolvió contenido para el análisis.");
  }
  return content;
}

export async function cleanTranscript(rawTranscript: string) {
  return runAnalysisPrompt(buildTranscriptCleanupPrompt(rawTranscript));
}

export async function generateBrief(cleanTranscriptText: string, metadata: Record<string, unknown>) {
  return runAnalysisPrompt(buildBriefPrompt(cleanTranscriptText, metadata));
}

export async function generateStructuredJson(brief: string, cleanTranscriptText: string, metadata: Record<string, unknown>) {
  const rawJson = await runAnalysisPrompt(buildStructuredJsonPrompt(brief, cleanTranscriptText, metadata));
  return parseJsonFromModel(rawJson);
}
