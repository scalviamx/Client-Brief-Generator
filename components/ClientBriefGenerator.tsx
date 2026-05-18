"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Copy,
  Download,
  FileArchive,
  FileAudio,
  FileJson,
  FileText,
  Loader2,
  Play,
  RefreshCcw,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import { defaultBriefPromptTemplate, defaultCleanupPromptTemplate, defaultJsonPromptTemplate } from "@/lib/ai/prompts";

type JobStatus =
  | "queued"
  | "validating"
  | "converting"
  | "chunking"
  | "transcribing"
  | "cleaning"
  | "analyzing"
  | "exporting"
  | "complete"
  | "failed";

type ArtifactType = "raw_transcript" | "merged_transcript" | "clean_transcript" | "brief_markdown" | "structured_json" | "export_zip";
type OutputTab = "clean_transcript" | "brief_markdown" | "structured_json" | "export";
type JobAction = "regenerate_json" | "regenerate_brief" | "regenerate_clean_transcript" | "reprocess_all";

type PromptOverrides = {
  cleanupPrompt?: string;
  briefPrompt?: string;
  jsonPrompt?: string;
};

type JobResponse = {
  id: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  metadata: Record<string, string> & {
    promptOverrides?: PromptOverrides;
    processing?: Record<string, unknown>;
  };
  originalFileName: string;
  metrics?: Record<string, unknown>;
  chunks: Array<{
    index: number;
    startSeconds: number;
    endSeconds: number;
    status: string;
    error: string | null;
  }>;
  artifacts: Array<{
    type: ArtifactType;
    url: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

const statusLabels: Record<JobStatus, string> = {
  queued: "En cola",
  validating: "Validando",
  converting: "Convirtiendo audio",
  chunking: "Dividiendo audio",
  transcribing: "Transcribiendo",
  cleaning: "Limpiando transcript",
  analyzing: "Generando brief",
  exporting: "Guardando archivos",
  complete: "Listo",
  failed: "Error",
};

const actionStatus: Record<JobAction, JobStatus> = {
  regenerate_json: "exporting",
  regenerate_brief: "analyzing",
  regenerate_clean_transcript: "cleaning",
  reprocess_all: "queued",
};

const tabs = [
  { id: "clean_transcript", label: "Transcript", icon: FileText },
  { id: "brief_markdown", label: "Brief", icon: FileAudio },
  { id: "structured_json", label: "JSON", icon: FileJson },
  { id: "export", label: "Export", icon: Download },
] as const;

export function ClientBriefGenerator() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [clientName, setClientName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [callType, setCallType] = useState("Primera llamada");
  const [internalParticipants, setInternalParticipants] = useState("Roberto, Reynaldo");
  const [chunkPreset, setChunkPreset] = useState("4:20");
  const [job, setJob] = useState<JobResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<JobAction | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<OutputTab>("clean_transcript");
  const [artifactContent, setArtifactContent] = useState<Partial<Record<ArtifactType, string>>>({});
  const [recentJobs, setRecentJobs] = useState<JobResponse[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [cleanupPrompt, setCleanupPrompt] = useState(defaultCleanupPromptTemplate);
  const [briefPrompt, setBriefPrompt] = useState(defaultBriefPromptTemplate);
  const [jsonPrompt, setJsonPrompt] = useState(defaultJsonPromptTemplate);

  const isRunning = Boolean(job && !["complete", "failed"].includes(job.status));
  const artifactMap = useMemo(() => new Map(job?.artifacts.map((artifact) => [artifact.type, artifact]) ?? []), [job]);
  const currentOutput = activeTab === "export" ? "" : (artifactContent[activeTab] ?? "");
  const whatsappMessage = useMemo(() => extractFollowUp(artifactContent.structured_json, "whatsapp"), [artifactContent.structured_json]);
  const emailMessage = useMemo(() => extractFollowUp(artifactContent.structured_json, "email"), [artifactContent.structured_json]);
  const filteredJobs = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) {
      return recentJobs;
    }
    return recentJobs.filter((item) =>
      [item.metadata.businessName, item.metadata.clientName, item.originalFileName, item.metadata.callType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [historyQuery, recentJobs]);

  useEffect(() => {
    void loadRecentJobs().then(setRecentJobs);
  }, []);

  useEffect(() => {
    if (!job || ["complete", "failed"].includes(job.status)) {
      if (job?.status === "complete" || job?.status === "failed") {
        void loadRecentJobs().then(setRecentJobs);
      }
      return;
    }

    const timer = window.setInterval(async () => {
      const nextJob = await fetchJob(job.id);
      if (nextJob) {
        setJob(nextJob);
        if (nextJob.status === "complete" || nextJob.status === "failed") {
          setActionLoading("");
          void loadRecentJobs().then(setRecentJobs);
        }
      }
    }, 1800);

    return () => window.clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (!job || !["complete", "failed"].includes(job.status)) {
      return;
    }

    void Promise.all(
      (["raw_transcript", "merged_transcript", "clean_transcript", "brief_markdown", "structured_json"] as ArtifactType[]).map(
        async (type) => {
          const artifact = job.artifacts.find((item) => item.type === type);
          if (!artifact || artifactContent[type]) {
            return;
          }
          const response = await fetch(artifact.url);
          if (response.ok) {
            const content = await response.text();
            setArtifactContent((current) => ({ ...current, [type]: content }));
          }
        },
      ),
    );
  }, [artifactContent, job]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!audioFile) {
      setError("Selecciona un audio antes de procesar.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("clientName", clientName);
    formData.append("businessName", businessName);
    formData.append("callType", callType);
    formData.append("internalParticipants", internalParticipants);
    const [chunkMinutes, chunkOverlapSeconds] = chunkPreset.split(":");
    formData.append("chunkMinutes", chunkMinutes);
    formData.append("chunkOverlapSeconds", chunkOverlapSeconds);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo iniciar el proceso.");
      }
      setArtifactContent({});
      setActiveTab("clean_transcript");
      setJob(payload);
      void loadRecentJobs().then(setRecentJobs);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo iniciar el proceso.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setAudioFile(null);
    setJob(null);
    setArtifactContent({});
    setError("");
    setNotice("");
  }

  async function selectRecentJob(jobId: string) {
    setError("");
    setNotice("");
    setArtifactContent({});
    setActiveTab("clean_transcript");
    const nextJob = await fetchJob(jobId);
    if (nextJob) {
      setJob(nextJob);
      setClientName(nextJob.metadata.clientName || "");
      setBusinessName(nextJob.metadata.businessName || "");
      setCallType(nextJob.metadata.callType || "Primera llamada");
      setInternalParticipants(nextJob.metadata.internalParticipants || "Roberto, Reynaldo");
      setChunkPreset(`${nextJob.metadata.chunkMinutes || "4"}:${nextJob.metadata.chunkOverlapSeconds || "20"}`);
      setCleanupPrompt(nextJob.metadata.promptOverrides?.cleanupPrompt || defaultCleanupPromptTemplate);
      setBriefPrompt(nextJob.metadata.promptOverrides?.briefPrompt || defaultBriefPromptTemplate);
      setJsonPrompt(nextJob.metadata.promptOverrides?.jsonPrompt || defaultJsonPromptTemplate);
    }
  }

  async function runJobAction(action: JobAction) {
    if (!job) {
      return;
    }

    setError("");
    setNotice("");
    setActionLoading(action);
    setArtifactContent({});

    try {
      const response = await fetch(`/api/jobs/${job.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          promptOverrides: {
            cleanupPrompt,
            briefPrompt,
            jsonPrompt,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo iniciar la acción.");
      }
      setJob({
        ...payload,
        status: actionStatus[action],
        progress: action === "reprocess_all" ? 0 : payload.progress,
      });
    } catch (requestError) {
      setActionLoading("");
      setError(requestError instanceof Error ? requestError.message : "No se pudo iniciar la acción.");
    }
  }

  async function copyText(label: string, text: string) {
    if (!text.trim()) {
      setNotice(`No hay contenido para copiar: ${label}.`);
      return;
    }
    await navigator.clipboard.writeText(text);
    setNotice(`${label} copiado.`);
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="input-pane">
          <div className="app-title">
            <h1>Scalvia Brief Generator</h1>
            <p>Procesa llamadas locales y genera documentación comercial accionable.</p>
          </div>

          <form className="brief-form" onSubmit={handleSubmit}>
            <label>
              Nombre del cliente
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Ej. Ana Martínez" />
            </label>

            <label>
              Nombre del negocio
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Ej. Clínica Norte" />
            </label>

            <label>
              Tipo de llamada
              <select value={callType} onChange={(event) => setCallType(event.target.value)}>
                <option>Primera llamada</option>
                <option>Discovery</option>
                <option>Seguimiento</option>
                <option>Cierre</option>
                <option>Kickoff</option>
              </select>
            </label>

            <label>
              Participantes internos
              <input value={internalParticipants} onChange={(event) => setInternalParticipants(event.target.value)} />
            </label>

            <label>
              Precisión de chunks
              <select value={chunkPreset} onChange={(event) => setChunkPreset(event.target.value)}>
                <option value="4:20">Alta precisión · 4 min / 20s overlap</option>
                <option value="3:20">Máximo detalle · 3 min / 20s overlap</option>
                <option value="5:20">Balanceado · 5 min / 20s overlap</option>
                <option value="7:15">Rápido · 7 min / 15s overlap</option>
              </select>
            </label>

            <label className="upload-box">
              <Upload size={18} />
              <span>{audioFile ? audioFile.name : "Seleccionar audio"}</span>
              <input
                type="file"
                accept=".m4a,.mp3,.wav,.mp4,.aac,audio/*,video/mp4"
                onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
              />
            </label>

            {error ? <div className="error-message">{error}</div> : null}
            {notice ? <div className="notice-message">{notice}</div> : null}

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={submitting || isRunning}>
                {submitting || isRunning ? <Loader2 className="spin" size={17} /> : <Play size={17} />}
                Procesar audio
              </button>
              <button className="secondary-button" type="button" onClick={resetForm}>
                <RotateCcw size={16} />
                Reiniciar
              </button>
            </div>
          </form>

          <div className="history-panel">
            <div className="history-title">
              <Clock3 size={16} />
              <span>Historial</span>
            </div>
            <label className="search-box">
              <Search size={15} />
              <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Buscar cliente o negocio" />
            </label>
            <div className="history-list">
              {filteredJobs.length ? (
                filteredJobs.map((item) => (
                  <button
                    className={job?.id === item.id ? "history-item active" : "history-item"}
                    key={item.id}
                    onClick={() => void selectRecentJob(item.id)}
                    type="button"
                  >
                    <span>{item.metadata.businessName || item.metadata.clientName || item.originalFileName}</span>
                    <small>
                      {statusLabels[item.status]} · {formatDate(item.createdAt)}
                    </small>
                  </button>
                ))
              ) : (
                <p className="empty-history">No hay jobs para esa búsqueda.</p>
              )}
            </div>
          </div>
        </aside>

        <section className="result-pane">
          <div className="status-bar">
            <div>
              <h2>{job ? statusLabels[job.status] : "Esperando audio"}</h2>
              <p>{job ? job.originalFileName : "Sube una grabación de cliente para iniciar el pipeline."}</p>
            </div>
            <span className={`status-pill ${job?.status === "failed" ? "failed" : ""}`}>{job ? `${job.progress}%` : "0%"}</span>
          </div>

          <div className="progress-track" aria-label="Progreso">
            <div style={{ width: `${job?.progress ?? 0}%` }} />
          </div>

          <MetricsStrip job={job} />

          {job?.error ? <div className="error-message">{job.error}</div> : null}

          <div className="pipeline-list">
            {Object.entries(statusLabels)
              .filter(([status]) => !["failed"].includes(status))
              .map(([status, label]) => (
                <div className={getStepClass(job?.status, status as JobStatus)} key={status}>
                  <span>{label}</span>
                </div>
              ))}
          </div>

          <div className="action-row">
            <button disabled={!job || isRunning} onClick={() => void runJobAction("regenerate_json")} type="button">
              {actionLoading === "regenerate_json" ? <Loader2 className="spin" size={15} /> : <RefreshCcw size={15} />}
              Reintentar JSON
            </button>
            <button disabled={!job || isRunning} onClick={() => void runJobAction("regenerate_brief")} type="button">
              {actionLoading === "regenerate_brief" ? <Loader2 className="spin" size={15} /> : <RefreshCcw size={15} />}
              Regenerar brief
            </button>
            <button disabled={!job || isRunning} onClick={() => void runJobAction("regenerate_clean_transcript")} type="button">
              {actionLoading === "regenerate_clean_transcript" ? <Loader2 className="spin" size={15} /> : <RefreshCcw size={15} />}
              Regenerar transcript
            </button>
            <button disabled={!job || isRunning} onClick={() => void runJobAction("reprocess_all")} type="button">
              {actionLoading === "reprocess_all" ? <Loader2 className="spin" size={15} /> : <RefreshCcw size={15} />}
              Reprocesar todo
            </button>
          </div>

          <details className="prompt-editor">
            <summary>Prompts de reproceso</summary>
            <label>
              Limpieza
              <textarea value={cleanupPrompt} onChange={(event) => setCleanupPrompt(event.target.value)} />
            </label>
            <label>
              Brief
              <textarea value={briefPrompt} onChange={(event) => setBriefPrompt(event.target.value)} />
            </label>
            <label>
              JSON
              <textarea value={jsonPrompt} onChange={(event) => setJsonPrompt(event.target.value)} />
            </label>
          </details>

          <div className="tabs" role="tablist" aria-label="Resultados">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  aria-selected={activeTab === tab.id}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="output-toolbar">
            <button disabled={activeTab === "export"} onClick={() => void copyText("Output", currentOutput)} type="button">
              <Copy size={15} />
              Copiar vista
            </button>
            <button disabled={!whatsappMessage} onClick={() => void copyText("WhatsApp", whatsappMessage)} type="button">
              <Copy size={15} />
              WhatsApp
            </button>
            <button disabled={!emailMessage} onClick={() => void copyText("Email", emailMessage)} type="button">
              <Copy size={15} />
              Email
            </button>
          </div>

          <div className="output-surface">
            {activeTab === "export" ? (
              <ExportPanel artifactMap={artifactMap} />
            ) : (
              <pre>{artifactContent[activeTab] ?? getPlaceholder(job, activeTab)}</pre>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

async function fetchJob(jobId: string) {
  const response = await fetch(`/api/jobs/${jobId}`);
  return response.ok ? ((await response.json()) as JobResponse) : null;
}

async function loadRecentJobs() {
  const response = await fetch("/api/jobs");
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { jobs: JobResponse[] };
  return payload.jobs;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStepClass(currentStatus: JobStatus | undefined, stepStatus: JobStatus) {
  if (!currentStatus) {
    return "pipeline-step";
  }

  const order = Object.keys(statusLabels).filter((status) => status !== "failed");
  const currentIndex = order.indexOf(currentStatus);
  const stepIndex = order.indexOf(stepStatus);

  if (currentStatus === "failed") {
    return "pipeline-step";
  }
  if (stepIndex < currentIndex) {
    return "pipeline-step done";
  }
  if (stepIndex === currentIndex) {
    return "pipeline-step active";
  }
  return "pipeline-step";
}

function getPlaceholder(job: JobResponse | null, type: Exclude<OutputTab, "export">) {
  if (!job) {
    return "Los resultados aparecerán aquí cuando termine el proceso.";
  }
  if (job.status === "failed") {
    return "El proceso falló. Revisa el error, corrige la configuración o intenta con otro archivo.";
  }
  if (job.status !== "complete") {
    return `Procesando: ${statusLabels[job.status]}...`;
  }
  return `Cargando ${type}...`;
}

function extractFollowUp(jsonText: string | undefined, key: "whatsapp" | "email") {
  if (!jsonText) {
    return "";
  }
  try {
    const parsed = JSON.parse(jsonText) as { follow_up?: Record<string, unknown> };
    const value = parsed.follow_up?.[key];
    return typeof value === "string" && value !== "No mencionado" ? value : "";
  } catch {
    return "";
  }
}

function MetricsStrip({ job }: { job: JobResponse | null }) {
  const metrics = job?.metrics || {};
  const items = [
    { label: "Duración", value: formatDuration(Number(metrics.durationSeconds || 0)) },
    { label: "Chunks", value: String(metrics.chunkCount || job?.chunks?.length || 0) },
    {
      label: "Precisión",
      value: metrics.chunkMinutes ? `${metrics.chunkMinutes}m / ${metrics.overlapSeconds || "-"}s` : "-",
    },
    { label: "Proceso", value: metrics.totalProcessingSeconds ? `${metrics.totalProcessingSeconds}s` : "-" },
    { label: "Modelo", value: typeof metrics.analysisModel === "string" ? metrics.analysisModel : "-" },
  ];

  return (
    <div className="metrics-strip">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!seconds) {
    return "-";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function ExportPanel({ artifactMap }: { artifactMap: Map<ArtifactType, { url: string }> }) {
  const exports: Array<{ type: ArtifactType; label: string; icon: typeof FileText }> = [
    { type: "raw_transcript", label: "Transcript bruto", icon: FileText },
    { type: "merged_transcript", label: "Transcript deduplicado", icon: FileText },
    { type: "clean_transcript", label: "Transcript limpio", icon: FileText },
    { type: "brief_markdown", label: "Brief Markdown", icon: FileAudio },
    { type: "structured_json", label: "JSON estructurado", icon: FileJson },
    { type: "export_zip", label: "Paquete ZIP", icon: FileArchive },
  ];

  return (
    <div className="export-list">
      {exports.map((item) => {
        const artifact = artifactMap.get(item.type);
        const Icon = item.icon;
        return (
          <a aria-disabled={!artifact} href={artifact?.url ?? "#"} key={item.type}>
            <Icon size={16} />
            {item.label}
          </a>
        );
      })}
    </div>
  );
}
