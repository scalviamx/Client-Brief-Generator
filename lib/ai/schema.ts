import { z } from "zod";

const flexibleRecord = z
  .union([z.record(z.unknown()), z.string(), z.array(z.unknown()), z.null()])
  .transform((value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      return { items: value };
    }
    if (typeof value === "string") {
      return { summary: value };
    }
    return {};
  });

const flexibleArray = z
  .union([z.array(z.unknown()), z.string(), z.null()])
  .transform((value) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      return [value];
    }
    return [];
  });

const recommendedServiceSchema = z
  .union([z.record(z.unknown()), z.string()])
  .transform((value) => {
    if (typeof value === "string") {
      return {
        service: value,
        reason: "No mencionado",
        priority: "No mencionado",
        evidence: "No mencionado",
      };
    }
    return value;
  });

export const structuredBriefSchema = z
  .object({
    client: flexibleRecord.default({}),
    conversation: flexibleRecord.default({}),
    needs: flexibleRecord.default({}),
    commercial: flexibleRecord.default({}),
    recommended_services: z.array(recommendedServiceSchema).default([]),
    requirements: flexibleRecord.default({}),
    risks: flexibleArray.default([]),
    tasks: flexibleRecord.default({}),
    next_steps: flexibleArray.default([]),
    questions_for_client: flexibleArray.default([]),
  })
  .passthrough();

export function parseJsonFromModel(text: string) {
  const trimmed = text.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = jsonBlock ? jsonBlock[1] : trimmed;
  return structuredBriefSchema.parse(JSON.parse(candidate));
}
