"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CheckCircle2, BookOpen,
  ClipboardList, Loader2, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { useBreakpoint } from "@/lib/use-breakpoint";
import { apiFetch } from "@/lib/api";

interface SubtemaOut {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  preguntas_sugeridas: string[] | null;
}

interface ModuloDetalle {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  resumen_ia: string | null;
  completado: boolean;
  subtemas: SubtemaOut[];
}

interface SubtemaProgreso {
  tema_id: string;
  tiene_evaluaciones: boolean;
  mejor_sobre_20: number | null;
  aprobado: boolean;
}

export default function ModuloDetallePage() {
  const router = useRouter();
  const { moduloId } = useParams<{ moduloId: string }>();
  const { isMobile } = useBreakpoint();

  const [modulo, setModulo] = useState<ModuloDetalle | null>(null);
  const [progreso, setProgreso] = useState<Record<string, SubtemaProgreso>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [resumenExpanded, setResumenExpanded] = useState(false);
  const [generandoExamen, setGenerandoExamen] = useState(false);
  const [errorExamen, setErrorExamen] = useState("");

  useEffect(() => {
    apiFetch<ModuloDetalle>(`/modulos/${moduloId}`)
      .then(setModulo)
      .catch(() => setError("No se pudo cargar el módulo."))
      .finally(() => setCargando(false));

    apiFetch<SubtemaProgreso[]>(`/modulos/${moduloId}/progreso-subtemas`)
      .then((data) => {
        const map: Record<string, SubtemaProgreso> = {};
        data.forEach((p) => { map[p.tema_id] = p; });
        setProgreso(map);
      })
      .catch(() => {});
  }, [moduloId]);

  async function iniciarExamenFinal() {
    setGenerandoExamen(true);
    setErrorExamen("");
    try {
      const ev = await apiFetch<{
        evaluacion_id: string;
        preguntas: { id: string; tipo: string; enunciado: string; opciones: string[] | null }[];
      }>(`/evaluaciones/modulo/${moduloId}/generar`, {
        method: "POST",
        body: JSON.stringify({ n_preguntas: 12 }),
      });
      const intento = await apiFetch<{ intento_id: string }>(
        `/evaluaciones/${ev.evaluacion_id}/intentos`,
        { method: "POST" },
      );
      sessionStorage.setItem(`eval_preguntas_${intento.intento_id}`, JSON.stringify(ev.preguntas));
      router.push(`/evaluaciones/${intento.intento_id}`);
    } catch (e: unknown) {
      setErrorExamen(e instanceof Error ? e.message : "No se pudo iniciar el examen.");
    } finally {
      setGenerandoExamen(false);
    }
  }

  if (cargando) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={20} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error || !modulo) {
    return (
      <div style={{ padding: isMobile ? "32px 16px" : "48px 48px", maxWidth: "860px", margin: "0 auto" }}>
        <p style={{ color: "var(--danger)", fontSize: "14px" }}>{error || "Módulo no encontrado."}</p>
      </div>
    );
  }

  const subtemasPrincipales = modulo.subtemas.filter((s) => s.orden > 0);
  const subtemaLegado = modulo.subtemas.find((s) => s.orden === 0);

  // Calcular si el usuario puede intentar el examen (todos los subtemas con
  // evaluaciones tienen al menos un intento aprobado ≥ 11/20)
  const subtemasBloqueantes = subtemasPrincipales.filter((s) => {
    const p = progreso[s.id];
    return p && p.tiene_evaluaciones && !p.aprobado;
  });
  const subtemasSinIntentar = subtemasPrincipales.filter((s) => {
    const p = progreso[s.id];
    return p && p.tiene_evaluaciones && p.mejor_sobre_20 === null;
  });
  const puedeExamen = subtemasBloqueantes.length === 0 && subtemasSinIntentar.length === 0;

  return (
    <div style={{ padding: isMobile ? "32px 16px" : "48px 48px", maxWidth: "860px", margin: "0 auto" }}>
      {/* Volver */}
      <button
        onClick={() => router.push("/modulos")}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          fontSize: "13px", color: "var(--text-muted)",
          background: "none", border: "none", cursor: "pointer",
          marginBottom: "24px", padding: 0,
        }}
      >
        <ArrowLeft size={14} />
        Todos los módulos
      </button>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          {modulo.completado && (
            <CheckCircle2 size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
          )}
          <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {modulo.nombre}
          </h1>
        </div>
        {modulo.descripcion && (
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {modulo.descripcion}
          </p>
        )}
      </div>

      {/* Resumen IA */}
      {modulo.resumen_ia && (
        <div style={{ border: "1px solid var(--accent)", borderRadius: "var(--radius-md)", marginBottom: "36px", overflow: "hidden" }}>
          <button
            onClick={() => setResumenExpanded((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", background: "var(--accent-muted)", border: "none", cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--accent)" }}>Resumen del módulo</span>
            {resumenExpanded
              ? <ChevronUp size={15} style={{ color: "var(--accent)" }} />
              : <ChevronDown size={15} style={{ color: "var(--accent)" }} />}
          </button>
          {resumenExpanded && (
            <div style={{ padding: "16px 18px", borderTop: "1px solid rgba(74,222,128,0.15)" }}>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {modulo.resumen_ia}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sub-temas */}
      <p style={{
        fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em",
        color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "12px",
      }}>
        Sub-temas
      </p>

      {subtemasPrincipales.length === 0 && !subtemaLegado ? (
        <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "32px" }}>
          Este módulo todavía no tiene sub-temas configurados.
        </p>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", gap: "1px",
          border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
          overflow: "hidden", backgroundColor: "var(--border)", marginBottom: "32px",
        }}>
          {subtemasPrincipales.map((subtema, idx) => (
            <SubtemaRow
              key={subtema.id}
              subtema={subtema}
              numero={idx + 1}
              progreso={progreso[subtema.id] ?? null}
              onClick={() => router.push(`/modulos/${moduloId}/subtemas/${subtema.id}`)}
            />
          ))}
          {subtemaLegado && subtemasPrincipales.length === 0 && (
            <SubtemaRow
              subtema={subtemaLegado}
              numero={1}
              progreso={null}
              onClick={() => router.push(`/modulos/${moduloId}/subtemas/${subtemaLegado.id}`)}
            />
          )}
        </div>
      )}

      {/* Evaluación final */}
      <p style={{
        fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em",
        color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "12px",
      }}>
        Evaluación final
      </p>
      <div style={{
        border: `1px solid ${puedeExamen ? "var(--border)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)", padding: "20px 24px",
        backgroundColor: "var(--bg-surface)",
      }}>
        <div style={{
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: "16px",
          flexDirection: isMobile ? "column" : "row",
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>
              Examen Final — {modulo.nombre}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "8px" }}>
              12 preguntas que cubren todos los sub-temas. Necesitás aprobar (≥ 11/20) al menos una
              evaluación por cada sub-tema antes de acceder.
            </p>

            {/* Advertencias de bloqueo */}
            {subtemasSinIntentar.length > 0 && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "8px",
                padding: "8px 12px", borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.2)", marginBottom: "6px",
              }}>
                <AlertCircle size={13} style={{ color: "#F59E0B", flexShrink: 0, marginTop: "1px" }} />
                <p style={{ fontSize: "12px", color: "#F59E0B", lineHeight: 1.5 }}>
                  Sin evaluar:{" "}
                  {subtemasSinIntentar.map((s) => `"${s.nombre}"`).join(", ")}
                </p>
              </div>
            )}
            {subtemasBloqueantes.filter((s) => progreso[s.id]?.mejor_sobre_20 !== null).length > 0 && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "8px",
                padding: "8px 12px", borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)", marginBottom: "6px",
              }}>
                <AlertCircle size={13} style={{ color: "var(--danger)", flexShrink: 0, marginTop: "1px" }} />
                <p style={{ fontSize: "12px", color: "var(--danger)", lineHeight: 1.5 }}>
                  Nota insuficiente:{" "}
                  {subtemasBloqueantes
                    .filter((s) => progreso[s.id]?.mejor_sobre_20 !== null)
                    .map((s) => `"${s.nombre}" (${progreso[s.id]?.mejor_sobre_20}/20)`)
                    .join(", ")}
                </p>
              </div>
            )}

            {errorExamen && (
              <p style={{ fontSize: "13px", color: "var(--danger)", marginTop: "4px" }}>{errorExamen}</p>
            )}
          </div>

          <button
            onClick={iniciarExamenFinal}
            disabled={generandoExamen}
            style={{
              display: "flex", alignItems: "center", gap: "8px", flexShrink: 0,
              padding: "9px 18px", borderRadius: "var(--radius-sm)",
              border: "none", cursor: generandoExamen ? "default" : "pointer",
              backgroundColor: modulo.completado ? "var(--accent-muted)" : "var(--accent)",
              color: modulo.completado ? "var(--accent)" : "#000",
              fontSize: "13px", fontWeight: 500,
              opacity: generandoExamen ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {generandoExamen ? (
              <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generando...</>
            ) : (
              <><ClipboardList size={13} /> {modulo.completado ? "Volver a intentar" : "Iniciar examen"}</>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── SubtemaRow ────────────────────────────────────────────────────────────────

function SubtemaRow({
  subtema,
  numero,
  progreso,
  onClick,
}: {
  subtema: SubtemaOut;
  numero: number;
  progreso: SubtemaProgreso | null;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  const scoreTag = (() => {
    if (!progreso || !progreso.tiene_evaluaciones) return null;
    if (progreso.mejor_sobre_20 === null) {
      return (
        <span style={{
          fontSize: "11px", color: "var(--text-muted)",
          backgroundColor: "rgba(255,255,255,0.05)",
          padding: "2px 7px", borderRadius: "10px",
          whiteSpace: "nowrap",
        }}>
          Sin evaluar
        </span>
      );
    }
    if (progreso.aprobado) {
      return (
        <span style={{
          fontSize: "11px", fontWeight: 600, color: "var(--accent)",
          backgroundColor: "var(--accent-muted)",
          padding: "2px 8px", borderRadius: "10px",
          whiteSpace: "nowrap",
        }}>
          ✓ {progreso.mejor_sobre_20}/20
        </span>
      );
    }
    return (
      <span style={{
        fontSize: "11px", fontWeight: 500, color: "#F59E0B",
        backgroundColor: "rgba(245,158,11,0.1)",
        padding: "2px 8px", borderRadius: "10px",
        whiteSpace: "nowrap",
      }}>
        {progreso.mejor_sobre_20}/20
      </span>
    );
  })();

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: "14px",
        padding: "14px 20px",
        backgroundColor: hover ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        border: "none", cursor: "pointer", textAlign: "left", width: "100%",
        transition: "background-color 0.12s",
      }}
    >
      {/* Número / estado */}
      {progreso?.aprobado ? (
        <CheckCircle2 size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
      ) : (
        <span style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "22px", height: "22px", flexShrink: 0,
          fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
          border: "1px solid var(--border-strong)", borderRadius: "4px",
        }}>
          {numero}
        </span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-primary)", marginBottom: "2px" }}>
          {subtema.nombre}
        </p>
        {subtema.descripcion && (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtema.descripcion}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {scoreTag}
        {!scoreTag && subtema.preguntas_sugeridas && subtema.preguntas_sugeridas.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
            <BookOpen size={11} />
            {subtema.preguntas_sugeridas.length} preguntas
          </span>
        )}
        <ArrowRight size={13} style={{ color: hover ? "var(--accent)" : "var(--text-muted)", transition: "color 0.12s" }} />
      </div>
    </button>
  );
}
