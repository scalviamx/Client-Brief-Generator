"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Clock3, Download, FileAudio, FileJson, FileText, Loader2, Play, RotateCcw, Upload } from "lucide-react";

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

type ArtifactType = "raw_transcript" | "clean_transcript" | "brief_markdown" | "structured_json";

type JobResponse = {
  id: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  metadata: Record<string, string>;
  originalFileName: string;
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
  const [job, setJob] = useState<JobResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("clean_transcript");
  const [artifactContent, setArtifactContent] = useState<Partial<Record<ArtifactType, string>>>({});
  const [recentJobs, setRecentJobs] = useState<JobResponse[]>([]);

  const isRunning = Boolean(job && !["complete", "failed"].includes(job.status));
  const artifactMap = useMemo(() => new Map(job?.artifacts.map((artifact) => [artifact.type, artifact]) ?? []), [job]);

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
          void loadRecentJobs().then(setRecentJobs);
        }
      }
    }, 1800);

    return () => window.clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (job?.status !== "complete") {
      return;
    }

    void Promise.all(
      (["clean_transcript", "brief_markdown", "structured_json"] as ArtifactType[]).map(async (type) => {
        const artifact = job.artifacts.find((item) => item.type === type);
        if (!artifact || artifactContent[type]) {
          return;
        }
        const response = await fetch(artifact.url);
        if (response.ok) {
          const content = await response.text();
          setArtifactContent((current) => ({ ...current, [type]: content }));
        }
      }),
    );
  }, [artifactContent, job]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

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
  }

  async function selectRecentJob(jobId: string) {
    setError("");
    setArtifactContent({});
    setActiveTab("clean_transcript");
    const nextJob = await fetchJob(jobId);
    if (nextJob) {
      setJob(nextJob);
    }
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
            <div className="history-list">
              {recentJobs.length ? (
                recentJobs.map((item) => (
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
                <p className="empty-history">Los jobs procesados aparecerán aquí.</p>
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

function getPlaceholder(job: JobResponse | null, type: ArtifactType) {
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

function ExportPanel({ artifactMap }: { artifactMap: Map<ArtifactType, { url: string }> }) {
  const exports: Array<{ type: ArtifactType; label: string }> = [
    { type: "raw_transcript", label: "Transcript bruto" },
    { type: "clean_transcript", label: "Transcript limpio" },
    { type: "brief_markdown", label: "Brief Markdown" },
    { type: "structured_json", label: "JSON estructurado" },
  ];

  return (
    <div className="export-list">
      {exports.map((item) => {
        const artifact = artifactMap.get(item.type);
        return (
          <a aria-disabled={!artifact} href={artifact?.url ?? "#"} key={item.type}>
            <Download size={16} />
            {item.label}
          </a>
        );
      })}
    </div>
  );
}
