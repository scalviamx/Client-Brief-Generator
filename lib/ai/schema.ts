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

const followUpSchema = z
  .union([z.record(z.unknown()), z.string(), z.null()])
  .transform((value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return {
        whatsapp: typeof value.whatsapp === "string" ? value.whatsapp : "No mencionado",
        email: typeof value.email === "string" ? value.email : "No mencionado",
        ...value,
      };
    }
    if (typeof value === "string") {
      return { whatsapp: value, email: "No mencionado" };
    }
    return { whatsapp: "No mencionado", email: "No mencionado" };
  });

export const structuredBriefSchema = z
  .object({
    client: flexibleRecord.default({}),
    conversation: flexibleRecord.default({}),
    needs: flexibleRecord.default({}),
    commercial: flexibleRecord.default({}),
    recommended_services: z.array(recommendedServiceSchema).default([]),
    services: flexibleRecord.default({}),
    requirements: flexibleRecord.default({}),
    risks: flexibleArray.default([]),
    proposal: flexibleRecord.default({}),
    tasks: flexibleRecord.default({}),
    internal_tasks: flexibleArray.default([]),
    next_steps: flexibleArray.default([]),
    follow_up: followUpSchema.default({ whatsapp: "No mencionado", email: "No mencionado" }),
    questions_for_client: flexibleArray.default([]),
  })
  .passthrough();

export function parseJsonFromModel(text: string) {
  const trimmed = text.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = jsonBlock ? jsonBlock[1] : trimmed;
  return structuredBriefSchema.parse(JSON.parse(candidate));
}
