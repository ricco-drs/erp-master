"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, BarChart3, RotateCcw } from "lucide-react";
import { useBreakpoint } from "@/lib/use-breakpoint";
import {
  getEncuesta,
  preguntasDeEncuesta,
  totalPreguntas,
  calcularResultado,
  nivelPercepcion,
  OPCIONES_LIKERT,
  type Encuesta,
} from "@/lib/encuestas-data";

export default function EncuestaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { isMobile } = useBreakpoint();

  const encuesta = getEncuesta(slug);
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [enviado, setEnviado] = useState(false);

  // Slug inexistente → mensaje de error
  if (!encuesta) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "12px",
        }}
      >
        <AlertCircle size={24} style={{ color: "var(--danger)" }} />
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          No se encontró la evaluación solicitada.
        </p>
        <button
          onClick={() => router.push("/evaluaciones")}
          style={{
            fontSize: "13px",
            color: "var(--accent)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Volver a evaluaciones
        </button>
      </div>
    );
  }

  const preguntas = preguntasDeEncuesta(encuesta);
  const total = totalPreguntas(encuesta);
  const respondidas = preguntas.filter((p) => respuestas[p.n] !== undefined).length;
  const completo = respondidas === total;

  function setRespuesta(n: number, valor: number) {
    setRespuestas((prev) => ({ ...prev, [n]: valor }));
  }

  function handleEnviar() {
    if (!completo) return;
    setEnviado(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRehacer() {
    setRespuestas({});
    setEnviado(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: isMobile ? "10px 16px" : "12px 32px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.push("/evaluaciones")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")}
        >
          <ArrowLeft size={14} /> Evaluaciones
        </button>
        <span style={{ color: "var(--border)" }}>/</span>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
          {encuesta.titulo}
        </p>
        {!enviado && (
          <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--text-muted)" }}>
            {respondidas}/{total} respondidas
          </span>
        )}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: isMobile ? "24px 16px" : "32px 48px", overflowY: "auto" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          {enviado ? (
            <Resultados encuesta={encuesta} respuestas={respuestas} onRehacer={handleRehacer} onVolver={() => router.push("/evaluaciones")} />
          ) : (
            <Cuestionario encuesta={encuesta} respuestas={respuestas} onSelect={setRespuesta} />
          )}
        </div>
      </div>

      {/* Footer con botón de envío (solo mientras se responde) */}
      {!enviado && (
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid var(--border)",
            padding: isMobile ? "12px 16px" : "16px 48px",
            backgroundColor: "var(--bg-base)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {completo
              ? "Todas las preguntas respondidas"
              : `${total - respondidas} pregunta${total - respondidas !== 1 ? "s" : ""} sin responder`}
          </p>
          <button
            onClick={handleEnviar}
            disabled={!completo}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 20px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: "14px",
              fontWeight: 500,
              backgroundColor: completo ? "var(--accent)" : "var(--accent-muted)",
              color: completo ? "var(--bg-base)" : "var(--text-muted)",
              cursor: completo ? "pointer" : "not-allowed",
              transition: "background-color 0.15s",
            }}
          >
            <BarChart3 size={14} /> Ver resultados
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cuestionario (preguntas agrupadas por dimensión)
// ---------------------------------------------------------------------------

function Cuestionario({
  encuesta,
  respuestas,
  onSelect,
}: {
  encuesta: Encuesta;
  respuestas: Record<number, number>;
  onSelect: (n: number, valor: number) => void;
}) {
  // Numeración local: cada evaluación muestra 1, 2, 3… sin importar el n° global.
  const numeroLocal = new Map<number, number>();
  preguntasDeEncuesta(encuesta).forEach((p, i) => numeroLocal.set(p.n, i + 1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {encuesta.dimensiones.map((dim) => (
        <div key={dim.nombre}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--accent)",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            {dim.nombre}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {dim.preguntas.map((p) => (
              <PreguntaLikertCard
                key={p.n}
                numero={numeroLocal.get(p.n) ?? p.n}
                enunciado={p.texto}
                valor={respuestas[p.n]}
                onSelect={(valor) => onSelect(p.n, valor)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PreguntaLikertCard({
  numero,
  enunciado,
  valor,
  onSelect,
}: {
  numero: number;
  enunciado: string;
  valor: number | undefined;
  onSelect: (valor: number) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--bg-surface)",
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>
          {numero}.
        </span>
        <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.5 }}>
          {enunciado}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {OPCIONES_LIKERT.map((op) => {
          const selected = valor === op.valor;
          return (
            <button
              key={op.valor}
              onClick={() => onSelect(op.valor)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                backgroundColor: selected ? "var(--accent-muted)" : "var(--bg-base)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.1s, background-color 0.1s",
              }}
            >
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: selected ? "5px solid var(--accent)" : "2px solid var(--border-strong)",
                  transition: "border 0.1s",
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {op.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultados (perfil por dimensión y variable — modo encuesta)
// ---------------------------------------------------------------------------

function Resultados({
  encuesta,
  respuestas,
  onRehacer,
  onVolver,
}: {
  encuesta: Encuesta;
  respuestas: Record<number, number>;
  onRehacer: () => void;
  onVolver: () => void;
}) {
  const resultado = calcularResultado(encuesta, respuestas);
  const nivelGlobal = nivelPercepcion(resultado.promedioVariable);
  const porcentaje = Math.round(((resultado.promedioVariable - 1) / 4) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Resumen de la variable */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--bg-surface)",
          padding: "28px 24px",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>
          {encuesta.titulo}
        </h2>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "40px", fontWeight: 700, color: nivelGlobal.color, lineHeight: 1 }}>
            {resultado.promedioVariable.toFixed(2)}
          </span>
          <span style={{ fontSize: "16px", color: "var(--text-muted)" }}>/ 5.00</span>
        </div>
        <p style={{ fontSize: "14px", fontWeight: 600, color: nivelGlobal.color }}>
          {nivelGlobal.emoji} {nivelGlobal.label} · {porcentaje}%
        </p>
      </div>

      {/* Desglose por dimensión */}
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            marginBottom: "14px",
          }}
        >
          Perfil por dimensión
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {resultado.dimensiones.map((dim) => {
            const nivel = nivelPercepcion(dim.promedio);
            const ancho = (dim.promedio / 5) * 100;
            return (
              <div key={dim.nombre}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {dim.nombre}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: nivel.color }}>
                    {nivel.emoji} {dim.promedio.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-surface-hover)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${ancho}%`,
                      height: "100%",
                      borderRadius: "4px",
                      backgroundColor: nivel.color,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={onVolver}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 18px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            fontSize: "14px",
            fontWeight: 500,
            backgroundColor: "var(--accent)",
            color: "var(--bg-base)",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} /> Volver a evaluaciones
        </button>
        <button
          onClick={onRehacer}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 18px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            fontSize: "14px",
            fontWeight: 500,
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <RotateCcw size={14} /> Rehacer
        </button>
      </div>
    </div>
  );
}
