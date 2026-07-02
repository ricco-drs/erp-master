"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useBreakpoint } from "@/lib/use-breakpoint";

interface Pregunta {
  id: string;
  tipo: "opcion_multiple" | "verdadero_falso" | "abierta";
  enunciado: string;
  opciones: string[] | null;
}

interface IntentoResultado {
  intento_id: string;
  evaluacion_id: string;
  puntaje_total: number | null;
  sobre_20: number | null;
  aprobado: boolean | null;
  completado_en: string | null;
  respuestas: {
    pregunta_id: string;
    tipo: string;
    enunciado: string;
    respuesta_dada: string | null;
    puntaje_obtenido: number;
    feedback_llm: string | null;
  }[];
}

// ---------------------------------------------------------------------------
// Componentes de pregunta
// ---------------------------------------------------------------------------

function PreguntaOpcionMultiple({
  pregunta, valor, onChange, numero,
}: {
  pregunta: Pregunta; valor: string; onChange: (v: string) => void; numero: number;
}) {
  return (
    <PreguntaWrapper numero={numero} enunciado={pregunta.enunciado} tipo="Opción múltiple">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
        {(pregunta.opciones ?? []).map((op) => {
          const letra = op.slice(0, 1); // "a", "b", "c", "d"
          const selected = valor === letra;
          return (
            <button
              key={op}
              onClick={() => onChange(letra)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 14px", borderRadius: "var(--radius-sm)",
                border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                backgroundColor: selected ? "var(--accent-muted)" : "var(--bg-base)",
                cursor: "pointer", textAlign: "left",
                transition: "border-color 0.1s, background-color 0.1s",
              }}
            >
              <span style={{
                width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 600,
                backgroundColor: selected ? "var(--accent)" : "rgba(255,255,255,0.06)",
                color: selected ? "var(--bg-base)" : "var(--text-muted)",
                transition: "background-color 0.1s, color 0.1s",
              }}>
                {letra.toUpperCase()}
              </span>
              <span style={{ fontSize: "14px", color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {op.slice(3)} {/* quita "a) " */}
              </span>
            </button>
          );
        })}
      </div>
    </PreguntaWrapper>
  );
}

function PreguntaVerdaderoFalso({
  pregunta, valor, onChange, numero,
}: {
  pregunta: Pregunta; valor: string; onChange: (v: string) => void; numero: number;
}) {
  return (
    <PreguntaWrapper numero={numero} enunciado={pregunta.enunciado} tipo="Verdadero / Falso">
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        {["Verdadero", "Falso"].map((op) => {
          const selected = valor === op;
          return (
            <button
              key={op}
              onClick={() => onChange(op)}
              style={{
                flex: 1, padding: "10px 0",
                borderRadius: "var(--radius-sm)",
                border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                backgroundColor: selected ? "var(--accent-muted)" : "var(--bg-base)",
                color: selected ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "14px", fontWeight: selected ? 500 : 400,
                cursor: "pointer",
                transition: "border-color 0.1s, background-color 0.1s, color 0.1s",
              }}
            >
              {op}
            </button>
          );
        })}
      </div>
    </PreguntaWrapper>
  );
}

function PreguntaAbierta({
  pregunta, valor, onChange, numero,
}: {
  pregunta: Pregunta; valor: string; onChange: (v: string) => void; numero: number;
}) {
  return (
    <PreguntaWrapper numero={numero} enunciado={pregunta.enunciado} tipo="Pregunta abierta">
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escribí tu respuesta aquí…"
        rows={4}
        style={{
          marginTop: "12px", width: "100%",
          backgroundColor: "var(--bg-base)",
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          padding: "10px 12px", fontSize: "14px", color: "var(--text-primary)",
          outline: "none", resize: "vertical", lineHeight: 1.6,
          fontFamily: "inherit",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--border-strong)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
      />
    </PreguntaWrapper>
  );
}

function PreguntaWrapper({ numero, enunciado, tipo, children }: {
  numero: number; enunciado: string; tipo: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
      backgroundColor: "var(--bg-surface)", padding: "20px 24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{
          fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {numero}.
        </span>
        <span style={{
          fontSize: "11px", fontWeight: 500, padding: "2px 7px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)",
        }}>
          {tipo}
        </span>
      </div>
      <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.55 }}>
        {enunciado}
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function EvaluacionPage({
  params,
}: {
  params: Promise<{ intentoId: string }>;
}) {
  const { intentoId } = use(params);
  const router = useRouter();
  const { isMobile } = useBreakpoint();

  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluacionId, setEvaluacionId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Intentar cargar preguntas desde sessionStorage (la página que generó la eval las guardó ahí)
    let loadedFromStorage = false;
    const raw = sessionStorage.getItem(`eval_preguntas_${intentoId}`);
    if (raw) {
      try {
        setPreguntas(JSON.parse(raw));
        sessionStorage.removeItem(`eval_preguntas_${intentoId}`);
        loadedFromStorage = true;
      } catch { /* ignore */ }
    }

    // 2. Verificar estado del intento; si no hay preguntas del storage, buscarlas del backend
    apiFetch<IntentoResultado>(`/evaluaciones/intentos/${intentoId}`)
      .then(async (intento) => {
        setEvaluacionId(intento.evaluacion_id);
        if (intento.completado_en) {
          router.replace(`/evaluaciones/${intentoId}/resultados`);
          return;
        }
        // Fallback: sessionStorage vacío (ej: página recargada) → fetch desde el backend
        if (!loadedFromStorage) {
          try {
            const pregs = await apiFetch<Pregunta[]>(`/evaluaciones/${intento.evaluacion_id}/preguntas`);
            setPreguntas(pregs);
          } catch {
            setError("No se pudieron cargar las preguntas de la evaluación.");
          }
        }
      })
      .catch(() => setError("No se pudo cargar la evaluación."))
      .finally(() => setCargando(false));
  }, [intentoId, router]);

  function setRespuesta(preguntaId: string, valor: string) {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  }

  const totalPreguntas = preguntas.length;
  const respondidas = preguntas.filter((p) => (respuestas[p.id] ?? "").trim() !== "").length;

  async function handleEnviar() {
    const confirmar = window.confirm(
      `¿Enviás la evaluación? Respondiste ${respondidas} de ${totalPreguntas} preguntas. Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setEnviando(true);
    setError(null);
    try {
      await apiFetch(`/evaluaciones/intentos/${intentoId}/respuestas`, {
        method: "POST",
        body: JSON.stringify({
          respuestas: preguntas.map((p) => ({
            pregunta_id: p.id,
            respuesta_dada: respuestas[p.id] ?? null,
          })),
        }),
      });
      router.push(`/evaluaciones/${intentoId}/resultados`);
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  // ---------------------------------------------------------------------------

  if (error && !enviando) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100vh", gap: "12px",
      }}>
        <AlertCircle size={24} style={{ color: "var(--danger)" }} />
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{error}</p>
        <button onClick={() => router.push("/evaluaciones")}
          style={{ fontSize: "13px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
          Volver a evaluaciones
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: "12px",
        padding: isMobile ? "10px 16px" : "12px 32px", borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={() => router.push("/evaluaciones")}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px",
            color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")}
        >
          <ArrowLeft size={14} /> Evaluaciones
        </button>
        <span style={{ color: "var(--border)" }}>/</span>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
          Evaluación en curso
        </p>
        {totalPreguntas > 0 && (
          <span style={{
            marginLeft: "auto", fontSize: "12px", color: "var(--text-muted)",
          }}>
            {respondidas}/{totalPreguntas} respondidas
          </span>
        )}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: isMobile ? "24px 16px" : "32px 48px", overflowY: "auto" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>

          {cargando ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  height: "120px", borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", opacity: 0.5,
                }} />
              ))}
            </div>
          ) : preguntas.length === 0 ? (
            <p style={{ fontSize: "14px", color: "var(--text-muted)", textAlign: "center", marginTop: "60px" }}>
              Cargando preguntas…
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {preguntas.map((p, i) => {
                const valor = respuestas[p.id] ?? "";
                if (p.tipo === "opcion_multiple")
                  return <PreguntaOpcionMultiple key={p.id} pregunta={p} valor={valor} onChange={(v) => setRespuesta(p.id, v)} numero={i + 1} />;
                if (p.tipo === "verdadero_falso")
                  return <PreguntaVerdaderoFalso key={p.id} pregunta={p} valor={valor} onChange={(v) => setRespuesta(p.id, v)} numero={i + 1} />;
                return <PreguntaAbierta key={p.id} pregunta={p} valor={valor} onChange={(v) => setRespuesta(p.id, v)} numero={i + 1} />;
              })}
            </div>
          )}

          {/* Error de envío */}
          {error && enviando && (
            <div style={{
              marginTop: "16px", display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 14px", borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            }}>
              <AlertCircle size={13} style={{ color: "var(--danger)", flexShrink: 0 }} />
              <p style={{ fontSize: "13px", color: "var(--danger)", margin: 0 }}>{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer con botón enviar */}
      {preguntas.length > 0 && (
        <div style={{
          flexShrink: 0, borderTop: "1px solid var(--border)",
          padding: isMobile ? "12px 16px" : "16px 48px", backgroundColor: "var(--bg-base)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {respondidas < totalPreguntas
              ? `${totalPreguntas - respondidas} pregunta${totalPreguntas - respondidas !== 1 ? "s" : ""} sin responder`
              : "Todas las preguntas respondidas"}
          </p>
          <button
            onClick={handleEnviar}
            disabled={enviando}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "9px 20px", borderRadius: "var(--radius-sm)", border: "none",
              fontSize: "14px", fontWeight: 500,
              backgroundColor: enviando ? "var(--accent-muted)" : "var(--accent)",
              color: enviando ? "var(--accent)" : "var(--bg-base)",
              cursor: enviando ? "not-allowed" : "pointer",
              transition: "background-color 0.15s",
            }}
          >
            {enviando ? (
              <>
                <span style={{
                  display: "inline-block", width: "13px", height: "13px",
                  border: "2px solid var(--accent)", borderTopColor: "transparent",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                Calificando…
              </>
            ) : (
              <><Send size={14} /> Enviar evaluación</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

