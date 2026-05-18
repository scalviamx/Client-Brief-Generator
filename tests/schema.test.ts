import { describe, expect, it } from "vitest";
import { parseJsonFromModel } from "@/lib/ai/schema";

describe("structured JSON parsing", () => {
  it("parses raw JSON", () => {
    const result = parseJsonFromModel(
      JSON.stringify({
        client: { name: "Ana" },
        conversation: {},
        needs: {},
        commercial: {},
        recommended_services: [],
        requirements: {},
        risks: [],
        tasks: {},
        next_steps: [],
        questions_for_client: [],
      }),
    );

    expect(result.client).toEqual({ name: "Ana" });
  });

  it("parses fenced JSON", () => {
    const result = parseJsonFromModel(`\`\`\`json
{
  "client": {},
  "conversation": {},
  "needs": {},
  "commercial": {},
  "recommended_services": [],
  "requirements": {},
  "risks": [],
  "tasks": {},
  "next_steps": ["Enviar resumen"],
  "questions_for_client": []
}
\`\`\``);

    expect(result.next_steps).toEqual(["Enviar resumen"]);
  });
});
