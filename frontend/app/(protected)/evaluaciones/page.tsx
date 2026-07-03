"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ArrowRight } from "lucide-react";
import { useBreakpoint } from "@/lib/use-breakpoint";
import { ENCUESTAS, totalPreguntas, type Encuesta } from "@/lib/encuestas-data";

export default function EvaluacionesPage() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();

  return (
    <div
      style={{
        padding: isMobile ? "24px 16px" : "40px 48px",
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Evaluaciones
        </h1>
      </div>

      {/* Grid de 4 tarjetas — una por variable */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: "16px",
        }}
      >
        {ENCUESTAS.map((encuesta) => (
          <EncuestaCard
            key={encuesta.slug}
            encuesta={encuesta}
            onClick={() => router.push(`/evaluaciones/encuesta/${encuesta.slug}`)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EncuestaCard
// ---------------------------------------------------------------------------

function EncuestaCard({
  encuesta,
  onClick,
}: {
  encuesta: Encuesta;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const total = totalPreguntas(encuesta);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "14px",
        padding: "24px",
        borderRadius: "var(--radius-md)",
        border: hover ? "1px solid var(--accent)" : "1px solid var(--border)",
        backgroundColor: hover ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, background-color 0.15s",
        width: "100%",
        height: "100%",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--accent-muted)",
          color: "var(--accent)",
        }}
      >
        <ClipboardList size={18} />
      </span>

      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: "17px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "6px",
            lineHeight: 1.3,
          }}
        >
          {encuesta.titulo}
        </p>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {encuesta.descripcion}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          marginTop: "4px",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {total} preguntas
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "13px",
            fontWeight: 500,
            color: hover ? "var(--accent)" : "var(--text-secondary)",
            transition: "color 0.15s",
          }}
        >
          Responder <ArrowRight size={14} />
        </span>
      </div>
    </button>
  );
}
