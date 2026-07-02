"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, ArrowLeft, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "@/lib/api";
import { useBreakpoint } from "@/lib/use-breakpoint";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Mensaje {
  id: string;
  rol_emisor: "usuario" | "asistente";
  contenido: string;
  enviado_en: string;
}

interface EnviarMensajeResponse {
  mensaje_id: string;
  contenido: string;
  fuera_de_alcance: boolean;
  chunks_usados: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHora(isoString: string) {
  return new Date(isoString).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Componentes de mensaje
// ---------------------------------------------------------------------------

function MensajeUsuario({ msg }: { msg: Mensaje }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
      <div style={{ maxWidth: "72%" }}>
        <div
          style={{
            backgroundColor: "var(--bg-surface-hover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
          }}
        >
          <p style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
            {msg.contenido}
          </p>
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right", marginTop: "4px" }}>
          {formatHora(msg.enviado_en)}
        </p>
      </div>
    </div>
  );
}

function MensajeAsistente({ msg, fueraDeAlcance }: { msg: Mensaje; fueraDeAlcance?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "24px", maxWidth: "82%" }}>
      <div style={{ flexShrink: 0, marginTop: "2px" }}>
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: fueraDeAlcance ? "var(--text-muted)" : "var(--accent)",
            marginTop: "8px",
          }}
        />
      </div>

      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: fueraDeAlcance ? "var(--text-muted)" : "var(--accent)",
            textTransform: "uppercase",
            marginBottom: "6px",
          }}
        >
          Asistente
        </p>
        <div
          style={{
            fontSize: "14px",
            color: fueraDeAlcance ? "var(--text-secondary)" : "var(--text-primary)",
            lineHeight: 1.7,
          }}
        >
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p style={{ margin: "0 0 10px", lineHeight: 1.7 }}>{children}</p>
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>{children}</strong>
              ),
              em: ({ children }) => (
                <em style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>{children}</em>
              ),
              ul: ({ children }) => (
                <ul style={{ margin: "0 0 10px", paddingLeft: "20px" }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ margin: "0 0 10px", paddingLeft: "20px" }}>{children}</ol>
              ),
              li: ({ children }) => (
                <li style={{ marginBottom: "4px", lineHeight: 1.6 }}>{children}</li>
              ),
              code: ({ children }) => (
                <code
                  style={{
                    fontFamily: "monospace",
                    fontSize: "13px",
                    backgroundColor: "rgba(255,255,255,0.07)",
                    padding: "1px 5px",
                    borderRadius: "3px",
                    color: "var(--accent)",
                  }}
                >
                  {children}
                </code>
              ),
              h3: ({ children }) => (
                <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "12px 0 6px", color: "var(--text-primary)" }}>
                  {children}
                </h3>
              ),
            }}
          >
            {msg.contenido}
          </ReactMarkdown>
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
          {formatHora(msg.enviado_en)}
        </p>
      </div>
    </div>
  );
}

function MensajeCargando() {
  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
      <div style={{ flexShrink: 0, marginTop: "10px" }}>
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "var(--accent)",
            opacity: 0.5,
          }}
        />
      </div>
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: "var(--accent)",
            textTransform: "uppercase",
            marginBottom: "6px",
            opacity: 0.6,
          }}
        >
          Asistente
        </p>
        <LoadingDots />
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: "5px", alignItems: "center", height: "20px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: "var(--text-muted)",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

type MensajeConMeta = Mensaje & { fuera_de_alcance?: boolean };

export default function ConversacionPage({
  params,
}: {
  params: Promise<{ sesionId: string }>;
}) {
  const { sesionId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMobile } = useBreakpoint();

  const [mensajes, setMensajes] = useState<MensajeConMeta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  // Previene doble ejecución del mensaje inicial en StrictMode
  const mensajeInicialEnviado = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cargar historial inicial; disparar bienvenida/pregunta si la sesión es nueva
  useEffect(() => {
    apiFetch<Mensaje[]>(`/chat/sesiones/${sesionId}/mensajes`)
      .then((msgs) => {
        setMensajes(msgs);

        // Solo actuar si la sesión no tiene mensajes previos
        if (msgs.length === 0 && !mensajeInicialEnviado.current) {
          mensajeInicialEnviado.current = true;

          const q = searchParams.get("q");
          const modo = searchParams.get("modo"); // "subtema" | "caso"
          const nombreContexto = searchParams.get("ctx"); // nombre del sub-tema o caso

          if (q) {
            // Pregunta inicial desde chip de preguntas sugeridas
            enviarMensajeInterno(q);
          } else if (modo === "subtema" && nombreContexto) {
            enviarMensajeInterno(
              `Hola. Estoy empezando a estudiar el sub-tema: "${decodeURIComponent(nombreContexto)}". ` +
              `Por favor, dame una introducción clara sobre de qué trata este tema, ` +
              `cuáles son los conceptos más importantes que voy a aprender, ` +
              `y recomiéndame libros, documentación oficial o recursos clave para profundizar más. ` +
              `Presentá tu respuesta de forma estructurada.`,
              true // ocultar el mensaje del usuario
            );
          } else if (modo === "caso" && nombreContexto) {
            enviarMensajeInterno(
              `Acabo de subir la documentación del caso: "${decodeURIComponent(nombreContexto)}". ` +
              `Por favor, analizá el documento que tenés disponible y dame un resumen ejecutivo: ` +
              `¿de qué trata este caso?, ¿cuál es el contexto de la empresa?, ` +
              `¿cuáles son los puntos más relevantes que identificás? ` +
              `Luego indicame cómo podés ayudarme con este caso.`,
              true // ocultar el mensaje del usuario
            );
          }
        }
      })
      .catch(() => setError("No se pudo cargar la conversación."))
      .finally(() => setCargando(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionId]);

  // Scroll al fondo cuando lleguen nuevos mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, enviando]);

  // Ajustar altura del textarea al contenido
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [texto]);

  /**
   * Envía un mensaje al backend. Cuando `ocultarUsuario=true`, el mensaje del
   * usuario no se renderiza en la UI (es el mensaje de bienvenida automático).
   */
  async function enviarMensajeInterno(contenido: string, ocultarUsuario = false) {
    if (!contenido.trim() || enviando) return;

    setTexto("");
    setErrorEnvio(null);
    setEnviando(true);

    // Solo agregamos el mensaje del usuario a la UI si NO es oculto
    const msgId = `temp-${Date.now()}`;
    if (!ocultarUsuario) {
      const msgUsuario: MensajeConMeta = {
        id: msgId,
        rol_emisor: "usuario",
        contenido,
        enviado_en: new Date().toISOString(),
      };
      setMensajes((prev) => [...prev, msgUsuario]);
    }

    try {
      const res = await apiFetch<EnviarMensajeResponse>(
        `/chat/sesiones/${sesionId}/mensajes`,
        { method: "POST", body: JSON.stringify({ contenido }) }
      );
      setMensajes((prev) => [
        // Si ocultamos el mensaje del usuario, filtramos el temp (que no está)
        ...prev,
        {
          id: res.mensaje_id,
          rol_emisor: "asistente",
          contenido: res.contenido,
          enviado_en: new Date().toISOString(),
          fuera_de_alcance: res.fuera_de_alcance,
        },
      ]);
    } catch (err) {
      setErrorEnvio((err as Error).message);
      if (!ocultarUsuario) {
        setMensajes((prev) => prev.filter((m) => m.id !== msgId));
        setTexto(contenido);
      }
    } finally {
      setEnviando(false);
      textareaRef.current?.focus();
    }
  }

  async function enviarContenido(contenido: string) {
    enviarMensajeInterno(contenido);
  }

  function handleEnviar() {
    enviarContenido(texto.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  }

  // Estado de la sesión (nombre, etc.)
  const [sesionNombre, setSesionNombre] = useState<string | null>(null);

  // Cargar información de la sesión
  useEffect(() => {
    apiFetch<{ nombre: string | null; tema_id: string | null }>(`/chat/sesiones/${sesionId}`)
      .then((data) => setSesionNombre(data.nombre))
      .catch(() => {});
  }, [sesionId]);

  // Después de enviar el primer mensaje, refrescar el nombre (puede haber cambiado)
  useEffect(() => {
    if (mensajes.length > 0 && !sesionNombre) {
      apiFetch<{ nombre: string | null }>(`/chat/sesiones/${sesionId}`)
        .then((data) => {
          if (data.nombre) setSesionNombre(data.nombre);
        })
        .catch(() => {});
    }
  }, [mensajes.length, sesionId, sesionNombre]);

  // Título visible en el header
  const modoHeader = searchParams.get("modo");
  const ctxHeader = searchParams.get("ctx")
    ? decodeURIComponent(searchParams.get("ctx")!)
    : null;
  const headerNombre = ctxHeader ?? sesionNombre ?? "Chat general";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "12px",
          color: "var(--text-secondary)",
        }}
      >
        <AlertCircle size={24} style={{ color: "var(--danger)" }} />
        <p style={{ fontSize: "14px" }}>{error}</p>
        <button
          onClick={() => router.push("/chat")}
          style={{
            fontSize: "13px",
            color: "var(--accent)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Volver a temas
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header de la sesión */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: isMobile ? "10px 16px" : "12px 32px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <button
          onClick={() => {
            if (modoHeader === "subtema") router.back();
            else if (modoHeader === "caso") router.push("/empresa");
            else router.push("/chat");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)")}
        >
          <ArrowLeft size={14} />
          {modoHeader === "caso" ? "Mi empresa" : modoHeader === "subtema" ? "Sub-temas" : "Temas"}
        </button>

        <span style={{ color: "var(--border)", fontSize: "16px" }}>/</span>

        <p style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {headerNombre}
        </p>

        <span
          style={{
            flexShrink: 0,
            fontSize: "11px",
            color: "var(--text-muted)",
            fontFamily: "monospace",
          }}
        >
          {sesionId.slice(0, 8)}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Área de mensajes */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isMobile ? "24px 16px" : "40px 48px",
        }}
      >
        <div style={{ maxWidth: "880px", margin: "0 auto" }}>
          {/* Estado vacío: solo se muestra si estamos cargando o no hay nada que mostrar */}
          {!cargando && mensajes.length === 0 && !enviando && (
            <div style={{ textAlign: "center", marginTop: "80px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--accent-muted)",
                  marginBottom: "16px",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--accent)",
                    display: "block",
                  }}
                />
              </div>
              <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "6px" }}>
                ¿En qué puedo ayudarte?
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "320px", margin: "0 auto" }}>
                Hacé una pregunta sobre el tema seleccionado y responderé basándome en los documentos disponibles.
              </p>
            </div>
          )}

          {/* Mensajes */}
          {mensajes.map((msg) =>
            msg.rol_emisor === "usuario" ? (
              <MensajeUsuario key={msg.id} msg={msg} />
            ) : (
              <MensajeAsistente
                key={msg.id}
                msg={msg}
                fueraDeAlcance={msg.fuera_de_alcance}
              />
            )
          )}

          {/* Indicador de carga mientras espera respuesta */}
          {enviando && <MensajeCargando />}

          {/* Anchor para scroll */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Input de mensaje */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
          padding: isMobile ? "12px 16px 20px" : "16px 48px 24px",
          backgroundColor: "var(--bg-base)",
        }}
      >
        <div style={{ maxWidth: "880px", margin: "0 auto" }}>
          {/* Error de envío */}
          {errorEnvio && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <AlertCircle size={13} style={{ color: "var(--danger)", flexShrink: 0 }} />
              <p style={{ fontSize: "13px", color: "var(--danger)", margin: 0 }}>{errorEnvio}</p>
            </div>
          )}

          {/* Caja de input */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "8px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "10px 10px 10px 16px",
              transition: "border-color 0.15s",
            }}
            onFocusCapture={(e) =>
              ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)")
            }
            onBlurCapture={(e) =>
              ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")
            }
          >
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
              rows={1}
              disabled={enviando}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "14px",
                color: "var(--text-primary)",
                lineHeight: 1.6,
                overflowY: "auto",
                maxHeight: "160px",
              }}
            />
            <button
              onClick={handleEnviar}
              disabled={!texto.trim() || enviando}
              title="Enviar (Enter)"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "34px",
                height: "34px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                backgroundColor:
                  !texto.trim() || enviando ? "rgba(74,222,128,0.15)" : "var(--accent)",
                color:
                  !texto.trim() || enviando ? "var(--accent)" : "var(--bg-base)",
                cursor: !texto.trim() || enviando ? "not-allowed" : "pointer",
                flexShrink: 0,
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              <Send size={14} />
            </button>
          </div>

          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", textAlign: "center" }}>
            Las respuestas se basan en los documentos del tema seleccionado.
          </p>
        </div>
      </div>
    </div>
  );
}
