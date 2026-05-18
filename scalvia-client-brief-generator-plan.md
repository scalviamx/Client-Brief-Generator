# Scalvia Client Brief Generator

## 1. Idea General

Crear una herramienta local en `localhost` para subir audios de conversaciones con clientes —grabados desde iPhone, Apple Watch u otro dispositivo— y convertirlos automáticamente en:

- Transcripción completa
- Brief comercial
- Resumen ejecutivo
- Requerimientos del cliente
- Propuesta preliminar
- Lista de tareas internas
- Preguntas pendientes
- Output en Markdown y JSON

La herramienta debe estar pensada para llamadas o reuniones de 30 minutos, 45 minutos, 1 hora o incluso 2 horas.

---

## 2. Problema que Resuelve

Actualmente, después de una llamada larga con un cliente, mucha información queda dispersa:

- Necesidades del cliente
- Ideas mencionadas en la llamada
- Posibles servicios a ofrecer
- Objeciones
- Alcance del proyecto
- Pendientes internos
- Próximos pasos
- Detalles que se pueden olvidar

Esta herramienta convierte la conversación completa en documentación accionable para Scalvia.

---

## 3. Flujo General

```text
Audio grabado con Apple Watch / iPhone
→ Subida manual a la herramienta local
→ Validación del archivo
→ Conversión de audio
→ División automática en fragmentos
→ Transcripción por fragmento
→ Unión de transcripción completa
→ Limpieza de transcript
→ Análisis con IA
→ Brief comercial
→ Propuesta inicial
→ Exportación a .md / JSON
```

---

## 4. Input de Audio

### Formatos Esperados

La herramienta debe aceptar inicialmente:

- `.m4a`
- `.mp3`
- `.wav`
- `.mp4`
- `.aac`

Apple Watch y iPhone normalmente generan archivos compatibles como `.m4a` o audio dentro de notas/voice memos.

### Flujo Manual Inicial

Para el MVP:

1. Grabar la cita con Apple Watch o iPhone.
2. Exportar o compartir el archivo de audio.
3. Guardarlo en el celular, iCloud Drive, Google Drive o Mac.
4. Subirlo manualmente a la herramienta en `localhost`.
5. La herramienta procesa todo automáticamente.

---

## 5. Manejo de Audios Grandes

### Pregunta Clave

¿Qué pasa si el audio dura 47 minutos, 1 hora o 2 horas?

### Respuesta

La herramienta debe dividir el audio automáticamente en partes más pequeñas. El usuario no debe cortar nada manualmente.

El backend debe encargarse de:

1. Detectar duración del audio.
2. Convertirlo a un formato optimizado.
3. Dividirlo en chunks.
4. Transcribir cada chunk.
5. Unir todos los textos en orden.
6. Analizar la conversación completa.

---

## 6. Estrategia de Chunking

### Chunking por Tiempo

Para el MVP, usar división por tiempo fijo.

Recomendación inicial:

```text
Chunk duration: 7 minutos
Overlap: 10-15 segundos
Formato: mp3 mono 16khz
```

Ejemplo para audio de 47 minutos:

```text
cliente_001_part_01.mp3 → 00:00 - 07:00
cliente_001_part_02.mp3 → 06:45 - 14:00
cliente_001_part_03.mp3 → 13:45 - 21:00
cliente_001_part_04.mp3 → 20:45 - 28:00
cliente_001_part_05.mp3 → 27:45 - 35:00
cliente_001_part_06.mp3 → 34:45 - 42:00
cliente_001_part_07.mp3 → 41:45 - 47:00
```

El overlap ayuda a no perder frases cortadas entre un fragmento y otro.

### Chunking por Silencios

Para una versión más avanzada, se puede cortar por silencios naturales.

Ejemplo:

```text
Detectar pausas de más de 700ms
Cortar cerca de silencios
Evitar cortar frases a medias
Mantener chunks entre 5 y 10 minutos
```

Para MVP no es obligatorio. Tiempo fijo + overlap es suficiente.

---

## 7. Por Qué No Subir el Audio Completo Directo

Aunque algunos modelos soportan audios largos, conviene dividir porque:

- Reduce errores por tamaño del archivo
- Evita timeouts
- Permite reintentar solo un chunk si falla
- Hace el proceso más estable
- Permite mostrar progreso
- Facilita audios de 1-2 horas
- Permite paralelizar transcripciones después

---

## 8. MVPs

## MVP 1 — Local Manual Processor

Objetivo: procesar un audio largo y generar un brief.

### Features

- Upload manual de audio
- Validación de archivo
- Conversión con FFmpeg
- Chunking automático
- Transcripción por chunk
- Unión de transcript
- Generación de brief
- Exportación `.md`
- Guardado local en carpetas

### No incluye todavía

- Login
- Base de datos compleja
- Notion
- Google Drive
- CRM
- Procesamiento automático desde Apple Watch
- Multiusuario

---

## MVP 2 — Historial por Cliente

Objetivo: guardar conversaciones y consultar briefs anteriores.

### Features

- Crear cliente
- Asociar audios a cliente
- Historial de llamadas
- Buscar por cliente
- Buscar por palabra clave
- Guardar transcript y brief
- Exportar JSON estructurado

---

## MVP 3 — Generador de Propuestas

Objetivo: convertir el brief en propuesta comercial.

### Features

- Botón: “Generar propuesta”
- Botón: “Generar alcance”
- Botón: “Generar estimación”
- Botón: “Generar mensaje para WhatsApp”
- Botón: “Generar follow-up email”
- Plantillas por tipo de servicio:
  - Landing page
  - WhatsApp Business
  - CRM
  - Redes sociales
  - Asistente IA
  - Automatización interna

---

## MVP 4 — Integraciones

Objetivo: conectar la herramienta al flujo operativo de Scalvia.

### Integraciones posibles

- Notion
- Google Drive
- Google Docs
- Gmail
- Telegram
- WhatsApp interno
- n8n
- Qase/Jira no es prioridad para este producto, salvo que luego se use para proyectos técnicos.

---

## MVP 5 — Producto Vendible

Objetivo: convertir la herramienta en un SaaS o producto para clientes.

### Posicionamiento posible

```text
Sube tus llamadas con clientes y recibe briefs comerciales, tareas, propuestas y próximos pasos en minutos.
```

### Audiencia

- Agencias
- Consultores
- Vendedores
- Brokers
- Despachos
- Clínicas
- Barberías/franquicias
- Negocios con muchas llamadas de venta

---

## 9. Arquitectura Recomendada

## Stack MVP

```text
Frontend:
Next.js

Backend:
Next.js API Routes o Express

Audio:
FFmpeg

Transcripción:
Groq Whisper / OpenAI / Whisper local

Análisis:
OpenAI / Groq LLM

Storage:
Sistema de archivos local

Base de datos inicial:
JSON o SQLite
```

---

## 10. Estructura de Carpetas

```bash
scalvia-client-brief-generator/
  app/
    page.tsx
    api/
      upload/
        route.ts
      transcribe/
        route.ts
      analyze/
        route.ts
      export/
        route.ts

  components/
    AudioUploader.tsx
    ProcessingStatus.tsx
    BriefViewer.tsx
    TranscriptViewer.tsx
    ExportButtons.tsx

  lib/
    audio/
      convertAudio.ts
      chunkAudio.ts
      getAudioDuration.ts

    ai/
      transcribeChunk.ts
      mergeTranscript.ts
      cleanTranscript.ts
      analyzeTranscript.ts

    export/
      exportMarkdown.ts
      exportJson.ts

    storage/
      saveUpload.ts
      saveTranscript.ts
      saveBrief.ts

  prompts/
    brief-analysis.md
    transcript-cleanup.md
    proposal-generator.md

  storage/
    uploads/
    processed/
    chunks/
    transcripts/
    briefs/
    json/

  package.json
  .env
  README.md
```

---

## 11. Variables de Entorno

```bash
GROQ_API_KEY=your_groq_key_here
OPENAI_API_KEY=your_openai_key_here

TRANSCRIPTION_PROVIDER=groq
ANALYSIS_PROVIDER=openai

UPLOAD_DIR=./storage/uploads
PROCESSED_DIR=./storage/processed
CHUNKS_DIR=./storage/chunks
TRANSCRIPTS_DIR=./storage/transcripts
BRIEFS_DIR=./storage/briefs
JSON_DIR=./storage/json

CHUNK_MINUTES=7
CHUNK_OVERLAP_SECONDS=15
```

---

## 12. Comando FFmpeg para Convertir Audio

Convertir cualquier audio a formato optimizado:

```bash
ffmpeg -i input.m4a -ac 1 -ar 16000 -b:a 64k output.mp3
```

Explicación:

```text
-ac 1      → mono
-ar 16000  → 16khz
-b:a 64k   → bitrate bajo pero suficiente para voz
```

---

## 13. Comando FFmpeg para Dividir Audio

Ejemplo: chunks de 7 minutos.

```bash
ffmpeg -i output.mp3 -f segment -segment_time 420 -c copy chunks/part_%03d.mp3
```

Con overlap exacto se requiere lógica adicional desde Node, porque FFmpeg segment simple no aplica overlap automáticamente.

Para MVP se puede empezar sin overlap y luego agregarlo.

---

## 14. Estados del Proceso

La UI debe mostrar algo como:

```text
1. Audio recibido
2. Validando archivo
3. Convirtiendo audio
4. Detectando duración
5. Dividiendo audio en 7 partes
6. Transcribiendo parte 1/7
7. Transcribiendo parte 2/7
8. Transcribiendo parte 3/7
9. Transcribiendo parte 4/7
10. Transcribiendo parte 5/7
11. Transcribiendo parte 6/7
12. Transcribiendo parte 7/7
13. Uniendo transcripción
14. Limpiando transcript
15. Generando brief
16. Guardando archivos
17. Listo
```

---

## 15. Output Principal

La herramienta debe generar al menos 3 archivos:

```text
/transcripts/cliente-fecha-transcript.md
/briefs/cliente-fecha-brief.md
/json/cliente-fecha-data.json
```

---

## 16. Prompt: Limpieza de Transcript

```text
Actúa como editor de transcripciones comerciales.

Vas a recibir una transcripción generada automáticamente desde audio. Tu tarea es limpiarla sin cambiar el significado.

Reglas:
- No inventes información.
- No elimines información importante.
- Corrige puntuación y separación por párrafos.
- Mantén el idioma original.
- Si hay partes confusas, marca: [inaudible] o [no claro].
- Si detectas posibles hablantes, usa etiquetas genéricas:
  - Cliente:
  - Scalvia:
  - Participante:
- No resumas todavía.
- No conviertas la conversación en brief.
- Solo limpia y estructura el transcript.

Transcripción:
{{RAW_TRANSCRIPT}}
```

---

## 17. Prompt: Brief Comercial

```text
Actúa como analista comercial senior para Scalvia.

Scalvia ofrece:
- Landing pages
- Sitios web
- WhatsApp Business
- Automatización con IA
- Asistentes de voz
- Chatbots inteligentes
- CRM básico
- Manejo de redes sociales
- Embudos de captación
- Automatización operativa
- Consultoría digital para negocios pequeños y medianos

Vas a recibir la transcripción completa de una conversación con un cliente.

Tu tarea es generar un brief comercial claro, accionable y útil para preparar una propuesta.

Reglas:
- No inventes información.
- Si algo no fue mencionado, escribe: "No mencionado".
- Si algo es una inferencia razonable, márcalo como: [Inferencia].
- Separa lo que dijo el cliente de lo que propuso Scalvia.
- Extrae necesidades explícitas.
- Extrae necesidades implícitas.
- Detecta señales de compra.
- Detecta objeciones.
- Detecta urgencia.
- Detecta presupuesto si fue mencionado.
- Detecta tareas internas.
- Detecta preguntas pendientes.
- Usa español de México.
- Mantén formato Markdown.

Estructura obligatoria:

# Brief de Cliente

## 1. Resumen Ejecutivo

## 2. Participantes Detectados

## 3. Contexto del Cliente
- Nombre del cliente:
- Nombre del negocio:
- Industria:
- Ubicación:
- Estado actual del negocio:
- Canal actual de ventas:
- Herramientas actuales:

## 4. Situación Actual

## 5. Problemas Detectados

## 6. Objetivos del Cliente

## 7. Necesidades Explícitas

## 8. Necesidades Implícitas

## 9. Servicios de Scalvia que Aplican

Para cada servicio incluir:
- Servicio:
- Por qué aplica:
- Prioridad:
- Evidencia desde la conversación:

## 10. Servicios que NO Conviene Ofrecer Todavía

## 11. Información Comercial
- Presupuesto mencionado:
- Urgencia:
- Fecha objetivo:
- Tomador de decisión:
- Nivel de interés:
- Señales de compra:
- Objeciones:

## 12. Alcance Inicial Recomendado

## 13. Requerimientos Funcionales

## 14. Requerimientos No Funcionales

## 15. Riesgos / Ambigüedades

## 16. Preguntas Pendientes para el Cliente

## 17. Próximos Pasos

## 18. Tareas Internas por Responsable

### Roberto

### Reynaldo

### Scalvia

## 19. Propuesta Inicial Recomendada

## 20. Mensaje Corto para WhatsApp

## 21. Resumen para Notion

## 22. JSON Estructurado

Transcripción:
{{CLEAN_TRANSCRIPT}}
```

---

## 18. Prompt: Generador de Propuesta

```text
Actúa como estratega comercial de Scalvia.

Vas a recibir un brief de cliente generado a partir de una llamada.

Tu tarea es crear una propuesta inicial clara, profesional y fácil de enviar al cliente.

Reglas:
- No inventes datos no mencionados.
- Si falta información, usa "[Pendiente por confirmar]".
- No prometas resultados garantizados.
- Mantén tono profesional, claro y comercial.
- Usa español de México.
- Divide la propuesta por fases.
- Incluye alcance, entregables y próximos pasos.
- No incluyas precios exactos salvo que el usuario los proporcione.

Estructura:

# Propuesta Inicial — Scalvia

## 1. Contexto

## 2. Objetivo del Proyecto

## 3. Solución Recomendada

## 4. Fase 1 — Base Digital

## 5. Fase 2 — Automatización / Seguimiento

## 6. Fase 3 — Optimización

## 7. Entregables

## 8. Lo que No Incluye por Ahora

## 9. Información Pendiente

## 10. Próximos Pasos

Brief:
{{BRIEF}}
```

---

## 19. Prompt: Tareas Internas

```text
Actúa como project manager interno de Scalvia.

A partir del siguiente brief, genera una lista de tareas accionables para el equipo.

Reglas:
- No inventes tareas que no estén relacionadas con el brief.
- Marca dependencias.
- Separa tareas por responsable.
- Usa formato checklist.
- Incluye prioridad: Alta, Media, Baja.
- Incluye si la tarea es comercial, diseño, técnica, contenido o seguimiento.

Responsables disponibles:
- Roberto
- Reynaldo
- Scalvia

Brief:
{{BRIEF}}
```

---

## 20. JSON Estructurado Esperado

```json
{
  "client": {
    "name": "",
    "business_name": "",
    "industry": "",
    "location": "",
    "decision_maker": "",
    "contact_info": ""
  },
  "conversation": {
    "date": "",
    "duration_minutes": "",
    "participants": [],
    "type": "",
    "audio_file": "",
    "transcript_file": ""
  },
  "needs": {
    "explicit": [],
    "implicit": [],
    "pain_points": [],
    "goals": []
  },
  "commercial": {
    "budget": "",
    "urgency": "",
    "buying_signals": [],
    "objections": [],
    "interest_level": ""
  },
  "recommended_services": [
    {
      "service": "",
      "reason": "",
      "priority": "",
      "evidence": ""
    }
  ],
  "not_recommended_yet": [],
  "requirements": {
    "functional": [],
    "non_functional": []
  },
  "risks": [],
  "ambiguities": [],
  "tasks": {
    "roberto": [],
    "reynaldo": [],
    "scalvia": []
  },
  "next_steps": [],
  "proposal_draft": "",
  "questions_for_client": []
}
```

---

## 21. UI Sugerida

### Página Principal

```text
Scalvia Client Brief Generator

[Nombre del cliente]
[Nombre del negocio]
[Tipo de llamada]
[Participantes internos]
[Upload audio]

[Procesar Audio]
```

### Página de Resultado

Tabs:

```text
Overview
Transcript
Brief
Propuesta
Tareas
JSON
Export
```

---

## 22. Reglas de Calidad

La herramienta debe:

- Nunca inventar información
- Marcar inferencias
- Marcar información no mencionada
- Separar hechos de recomendaciones
- Guardar transcript original
- Guardar transcript limpio
- Guardar brief
- Guardar JSON
- Permitir reprocesar con otro prompt
- Permitir copiar output fácilmente

---

## 23. Plan de Construcción para Codex

### Paso 1

Crear proyecto Next.js.

### Paso 2

Crear UI básica de upload.

### Paso 3

Crear endpoint `/api/upload`.

### Paso 4

Guardar archivo en `/storage/uploads`.

### Paso 5

Agregar FFmpeg para convertir audio.

### Paso 6

Crear función `chunkAudio.ts`.

### Paso 7

Crear endpoint `/api/transcribe`.

### Paso 8

Transcribir chunks uno por uno.

### Paso 9

Guardar transcript bruto.

### Paso 10

Crear prompt de limpieza.

### Paso 11

Crear prompt de brief comercial.

### Paso 12

Guardar output Markdown.

### Paso 13

Guardar output JSON.

### Paso 14

Crear UI de resultados.

### Paso 15

Agregar botón de descarga `.md`.

---

## 24. Primera Versión Técnica Mínima

La primera versión puede ser tan simple como:

```text
Upload audio
→ Procesar
→ Mostrar transcript
→ Mostrar brief
→ Descargar .md
```

No hace falta construir todo desde el día uno.

---

## 25. Prioridad Recomendada

Construir en este orden:

```text
1. Upload
2. FFmpeg conversion
3. Chunking
4. Transcription
5. Transcript merge
6. Brief prompt
7. Markdown export
8. JSON export
9. UI improvements
10. Client history
```

---

## 26. Notas Importantes

- El usuario no debe dividir el audio manualmente.
- La herramienta debe soportar audios largos desde el inicio.
- Para 47 minutos, 1 hora o 2 horas, el flujo debe ser el mismo.
- El chunking debe ser transparente para el usuario.
- El MVP puede funcionar completamente en local.
- La integración con Apple Watch puede ser manual al inicio.
- Automatizar desde iCloud/Drive puede venir después.
