"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, MessageSquare, ClipboardList, Loader2,
  BookOpen, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { useBreakpoint } from "@/lib/use-breakpoint";
import { apiFetch } from "@/lib/api";

// ─── Recursos bibliográficos por nombre de sub-tema ───────────────────────────
// Cada entrada puede tener: título, autor, tipo (libro/video/docs/artículo), url opcional.

interface RecursoRef {
  titulo: string;
  autor?: string;
  tipo: "libro" | "documentacion" | "articulo" | "video";
  url?: string;
  descripcion?: string;
}

const RECURSOS_POR_TEMA: Record<string, RecursoRef[]> = {
  "Qué es un ERP y evolución histórica": [
    { titulo: "Enterprise Resource Planning", autor: "Mary Sumner", tipo: "libro", descripcion: "Referencia clásica sobre conceptos y evolución histórica de los ERP." },
    { titulo: "ERP: Making It Happen", autor: "Tom Wallace & Michael Kremzar", tipo: "libro", descripcion: "Guía práctica desde los sistemas MRP hasta la planificación empresarial." },
    { titulo: "What is ERP? | SAP", tipo: "documentacion", url: "https://www.sap.com/products/erp/what-is-erp.html", descripcion: "Explicación oficial de SAP sobre qué es un ERP y sus capacidades." },
    { titulo: "History of ERP Systems", tipo: "articulo", url: "https://www.oracle.com/erp/what-is-erp/", descripcion: "Oracle: evolución desde los 60s hasta los ERP en la nube." },
  ],
  "Módulos típicos de un ERP": [
    { titulo: "SAP S/4HANA Documentation", tipo: "documentacion", url: "https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE", descripcion: "Documentación oficial de módulos SAP: FI, CO, MM, SD, PP, HR." },
    { titulo: "Oracle ERP Cloud Modules", tipo: "documentacion", url: "https://www.oracle.com/erp/", descripcion: "Vista general de módulos en Oracle Fusion ERP Cloud." },
    { titulo: "Enterprise Resource Planning", autor: "Alexis Leon", tipo: "libro", descripcion: "Detalla cada módulo funcional: contabilidad, inventario, RRHH, CRM, etc." },
    { titulo: "Odoo Documentation", tipo: "documentacion", url: "https://www.odoo.com/documentation/", descripcion: "Documentación open-source de Odoo, ERP modular muy usado en LATAM." },
  ],
  "Beneficios y riesgos de adopción": [
    { titulo: "ERP Implementation Failures and Best Practices", tipo: "articulo", url: "https://www.gartner.com/en/information-technology/topics/erp", descripcion: "Gartner: análisis de beneficios, riesgos y métricas de adopción de ERP." },
    { titulo: "Implementing SAP ERP Sales & Distribution", autor: "Glynn C. Williams", tipo: "libro", descripcion: "Análisis de factores de riesgo en implementaciones SAP." },
    { titulo: "Managing IT Risk in ERP Projects", tipo: "articulo", descripcion: "Análisis académico de los principales riesgos en proyectos ERP.", },
    { titulo: "ERP ROI: Benefits Realization", tipo: "articulo", url: "https://www.panorama-consulting.com/resource-center/", descripcion: "Reporte anual de Panorama Consulting sobre retorno de inversión en ERP." },
  ],
  "ERP vs. software de gestión tradicional": [
    { titulo: "The Real Cost of ERP vs. Best-of-Breed Software", tipo: "articulo", url: "https://www.forbes.com/sites/forbestechcouncil/", descripcion: "Comparativa de costos y beneficios entre ERP integrado vs. soluciones aisladas." },
    { titulo: "Integrated vs. Best-of-Breed Solutions", tipo: "articulo", descripcion: "Análisis de trade-offs entre integración ERP y software especializado por módulo." },
    { titulo: "Business Process Integration with SAP NetWeaver", autor: "Torsten Kunz", tipo: "libro", descripcion: "Profundiza en cómo un ERP integra procesos que los sistemas aislados no pueden." },
  ],
  "Fases de un proyecto de implementación": [
    { titulo: "SAP Activate Methodology", tipo: "documentacion", url: "https://www.sap.com/products/erp/rise.html", descripcion: "Metodología oficial de SAP para implementaciones: Discover, Prepare, Explore, Realize, Deploy, Run." },
    { titulo: "Implementing SAP ERP Financials", autor: "Naeem Arif & Sheikh Tauseef", tipo: "libro", descripcion: "Guía paso a paso de las fases de un proyecto SAP FI." },
    { titulo: "PMI PMBOK Guide", tipo: "libro", descripcion: "Estándar de gestión de proyectos aplicable a implementaciones ERP.", url: "https://www.pmi.org/pmbok-guide-standards" },
    { titulo: "Oracle Unified Method (OUM)", tipo: "documentacion", url: "https://www.oracle.com/consulting/methodologies/", descripcion: "Metodología de Oracle para proyectos de implementación." },
  ],
  "Factores críticos de éxito": [
    { titulo: "Critical Success Factors in ERP Implementation", tipo: "articulo", descripcion: "Meta-análisis académico de los 10 factores más citados en literatura de ERP." },
    { titulo: "ERP: The Implementation Cycle", autor: "Stephen Harwood", tipo: "libro", descripcion: "Excelente análisis de qué hace fallar o tener éxito a un proyecto ERP." },
    { titulo: "Panorama ERP Report", tipo: "articulo", url: "https://www.panorama-consulting.com/resource-center/", descripcion: "Reporte anual con estadísticas reales de éxito/fracaso en proyectos ERP globales." },
  ],
  "Migración de datos": [
    { titulo: "SAP Data Migration", tipo: "documentacion", url: "https://help.sap.com/docs/SAP_MASTER_DATA_GOVERNANCE", descripcion: "Guía oficial SAP para migración de datos maestros y herramientas ETL." },
    { titulo: "The Data Migration Handbook", autor: "Brandon Walton", tipo: "libro", descripcion: "Manual práctico de estrategias ETL para proyectos de migración de datos empresariales." },
    { titulo: "Data Quality and ERP Systems", tipo: "articulo", descripcion: "Análisis del impacto de la calidad de datos en el éxito de proyectos ERP." },
  ],
  "Errores comunes en la puesta en marcha": [
    { titulo: "Why ERP Implementations Fail", tipo: "articulo", url: "https://hbr.org/", descripcion: "Harvard Business Review: casos reales de fracasos en implementaciones ERP y sus causas." },
    { titulo: "ERP Project Management Handbook", autor: "Howard Biddle", tipo: "libro", descripcion: "Guía para evitar los errores más costosos durante el go-live." },
    { titulo: "Lessons from Hershey, FoxMeyer, and other ERP failures", tipo: "articulo", descripcion: "Análisis de casos célebres de fracaso en implementaciones ERP y lecciones aprendidas." },
  ],
};

// Ícono según tipo de recurso
function iconoTipo(tipo: RecursoRef["tipo"]) {
  switch (tipo) {
    case "libro":       return "📚";
    case "documentacion": return "📄";
    case "articulo":    return "📰";
    case "video":       return "🎬";
    default:            return "🔗";
  }
}

// Etiqueta de color según tipo
function colorTipo(tipo: RecursoRef["tipo"]): string {
  switch (tipo) {
    case "libro":       return "#818CF8";  // violeta
    case "documentacion": return "var(--accent)"; // verde
    case "articulo":    return "#FB923C";  // naranja
    case "video":       return "#F87171";  // rojo
    default:            return "var(--text-muted)";
  }
}

// ─── Tipos de la API ───────────────────────────────────────────────────────────

interface SubtemaOut {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  preguntas_sugeridas: string[] | null;
}

interface ModuloBasico {
  id: string;
  nombre: string;
  subtemas: SubtemaOut[];
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function SubtemaPage() {
  const router = useRouter();
  const { moduloId, subtemaId } = useParams<{ moduloId: string; subtemaId: string }>();
  const { isMobile } = useBreakpoint();
  const [subtema, setSubtema] = useState<SubtemaOut | null>(null);
  const [moduloNombre, setModuloNombre] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [iniciandoChat, setIniciandoChat] = useState(false);
  const [generandoEval, setGenerandoEval] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [recursosExpanded, setRecursosExpanded] = useState(false);

  useEffect(() => {
    apiFetch<ModuloBasico>(`/modulos/${moduloId}`)
      .then((mod) => {
        setModuloNombre(mod.nombre);
        const st = mod.subtemas.find((s) => s.id === subtemaId) ?? null;
        if (!st) setError("Sub-tema no encontrado.");
        else setSubtema(st);
      })
      .catch(() => setError("No se pudo cargar el sub-tema."))
      .finally(() => setCargando(false));
  }, [moduloId, subtemaId]);

  async function iniciarChat(preguntaInicial?: string) {
    if (!subtema) return;
    setIniciandoChat(true);
    setErrorAccion("");
    try {
      const sesion = await apiFetch<{ sesion_id: string }>("/chat/sesiones", {
        method: "POST",
        body: JSON.stringify({ tema_id: subtemaId, nombre: subtema.nombre }),
      });
      const dest = `/chat/${sesion.sesion_id}`;
      const ctx = encodeURIComponent(subtema.nombre);

      if (preguntaInicial) {
        // Pregunta desde chip — la enviamos como ?q=
        router.push(`${dest}?modo=subtema&ctx=${ctx}&q=${encodeURIComponent(preguntaInicial)}`);
      } else {
        // Chat libre — el bot dará bienvenida automática
        router.push(`${dest}?modo=subtema&ctx=${ctx}`);
      }
    } catch (e: unknown) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo iniciar el chat.");
      setIniciandoChat(false);
    }
  }

  async function hacerEvaluacion() {
    setGenerandoEval(true);
    setErrorAccion("");
    try {
      const ev = await apiFetch<{ evaluacion_id: string; preguntas: { id: string; tipo: string; enunciado: string; opciones: string[] | null }[] }>("/evaluaciones/generar", {
        method: "POST",
        body: JSON.stringify({ tema_id: subtemaId, n_preguntas: 5 }),
      });
      const intento = await apiFetch<{ intento_id: string }>(`/evaluaciones/${ev.evaluacion_id}/intentos`, {
        method: "POST",
      });
      // Guardar preguntas en sessionStorage para que la página de evaluación las muestre sin fetch adicional
      sessionStorage.setItem(`eval_preguntas_${intento.intento_id}`, JSON.stringify(ev.preguntas));
      router.push(`/evaluaciones/${intento.intento_id}`);
    } catch (e: unknown) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo generar la evaluación.");
      setGenerandoEval(false);
    }
  }

  if (cargando) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={20} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !subtema) {
    return (
      <div style={{ padding: isMobile ? "32px 16px" : "48px 48px", maxWidth: "760px", margin: "0 auto" }}>
        <p style={{ color: "var(--danger)", fontSize: "14px" }}>{error || "Sub-tema no encontrado."}</p>
      </div>
    );
  }

  const recursos = RECURSOS_POR_TEMA[subtema.nombre] ?? [];

  return (
    <div style={{ padding: isMobile ? "32px 16px" : "48px 48px", maxWidth: "760px", margin: "0 auto" }}>
      {/* Volver al módulo */}
      <button
        onClick={() => router.push(`/modulos/${moduloId}`)}
        style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginBottom: "24px", padding: 0 }}
      >
        <ArrowLeft size={14} />
        {moduloNombre || "Módulo"}
      </button>

      {/* Header */}
      <div style={{ marginBottom: "36px" }}>
        <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
          Sub-tema
        </p>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
          {subtema.nombre}
        </h1>
        {subtema.descripcion && (
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {subtema.descripcion}
          </p>
        )}
      </div>

      {/* Preguntas sugeridas */}
      {subtema.preguntas_sugeridas && subtema.preguntas_sugeridas.length > 0 && (
        <div style={{ marginBottom: "36px" }}>
          <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "10px" }}>
            Preguntas frecuentes — hacé clic para abrir el chat con esa pregunta
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {subtema.preguntas_sugeridas.map((pregunta, i) => (
              <ChipPregunta
                key={i}
                texto={pregunta}
                onClick={() => iniciarChat(pregunta)}
                disabled={iniciandoChat}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {errorAccion && (
        <p style={{ fontSize: "13px", color: "var(--danger)", marginBottom: "16px" }}>{errorAccion}</p>
      )}

      {/* Acciones principales */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "12px", marginBottom: "40px" }}>
        <AccionBtn
          icon={<MessageSquare size={15} />}
          label={iniciandoChat ? "Abriendo chat…" : "Iniciar chat"}
          descripcion="El asistente te dará una introducción y recomendaciones"
          loading={iniciandoChat}
          primary
          onClick={() => iniciarChat()}
        />
        <AccionBtn
          icon={<ClipboardList size={15} />}
          label={generandoEval ? "Generando…" : "Hacer evaluación"}
          descripcion="5 preguntas sobre este sub-tema"
          loading={generandoEval}
          onClick={hacerEvaluacion}
        />
      </div>

      {/* ── Bibliografía y recursos ─────────────────────────────────────── */}
      <div>
        <button
          onClick={() => setRecursosExpanded((v) => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: recursosExpanded ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-surface)",
            cursor: "pointer",
            transition: "border-radius 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={14} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
              Bibliografía y recursos recomendados
            </span>
            {recursos.length > 0 && (
              <span style={{
                fontSize: "10px", fontWeight: 600, letterSpacing: "0.05em",
                color: "var(--accent)", backgroundColor: "var(--accent-muted)",
                padding: "2px 7px", borderRadius: "20px",
              }}>
                {recursos.length}
              </span>
            )}
          </div>
          {recursosExpanded
            ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} />
            : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
          }
        </button>

        {recursosExpanded && (
          <div style={{
            border: "1px solid var(--border)",
            borderTop: "none",
            borderRadius: "0 0 var(--radius-md) var(--radius-md)",
            backgroundColor: "var(--bg-surface)",
            overflow: "hidden",
          }}>
            {recursos.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", padding: "20px 16px" }}>
                Los recursos para este sub-tema estarán disponibles próximamente.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {recursos.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "12px",
                      padding: "14px 16px",
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0, marginTop: "2px" }}>
                      {iconoTipo(r.tipo)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "13px", fontWeight: 500, color: "var(--text-primary)",
                              textDecoration: "none",
                              display: "flex", alignItems: "center", gap: "4px",
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)")}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)")}
                          >
                            {r.titulo}
                            <ExternalLink size={11} style={{ opacity: 0.6 }} />
                          </a>
                        ) : (
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                            {r.titulo}
                          </span>
                        )}
                        <span style={{
                          fontSize: "10px", fontWeight: 500, letterSpacing: "0.05em",
                          color: colorTipo(r.tipo),
                          padding: "1px 6px",
                          borderRadius: "4px",
                          border: `1px solid ${colorTipo(r.tipo)}33`,
                          backgroundColor: `${colorTipo(r.tipo)}11`,
                          textTransform: "uppercase",
                        }}>
                          {r.tipo}
                        </span>
                      </div>
                      {r.autor && (
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 3px" }}>
                          {r.autor}
                        </p>
                      )}
                      {r.descripcion && (
                        <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                          {r.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ChipPregunta({
  texto,
  onClick,
  disabled,
}: {
  texto: string;
  onClick: () => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "6px 12px",
        borderRadius: "99px",
        border: `1px solid ${hover ? "var(--accent)" : "var(--border)"}`,
        backgroundColor: hover ? "var(--accent-muted)" : "var(--bg-surface)",
        color: hover ? "var(--accent)" : "var(--text-secondary)",
        fontSize: "13px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "border-color 0.12s, background-color 0.12s, color 0.12s",
      }}
    >
      {texto}
    </button>
  );
}

function AccionBtn({
  icon,
  label,
  descripcion,
  loading,
  primary,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  descripcion: string;
  loading: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        display: "flex", alignItems: "center", gap: "12px",
        padding: "16px 20px",
        borderRadius: "var(--radius-md)",
        border: primary
          ? `1px solid ${hover ? "var(--accent-hover)" : "var(--accent)"}`
          : `1px solid ${hover ? "var(--border-strong)" : "var(--border)"}`,
        backgroundColor: primary
          ? "var(--accent-muted)"
          : hover ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        cursor: loading ? "default" : "pointer",
        textAlign: "left",
        opacity: loading ? 0.7 : 1,
        transition: "border-color 0.12s, background-color 0.12s",
      }}
    >
      <span style={{ color: primary ? "var(--accent)" : "var(--text-secondary)", display: "flex", flexShrink: 0 }}>
        {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : icon}
      </span>
      <div>
        <p style={{ fontSize: "14px", fontWeight: 500, color: primary ? "var(--accent)" : "var(--text-primary)", marginBottom: "2px" }}>
          {label}
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{descripcion}</p>
      </div>
    </button>
  );
}
