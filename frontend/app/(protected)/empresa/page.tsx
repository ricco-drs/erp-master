"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Building2, MessageSquare, Trash2, X,
  Loader2, Upload, FileText, CheckCircle2, AlertCircle, Paperclip,
} from "lucide-react";
import { useBreakpoint } from "@/lib/use-breakpoint";
import { apiFetch, apiFetchForm } from "@/lib/api";

interface CasoOut {
  id: string;
  nombre: string;
  descripcion: string | null;
  modulo_id: string | null;
  documento_id: string | null;
  creado_en: string;
}

interface ModalConfirm {
  casoId: string;
  casoNombre: string;
}

// ─── Tipos para el estado del archivo seleccionado ───────────────────────────
type EstadoArchivo = "idle" | "procesando" | "ok" | "error";

interface ArchivoSeleccionado {
  file: File;
  estado: EstadoArchivo;
  mensaje: string;
}

export default function EmpresaPage() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const [casos, setCasos] = useState<CasoOut[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<ModalConfirm | null>(null);

  useEffect(() => {
    cargarCasos();
  }, []);

  function cargarCasos() {
    setCargando(true);
    apiFetch<CasoOut[]>("/casos-empresa")
      .then(setCasos)
      .catch(() => {})
      .finally(() => setCargando(false));
  }

  async function chatearCaso(caso: CasoOut) {
    try {
      const sesion = await apiFetch<{ sesion_id: string }>("/chat/sesiones", {
        method: "POST",
        body: JSON.stringify({ caso_empresa_id: caso.id }),
      });
      const ctx = encodeURIComponent(caso.nombre);
      router.push(`/chat/${sesion.sesion_id}?modo=caso&ctx=${ctx}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "No se pudo iniciar el chat.");
    }
  }

  async function eliminarCaso(casoId: string) {
    await apiFetch(`/casos-empresa/${casoId}`, { method: "DELETE" });
    setCasos((prev) => prev.filter((c) => c.id !== casoId));
    setModalEliminar(null);
  }

  return (
    <div style={{ padding: isMobile ? "32px 16px" : "48px 48px", maxWidth: "860px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
            Análisis
          </p>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
            Mi empresa
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Subí documentación de un ERP real o hipotético y chateá con el asistente sobre ese caso específico.
          </p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "9px 16px", borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--accent)", color: "#000",
            border: "none", cursor: "pointer",
            fontSize: "13px", fontWeight: 500, flexShrink: 0,
          }}
        >
          <Plus size={14} />
          Nuevo caso
        </button>
      </div>

      {/* Lista de casos */}
      {cargando ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ height: "90px", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", opacity: 0.5 }} />
          ))}
        </div>
      ) : casos.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", border: "1px dashed var(--border)", borderRadius: "var(--radius-md)" }}>
          <Building2 size={32} style={{ color: "var(--text-muted)", marginBottom: "12px", opacity: 0.4 }} />
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "4px" }}>Todavía no tenés casos de empresa</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", opacity: 0.7 }}>
            Creá uno para analizar un ERP específico con el asistente.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {casos.map((caso) => (
            <CasoCard
              key={caso.id}
              caso={caso}
              onChatear={() => chatearCaso(caso)}
              onEliminar={() => setModalEliminar({ casoId: caso.id, casoNombre: caso.nombre })}
            />
          ))}
        </div>
      )}

      {/* Modal — Nuevo caso */}
      {modalNuevo && (
        <NuevoCasoModal
          onClose={() => setModalNuevo(false)}
          onCreado={() => { setModalNuevo(false); cargarCasos(); }}
        />
      )}

      {/* Modal — Confirmar eliminación */}
      {modalEliminar && (
        <ConfirmModal
          mensaje={`¿Eliminar el caso "${modalEliminar.casoNombre}"? Esta acción no se puede deshacer.`}
          labelConfirmar="Eliminar"
          danger
          onConfirmar={() => eliminarCaso(modalEliminar.casoId)}
          onCancelar={() => setModalEliminar(null)}
        />
      )}
    </div>
  );
}

// ─── CasoCard ─────────────────────────────────────────────────────────────────

function CasoCard({
  caso,
  onChatear,
  onEliminar,
}: {
  caso: CasoOut;
  onChatear: () => void;
  onEliminar: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: "16px",
        padding: "16px 20px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${hover ? "var(--border-strong)" : "var(--border)"}`,
        backgroundColor: hover ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        transition: "border-color 0.12s, background-color 0.12s",
      }}
    >
      <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Building2 size={16} style={{ color: "var(--accent)" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{caso.nombre}</p>
          {caso.documento_id && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "3px",
              fontSize: "10px", fontWeight: 500, letterSpacing: "0.04em",
              color: "var(--accent)", backgroundColor: "var(--accent-muted)",
              padding: "2px 7px", borderRadius: "20px",
            }}>
              <Paperclip size={9} />
              DOC
            </span>
          )}
        </div>
        {caso.descripcion && (
          <p style={{ fontSize: "13px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
            {caso.descripcion}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={onChatear}
          title="Chatear sobre este caso"
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "7px 12px", borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--accent)", color: "#000",
            border: "none", cursor: "pointer",
            fontSize: "12px", fontWeight: 500,
          }}
        >
          <MessageSquare size={12} />
          Chatear
        </button>
        <button
          onClick={onEliminar}
          title="Eliminar caso"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "30px", height: "30px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── NuevoCasoModal ────────────────────────────────────────────────────────────

function NuevoCasoModal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<ArchivoSeleccionado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const FORMATOS = ["pdf", "docx", "txt", "md"];

  function validarArchivo(file: File): string | null {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!FORMATOS.includes(ext)) return `Formato no soportado. Se aceptan: ${FORMATOS.join(", ").toUpperCase()}.`;
    if (file.size > 10 * 1024 * 1024) return "El archivo supera los 10 MB.";
    return null;
  }

  function seleccionarFile(file: File) {
    const err = validarArchivo(file);
    if (err) { setError(err); return; }
    setError("");
    setArchivo({ file, estado: "idle", mensaje: "" });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) seleccionarFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) seleccionarFile(file);
    e.target.value = "";
  }

  async function guardar() {
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setGuardando(true);
    setError("");

    try {
      // 1. Crear el caso base (sin documento todavía)
      const caso = await apiFetch<CasoOut>("/casos-empresa", {
        method: "POST",
        body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() || null }),
      });

      // 2. Si hay archivo, subirlo y vincularlo al caso
      if (archivo) {
        setArchivo((prev) => prev ? { ...prev, estado: "procesando", mensaje: "Procesando archivo…" } : prev);
        const form = new FormData();
        form.append("archivo", archivo.file);
        try {
          await apiFetchForm(`/casos-empresa/${caso.id}/documentos`, form);
          setArchivo((prev) => prev ? { ...prev, estado: "ok", mensaje: "Archivo procesado correctamente." } : prev);
        } catch (uploadErr: unknown) {
          const msg = uploadErr instanceof Error ? uploadErr.message : "No se pudo procesar el archivo.";
          setArchivo((prev) => prev ? { ...prev, estado: "error", mensaje: msg } : prev);
          // El caso ya fue creado — cerramos igual pero avisamos
          setTimeout(onCreado, 1200);
          return;
        }
      }

      onCreado();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear el caso.");
    } finally {
      setGuardando(false);
    }
  }

  const iconoFormato = (nombre: string) => {
    const ext = nombre.split(".").pop()?.toLowerCase();
    return ext === "pdf" ? "📄" : ext === "docx" ? "📝" : "📃";
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <div style={{
        position: "relative", zIndex: 1,
        width: "min(520px, 94vw)",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "24px",
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Nuevo caso de empresa
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Nombre */}
          <label>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Nombre de la empresa / caso *</p>
            <input
              id="caso-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
              placeholder="Ej. Implementación SAP en Textil Andina SAC"
              style={{
                width: "100%", padding: "8px 12px", boxSizing: "border-box",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-base)",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </label>

          {/* Descripción */}
          <label>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Contexto / descripción (opcional)</p>
            <textarea
              id="caso-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe la empresa, el ERP que usan, el sector, los problemas a resolver…"
              rows={3}
              style={{
                width: "100%", padding: "8px 12px", boxSizing: "border-box",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-base)",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>

          {/* Zona de carga de archivo */}
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
              Documento de referencia
              <span style={{ marginLeft: "6px", opacity: 0.6 }}>(PDF, DOCX, TXT, MD — máx. 10 MB)</span>
            </p>

            {!archivo ? (
              /* Drop zone */
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: "8px",
                  padding: "24px",
                  borderRadius: "var(--radius-sm)",
                  border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                  backgroundColor: dragOver ? "var(--accent-muted)" : "var(--bg-base)",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                }}
              >
                <Upload size={20} style={{ color: dragOver ? "var(--accent)" : "var(--text-muted)", opacity: dragOver ? 1 : 0.6 }} />
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                  Arrastrá un archivo o <span style={{ color: "var(--accent)", textDecoration: "underline" }}>seleccionalo</span>
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, opacity: 0.8 }}>
                  Contrato, manual, caso de estudio, informe…
                </p>
              </div>
            ) : (
              /* Archivo seleccionado — chip de estado */
              <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${
                  archivo.estado === "ok" ? "var(--accent)" :
                  archivo.estado === "error" ? "var(--danger)" :
                  "var(--border)"
                }`,
                backgroundColor: "var(--bg-base)",
              }}>
                {/* Ícono */}
                <span style={{ fontSize: "18px", lineHeight: 1 }}>{iconoFormato(archivo.file.name)}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                    {archivo.file.name}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
                    {(archivo.file.size / 1024).toFixed(0)} KB
                    {archivo.estado === "procesando" && " · Procesando…"}
                    {archivo.estado === "ok" && " · Listo"}
                    {archivo.estado === "error" && ` · ${archivo.mensaje}`}
                  </p>
                </div>

                {/* Estado */}
                {archivo.estado === "procesando" && <Loader2 size={16} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite", flexShrink: 0 }} />}
                {archivo.estado === "ok" && <CheckCircle2 size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                {archivo.estado === "error" && <AlertCircle size={16} style={{ color: "var(--danger)", flexShrink: 0 }} />}
                {(archivo.estado === "idle" || archivo.estado === "error") && (
                  <button
                    onClick={() => setArchivo(null)}
                    title="Quitar archivo"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: "2px", flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Botón secundario para cambiar archivo cuando ya hay uno */}
            {archivo && archivo.estado === "idle" && (
              <button
                onClick={() => inputRef.current?.click()}
                style={{
                  marginTop: "6px",
                  display: "flex", alignItems: "center", gap: "4px",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "11px", color: "var(--text-muted)",
                  padding: "2px 0",
                }}
              >
                <FileText size={11} />
                Cambiar archivo
              </button>
            )}

            {/* Input oculto */}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={onInputChange}
              style={{ display: "none" }}
            />
          </div>

          {/* Nota informativa */}
          <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
            El archivo será procesado automáticamente para alimentar el contexto del asistente.
            Podés agregar o reemplazar el documento más tarde desde el chat del caso.
          </p>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertCircle size={13} style={{ color: "var(--danger)", flexShrink: 0 }} />
              <p style={{ fontSize: "13px", color: "var(--danger)", margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Botones */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || archivo?.estado === "procesando"}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 18px", borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--accent)", color: "#000",
              border: "none", cursor: (guardando || archivo?.estado === "procesando") ? "default" : "pointer",
              fontSize: "13px", fontWeight: 500,
              opacity: (guardando || archivo?.estado === "procesando") ? 0.7 : 1,
            }}
          >
            {guardando && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            {archivo ? "Crear caso y subir archivo" : "Crear caso"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  mensaje,
  labelConfirmar,
  danger,
  onConfirmar,
  onCancelar,
}: {
  mensaje: string;
  labelConfirmar: string;
  danger?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onCancelar} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <div style={{
        position: "relative", zIndex: 1,
        width: "min(400px, 90vw)",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "24px",
      }}>
        <p style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6, marginBottom: "24px" }}>{mensaje}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onCancelar}
            style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            style={{
              padding: "8px 16px", borderRadius: "var(--radius-sm)",
              backgroundColor: danger ? "var(--danger)" : "var(--accent)",
              color: danger ? "#fff" : "#000",
              border: "none", cursor: "pointer",
              fontSize: "13px", fontWeight: 500,
            }}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
