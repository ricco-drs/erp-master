"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, CheckCircle, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useBreakpoint } from "@/lib/use-breakpoint";

interface Tema {
  id: string;
  nombre: string;
  descripcion: string | null;
  es_predefinido: boolean;
}

interface GenerarResponse {
  evaluacion_id: string;
  titulo: string;
  preguntas: { id: string; tipo: string; enunciado: string; opciones: string[] | null }[];
}

interface IntentoResponse {
  intento_id: string;
  evaluacion_id: string;
}

interface HistorialItem {
  intento_id: string;
  evaluacion_id: string;
  titulo_evaluacion: string | null;
  puntaje_total: number | null;
  sobre_20: number | null;
  aprobado: boolean | null;
  completado_en: string | null;
}

function formatFecha(isoString: string | null) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

export default function EvaluacionesPage() {
  const router = useRouter();
  const { isMobile, isDesktop } = useBreakpoint();
  const [temas, setTemas] = useState<Tema[]>([]);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiFetch<Tema[]>("/temas"),
      apiFetch<HistorialItem[]>("/evaluaciones/historial"),
    ]).then(([temasResult, historialResult]) => {
      if (temasResult.status === "fulfilled") {
        setTemas(temasResult.value);
      } else {
        setError("No se pudieron cargar los temas. Verificá tu conexión.");
      }
      if (historialResult.status === "fulfilled") {
        setHistorial(historialResult.value);
      }
    }).finally(() => setCargando(false));
  }, []);

  async function handleGenerar(temaId: string) {
    if (generando) return;
    setGenerando(temaId);
    setError(null);
    try {
      const ev = await apiFetch<GenerarResponse>("/evaluaciones/generar", {
        method: "POST",
        body: JSON.stringify({ tema_id: temaId, n_preguntas: 5 }),
      });
      const intento = await apiFetch<IntentoResponse>(`/evaluaciones/${ev.evaluacion_id}/intentos`, {
        method: "POST",
      });
      sessionStorage.setItem(`eval_preguntas_${intento.intento_id}`, JSON.stringify(ev.preguntas));
      router.push(`/evaluaciones/${intento.intento_id}`);
    } catch (err) {
      setError((err as Error).message);
      setGenerando(null);
    }
  }

  return (
    <div
      style={{
        padding: isMobile ? "24px 16px" : "40px 48px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          Módulo de evaluación
        </p>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Nueva evaluación
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "480px" }}>
          Seleccioná un tema para generar 5 preguntas automáticas basadas en los documentos
          disponibles.
        </p>
      </div>

      {error && (
        <p style={{ fontSize: "13px", color: "var(--danger)", marginBottom: "20px" }}>{error}</p>
      )}

      {/* Banner de carga mientras genera */}
      {generando && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 16px",
            marginBottom: "24px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <LoadingSpinner />
          <div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--text-primary)",
                marginBottom: "2px",
              }}
            >
              Generando evaluación…
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              El asistente está creando las preguntas. Puede tardar unos segundos.
            </p>
          </div>
        </div>
      )}

      {/* Layout: dos columnas en desktop */}
      <div
        style={{
          display: isDesktop ? "grid" : "block",
          gridTemplateColumns: isDesktop ? "11fr 9fr" : undefined,
          gap: isDesktop ? "48px" : undefined,
          alignItems: "start",
        }}
      >
        {/* Columna izquierda — selección de tema */}
        <div>
          {cargando ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "12px",
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    height: "110px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    opacity: 0.5,
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "12px",
              }}
            >
              {temas.map((tema) => (
                <TemaCard
                  key={tema.id}
                  tema={tema}
                  loading={generando === tema.id}
                  disabled={generando !== null && generando !== tema.id}
                  onClick={() => handleGenerar(tema.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Columna derecha — historial (solo desktop) */}
        {isDesktop && (
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              Mis evaluaciones
            </p>

            {cargando ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: "56px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      opacity: 0.4,
                    }}
                  />
                ))}
              </div>
            ) : historial.length === 0 ? (
              <div
                style={{
                  padding: "32px 20px",
                  textAlign: "center",
                  border: "1px dashed var(--border)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <ClipboardList
                  size={20}
                  style={{ color: "var(--text-muted)", marginBottom: "10px" }}
                />
                <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Todavía no completaste ninguna evaluación.
                  <br />
                  Seleccioná un tema para comenzar.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {historial.map((item) => (
                  <HistorialItemCard
                    key={item.intento_id}
                    item={item}
                    onClick={() => router.push(`/evaluaciones/${item.intento_id}/resultados`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemaCard
// ---------------------------------------------------------------------------

function TemaCard({
  tema,
  loading,
  disabled,
  onClick,
}: {
  tema: Tema;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "10px",
        padding: "20px",
        borderRadius: "var(--radius-md)",
        border:
          hover && !disabled && !loading
            ? "1px solid var(--accent)"
            : "1px solid var(--border)",
        backgroundColor:
          hover && !disabled && !loading ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        textAlign: "left",
        transition: "border-color 0.15s, background-color 0.15s",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "var(--radius-sm)",
            backgroundColor:
              hover && !disabled ? "var(--accent-muted)" : "rgba(255,255,255,0.05)",
            color: hover && !disabled ? "var(--accent)" : "var(--text-muted)",
            transition: "background-color 0.15s, color 0.15s",
          }}
        >
          <ClipboardList size={16} />
        </span>
        {tema.es_predefinido && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              padding: "2px 7px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--accent-muted)",
              color: "var(--accent)",
            }}
          >
            Oficial
          </span>
        )}
      </div>
      <div>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: "4px",
            lineHeight: 1.35,
          }}
        >
          {loading ? "Generando…" : tema.nombre}
        </p>
        {tema.descripcion && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {tema.descripcion}
          </p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// HistorialItemCard
// ---------------------------------------------------------------------------

function HistorialItemCard({
  item,
  onClick,
}: {
  item: HistorialItem;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const aprobado = item.aprobado;
  const nota = item.sobre_20 !== null ? item.sobre_20.toFixed(1) : null;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${hover ? "var(--border-strong)" : "var(--border)"}`,
        backgroundColor: hover ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "border-color 0.15s, background-color 0.15s",
      }}
    >
      {/* Ícono de resultado */}
      {aprobado === null ? (
        <ClipboardList size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      ) : aprobado ? (
        <CheckCircle size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
      ) : (
        <XCircle size={13} style={{ color: "var(--danger)", flexShrink: 0 }} />
      )}

      {/* Título */}
      <p
        style={{
          flex: 1,
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          margin: 0,
        }}
      >
        {item.titulo_evaluacion ?? "Evaluación"}
      </p>

      {/* Nota + fecha */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {nota !== null && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: aprobado
                ? "var(--accent-muted)"
                : "rgba(239,68,68,0.12)",
              color: aprobado ? "var(--accent)" : "var(--danger)",
            }}
          >
            {nota}/20
          </span>
        )}
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {formatFecha(item.completado_en)}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// LoadingSpinner
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: "16px",
        height: "16px",
        flexShrink: 0,
        border: "2px solid var(--border)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
