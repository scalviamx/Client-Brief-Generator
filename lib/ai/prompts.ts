export const defaultCleanupPromptTemplate = `Actúa como editor de transcripciones comerciales.

Limpia la siguiente transcripción sin cambiar el significado.

Reglas:
- No inventes información.
- No elimines información importante.
- Corrige puntuación y separación por párrafos.
- Mantén el idioma original.
- Si hay partes confusas, marca: [inaudible] o [no claro].
- Si detectas posibles hablantes, usa etiquetas genéricas: Cliente, Scalvia o Participante.
- No resumas todavía.
- Solo limpia y estructura el transcript.

Transcripción:
{{RAW_TRANSCRIPT}}`;

export const defaultBriefPromptTemplate = `Actúa como analista comercial senior para Scalvia.

Scalvia ofrece landing pages, sitios web, WhatsApp Business, automatización con IA, asistentes de voz, chatbots inteligentes, CRM básico, manejo de redes sociales, embudos de captación, automatización operativa y consultoría digital para negocios pequeños y medianos.

Genera un brief comercial claro, accionable y útil para preparar una propuesta.

Reglas:
- No inventes información.
- Si algo no fue mencionado, escribe: "No mencionado".
- Si algo es una inferencia razonable, márcalo como: [Inferencia].
- Separa lo que dijo el cliente de lo que propuso Scalvia.
- Usa español de México.
- Mantén formato Markdown.

Metadata capturada:
{{METADATA}}

Estructura obligatoria:
# Brief de Cliente
## 1. Resumen Ejecutivo
## 2. Participantes Detectados
## 3. Contexto del Cliente
## 4. Situación Actual
## 5. Problemas Detectados
## 6. Objetivos del Cliente
## 7. Necesidades Explícitas
## 8. Necesidades Implícitas
## 9. Servicios de Scalvia que Aplican
## 10. Servicios que NO Conviene Ofrecer Todavía
## 11. Información Comercial
## 12. Alcance Inicial Recomendado
## 13. Requerimientos Funcionales
## 14. Requerimientos No Funcionales
## 15. Riesgos / Ambigüedades
## 16. Preguntas Pendientes para el Cliente
## 17. Próximos Pasos
## 18. Tareas Internas por Responsable
## 19. Mensaje Corto para WhatsApp
## 20. Follow-up Email

Transcripción:
{{CLEAN_TRANSCRIPT}}`;

export const defaultJsonPromptTemplate = `Devuelve únicamente JSON válido. No incluyas markdown.

A partir del brief, la transcripción y la metadata, genera este objeto mínimo:
{
  "client": {},
  "conversation": {},
  "needs": {},
  "commercial": {},
  "recommended_services": [
    {
      "service": "",
      "reason": "",
      "priority": "",
      "evidence": ""
    }
  ],
  "services": {
    "recommended": [],
    "not_yet": []
  },
  "requirements": {},
  "risks": [],
  "proposal": {
    "phases": []
  },
  "tasks": {},
  "internal_tasks": [],
  "next_steps": [],
  "follow_up": {
    "whatsapp": "",
    "email": ""
  },
  "questions_for_client": []
}

Reglas:
- No inventes información.
- Usa "No mencionado" cuando falte un dato.
- Marca inferencias como "[Inferencia] ...".
- Cada elemento de recommended_services debe ser un objeto, nunca un string.
- risks, next_steps, internal_tasks y questions_for_client deben ser arrays.
- follow_up.whatsapp debe ser un mensaje breve listo para copiar.
- follow_up.email debe ser un email breve listo para enviar.
- Responde en español de México.

Metadata:
{{METADATA}}

Brief:
{{BRIEF}}

Transcripción:
{{CLEAN_TRANSCRIPT}}`;

export type PromptOverrides = {
  cleanupPrompt?: string;
  briefPrompt?: string;
  jsonPrompt?: string;
};

export function buildTranscriptCleanupPrompt(rawTranscript: string, promptTemplate?: string) {
  return applyPromptTemplate(promptTemplate || defaultCleanupPromptTemplate, {
    RAW_TRANSCRIPT: rawTranscript,
  });
}

export function buildBriefPrompt(cleanTranscript: string, metadata: Record<string, unknown>, promptTemplate?: string) {
  return applyPromptTemplate(promptTemplate || defaultBriefPromptTemplate, {
    CLEAN_TRANSCRIPT: cleanTranscript,
    METADATA: JSON.stringify(metadata, null, 2),
  });
}

export function buildStructuredJsonPrompt(
  brief: string,
  cleanTranscript: string,
  metadata: Record<string, unknown>,
  promptTemplate?: string,
) {
  return applyPromptTemplate(promptTemplate || defaultJsonPromptTemplate, {
    BRIEF: brief,
    CLEAN_TRANSCRIPT: cleanTranscript,
    METADATA: JSON.stringify(metadata, null, 2),
  });
}

function applyPromptTemplate(template: string, values: Record<string, string>) {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }
  return output;
}
