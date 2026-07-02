"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  MessageSquare,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useBreakpoint } from "@/lib/use-breakpoint";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tema {
  id: string;
  nombre: string;
  descripcion: string | null;
  es_predefinido: boolean;
}

interface Sesion {
  id: string;
  tema_id: string | null;
  nombre: string | null;
  iniciada_en: string;
  archivada: boolean;
}

interface SesionResponse {
  sesion_id: string;
  tema_id: string | null;
  iniciada_en: string;
}


interface ModalConfig {
  titulo: string;
  mensaje: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}

type Vista = "activas" | "archivadas" | "papelera";

const VISTA_LABELS: Record<Vista, string> = {
  activas: "Activas",
  archivadas: "Archivadas",
  papelera: "Papelera",
};

function formatFecha(isoString: string) {
  const d = new Date(isoString);
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const router = useRouter();
  const { isMobile, isDesktop } = useBreakpoint();

  const [temas, setTemas] = useState<Tema[]>([]);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoSesiones, setCargandoSesiones] = useState(true);
  const [vista, setVista] = useState<Vista>("activas");
  const [iniciando, setIniciando] = useState<string | "general" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalConfig | null>(null);

  useEffect(() => {
    apiFetch<Tema[]>("/temas")
      .then(setTemas)
      .catch(() => setError("No se pudieron cargar los temas."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    setCargandoSesiones(true);
    const params =
      vista === "papelera"
        ? "?eliminadas=true"
        : vista === "archivadas"
        ? "?archivadas=true"
        : "";
    apiFetch<Sesion[]>(`/chat/sesiones${params}`)
      .then(setSesiones)
      .catch(() => setSesiones([]))
      .finally(() => setCargandoSesiones(false));
  }, [vista]);

  const temaMap = Object.fromEntries(temas.map((t) => [t.id, t.nombre]));

  // Resolver nombre visible para cada sesión con numeración de duplicados
  function resolverNombreSesion(sesion: Sesion): string {
    return sesion.nombre ?? (sesion.tema_id ? temaMap[sesion.tema_id] : null) ?? "Chat general";
  }

  const nombresContador = new Map<string, number>();
  const nombresDisplay = new Map<string, string>();
  for (const s of sesiones) {
    const base = resolverNombreSesion(s);
    const count = (nombresContador.get(base) ?? 0) + 1;
    nombresContador.set(base, count);
    nombresDisplay.set(s.id, count > 1 ? `${base} (${count})` : base);
  }

  // ── Crear sesión ────────────────────────────────────────────────────────

  async function crearSesion(temaId: string | null) {
    const key = temaId ?? "general";
    if (iniciando) return;
    setIniciando(key);
    setError(null);
    try {
      const sesion = await apiFetch<SesionResponse>("/chat/sesiones", {
        method: "POST",
        body: JSON.stringify({ tema_id: temaId }),
      });
      router.push(`/chat/${sesion.sesion_id}`);
    } catch (err) {
      setError((err as Error).message);
      setIniciando(null);
    }
  }

  // ── Acciones sobre sesiones ─────────────────────────────────────────────

  async function handleArchivar(sesionId: string) {
    setSesiones((prev) => prev.filter((s) => s.id !== sesionId));
    try {
      await apiFetch(`/chat/sesiones/${sesionId}/archivar`, {
        method: "PATCH",
        body: JSON.stringify({ archivada: true }),
      });
    } catch {
      setError("No se pudo archivar la conversación.");
      recargarSesiones();
    }
  }

  async function handleDesarchivar(sesionId: string) {
    setSesiones((prev) => prev.filter((s) => s.id !== sesionId));
    try {
      await apiFetch(`/chat/sesiones/${sesionId}/archivar`, {
        method: "PATCH",
        body: JSON.stringify({ archivada: false }),
      });
    } catch {
      setError("No se pudo desarchivar la conversación.");
      recargarSesiones();
    }
  }

  function confirmarEliminar(sesionId: string) {
    setModal({
      titulo: "¿Mover a papelera?",
      mensaje:
        "La conversación se moverá a la papelera. Podés restaurarla desde la pestaña Papelera.",
      confirmLabel: "Mover a papelera",
      danger: true,
      onConfirm: () => {
        setModal(null);
        handleEliminar(sesionId);
      },
    });
  }

  async function handleEliminar(sesionId: string) {
    setSesiones((prev) => prev.filter((s) => s.id !== sesionId));
    try {
      await apiFetch(`/chat/sesiones/${sesionId}`, { method: "DELETE" });
    } catch {
      setError("No se pudo mover a papelera.");
      recargarSesiones();
    }
  }

  async function handleRestaurar(sesionId: string) {
    setSesiones((prev) => prev.filter((s) => s.id !== sesionId));
    try {
      await apiFetch(`/chat/sesiones/${sesionId}/restaurar`, { method: "PATCH" });
    } catch {
      setError("No se pudo restaurar la conversación.");
      recargarSesiones();
    }
  }

  function confirmarEliminarPermanente(sesionId: string) {
    setModal({
      titulo: "Eliminar definitivamente",
      mensaje:
        "Esta conversación y todos sus mensajes se eliminarán para siempre. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar definitivamente",
      danger: true,
      onConfirm: () => {
        setModal(null);
        handleEliminarPermanente(sesionId);
      },
    });
  }

  async function handleEliminarPermanente(sesionId: string) {
    setSesiones((prev) => prev.filter((s) => s.id !== sesionId));
    try {
      await apiFetch(`/chat/sesiones/${sesionId}/permanente`, { method: "DELETE" });
    } catch {
      setError("No se pudo eliminar la conversación.");
      recargarSesiones();
    }
  }

  function recargarSesiones() {
    const params =
      vista === "papelera"
        ? "?eliminadas=true"
        : vista === "archivadas"
        ? "?archivadas=true"
        : "";
    apiFetch<Sesion[]>(`/chat/sesiones${params}`)
      .then(setSesiones)
      .catch(() => {});
  }

  function getAcciones(sesionId: string) {
    if (vista === "activas") {
      return [
        { titulo: "Archivar", icon: <Archive size={12} />, onClick: () => handleArchivar(sesionId) },
        { titulo: "Mover a papelera", icon: <Trash2 size={12} />, onClick: () => confirmarEliminar(sesionId), danger: true },
      ];
    }
    if (vista === "archivadas") {
      return [
        { titulo: "Desarchivar", icon: <ArchiveRestore size={12} />, onClick: () => handleDesarchivar(sesionId) },
        { titulo: "Mover a papelera", icon: <Trash2 size={12} />, onClick: () => confirmarEliminar(sesionId), danger: true },
      ];
    }
    return [
      { titulo: "Restaurar", icon: <RotateCcw size={12} />, onClick: () => handleRestaurar(sesionId) },
      { titulo: "Eliminar definitivamente", icon: <Trash2 size={12} />, onClick: () => confirmarEliminarPermanente(sesionId), danger: true },
    ];
  }

  const EMPTY_STATE: Record<Vista, { icon: React.ReactNode; texto: string }> = {
    activas: {
      icon: <MessageSquare size={20} style={{ color: "var(--text-muted)", marginBottom: "10px" }} />,
      texto: "Todavía no tenés conversaciones.\nHacé clic en Nuevo chat para empezar.",
    },
    archivadas: {
      icon: <Archive size={20} style={{ color: "var(--text-muted)", marginBottom: "10px" }} />,
      texto: "No hay conversaciones archivadas.",
    },
    papelera: {
      icon: <Trash2 size={20} style={{ color: "var(--text-muted)", marginBottom: "10px" }} />,
      texto: "La papelera está vacía.",
    },
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {modal && (
        <ConfirmModal
          titulo={modal.titulo}
          mensaje={modal.mensaje}
          confirmLabel={modal.confirmLabel}
          danger={modal.danger}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}

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
            Asistente de ERP
          </p>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "8px",
            }}
          >
            ¿Sobre qué querés aprender hoy?
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "520px" }}>
            Podés iniciar un chat libre sobre cualquier tema de ERP, o elegir uno de los temas
            frecuentes para enfocar la conversación.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "var(--danger)", marginBottom: "20px" }}>{error}</p>
        )}

        {/* Layout dos columnas en desktop */}
        <div
          style={{
            display: isDesktop ? "grid" : "block",
            gridTemplateColumns: isDesktop ? "3fr 2fr" : undefined,
            gap: isDesktop ? "48px" : undefined,
            alignItems: "start",
          }}
        >
          {/* Columna izquierda */}
          <div>
            {/* Botón principal: Nuevo chat */}
            <button
              onClick={() => crearSesion(null)}
              disabled={iniciando !== null}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "14px 20px",
                marginBottom: "36px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--accent)",
                backgroundColor: "var(--accent-muted)",
                color: "var(--accent)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: iniciando !== null ? "not-allowed" : "pointer",
                opacity: iniciando !== null && iniciando !== "general" ? 0.5 : 1,
                transition: "background-color 0.15s, opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!iniciando)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "rgba(74,222,128,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "var(--accent-muted)";
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "30px",
                  height: "30px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--accent)",
                  color: "var(--bg-base)",
                  flexShrink: 0,
                }}
              >
                <Plus size={16} />
              </span>
              {iniciando === "general" ? "Iniciando chat…" : "Nuevo chat"}
            </button>

            {/* Temas frecuentes */}
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Temas frecuentes
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  marginBottom: "16px",
                }}
              >
                Posiblemente te interesen estos temas
              </p>

              {cargando ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: "104px",
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
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {temas.map((tema) => (
                    <TemaCard
                      key={tema.id}
                      tema={tema}
                      loading={iniciando === tema.id}
                      disabled={iniciando !== null && iniciando !== tema.id}
                      onClick={() => crearSesion(tema.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha — historial de conversaciones (solo desktop) */}
          {isDesktop && (
            <div>
              {/* Tabs */}
              <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
                {(["activas", "archivadas", "papelera"] as Vista[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVista(v)}
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      border:
                        vista === v
                          ? "1px solid var(--border-strong)"
                          : "1px solid transparent",
                      backgroundColor: vista === v ? "var(--bg-surface-hover)" : "transparent",
                      color: vista === v ? "var(--text-primary)" : "var(--text-muted)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {VISTA_LABELS[v]}
                  </button>
                ))}
              </div>

              {/* Lista de sesiones */}
              {cargandoSesiones ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: "42px",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        opacity: 0.4,
                      }}
                    />
                  ))}
                </div>
              ) : sesiones.length === 0 ? (
                <div
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    border: "1px dashed var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {EMPTY_STATE[vista].icon}
                  {EMPTY_STATE[vista].texto.split("\n").map((line, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {sesiones.slice(0, 10).map((sesion) => (
                    <SesionItem
                      key={sesion.id}
                      sesion={sesion}
                      displayName={nombresDisplay.get(sesion.id) ?? resolverNombreSesion(sesion)}
                      onClick={
                        vista !== "papelera"
                          ? () => router.push(`/chat/${sesion.id}`)
                          : undefined
                      }
                      acciones={getAcciones(sesion.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
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
        gap: "8px",
        padding: "16px",
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
            width: "28px",
            height: "28px",
            borderRadius: "var(--radius-sm)",
            backgroundColor:
              hover && !disabled ? "var(--accent-muted)" : "rgba(255,255,255,0.05)",
            color: hover && !disabled ? "var(--accent)" : "var(--text-muted)",
            transition: "background-color 0.15s, color 0.15s",
          }}
        >
          <BookOpen size={14} />
        </span>
        {tema.es_predefinido && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 500,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--accent-muted)",
              color: "var(--accent)",
              letterSpacing: "0.02em",
            }}
          >
            Oficial
          </span>
        )}
      </div>
      <div>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: "3px",
            lineHeight: 1.35,
          }}
        >
          {loading ? "Iniciando…" : tema.nombre}
        </p>
        {tema.descripcion && (
          <p
            style={{
              fontSize: "11px",
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
// SesionItem
// ---------------------------------------------------------------------------

interface Accion {
  titulo: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

function SesionItem({
  sesion,
  displayName,
  onClick,
  acciones,
}: {
  sesion: Sesion;
  displayName: string;
  onClick?: () => void;
  acciones: Accion[];
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 12px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${hover ? "var(--border-strong)" : "var(--border)"}`,
        backgroundColor: hover ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s, background-color 0.15s",
      }}
    >
      <MessageSquare size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />

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
        {displayName}
      </p>

      {hover ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}
        >
          {acciones.map((a) => (
            <ActionIconBtn key={a.titulo} title={a.titulo} onClick={a.onClick} danger={a.danger}>
              {a.icon}
            </ActionIconBtn>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
          {formatFecha(sesion.iniciada_en)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionIconBtn
// ---------------------------------------------------------------------------

function ActionIconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: hover
          ? danger
            ? "rgba(239,68,68,0.12)"
            : "rgba(255,255,255,0.06)"
          : "none",
        color: hover ? (danger ? "var(--danger)" : "var(--text-primary)") : "var(--text-muted)",
        cursor: "pointer",
        transition: "background 0.1s, color 0.1s",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ConfirmModal
// ---------------------------------------------------------------------------

function ConfirmModal({
  titulo,
  mensaje,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  titulo: string;
  mensaje: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          padding: "28px 28px 24px",
          maxWidth: "380px",
          width: "calc(100% - 32px)",
        }}
      >
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "10px",
          }}
        >
          {titulo}
        </h3>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: "24px",
          }}
        >
          {mensaje}
        </p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: "13px",
              fontWeight: 500,
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontSize: "13px",
              fontWeight: 500,
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: danger ? "var(--danger)" : "var(--accent)",
              color: "#fff",
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
