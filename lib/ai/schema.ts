import { z } from "zod";

export const structuredBriefSchema = z
  .object({
    client: z.record(z.unknown()).default({}),
    conversation: z.record(z.unknown()).default({}),
    needs: z.record(z.unknown()).default({}),
    commercial: z.record(z.unknown()).default({}),
    recommended_services: z.array(z.record(z.unknown())).default([]),
    requirements: z.record(z.unknown()).default({}),
    risks: z.array(z.unknown()).default([]),
    tasks: z.record(z.unknown()).default({}),
    next_steps: z.array(z.unknown()).default([]),
    questions_for_client: z.array(z.unknown()).default([]),
  })
  .passthrough();

export function parseJsonFromModel(text: string) {
  const trimmed = text.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = jsonBlock ? jsonBlock[1] : trimmed;
  return structuredBriefSchema.parse(JSON.parse(candidate));
}
