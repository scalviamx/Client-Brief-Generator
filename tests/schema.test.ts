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

  it("normalizes recommended services returned as strings", () => {
    const result = parseJsonFromModel(`{
      "client": "No mencionado",
      "conversation": {},
      "needs": {},
      "commercial": {},
      "recommended_services": ["Landing page", "WhatsApp Business"],
      "requirements": {},
      "risks": "Presupuesto no mencionado",
      "tasks": {},
      "next_steps": "Enviar seguimiento",
      "questions_for_client": []
    }`);

    expect(result.client).toEqual({ summary: "No mencionado" });
    expect(result.recommended_services[0]).toEqual({
      service: "Landing page",
      reason: "No mencionado",
      priority: "No mencionado",
      evidence: "No mencionado",
    });
    expect(result.risks).toEqual(["Presupuesto no mencionado"]);
    expect(result.next_steps).toEqual(["Enviar seguimiento"]);
  });
});
