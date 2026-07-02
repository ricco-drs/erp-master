"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, ChevronUp, ChevronDown, FileText, Archive, RotateCcw, X } from "lucide-react";
import { apiFetch, apiFetchForm } from "@/lib/api";
import { useBreakpoint } from "@/lib/use-breakpoint";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tema {
  id: string;
  nombre: string;
  es_predefinido: boolean;
}

interface Documento {
  id: string;
  nombre_archivo: string;
  formato: string;
  visibilidad: "privado" | "compartido";
  estado_moderacion: "pendiente" | "aprobado" | "rechazado";
  motivo_rechazo?: string | null;
  subido_en: string;
  tema_id: string | null;
  archivada_en?: string | null;
  eliminada_en?: string | null;
}

interface Papelera {
  archivados: Documento[];
  eliminados: Documento[];
}

interface SubidaResponse {
  id: string;
  nombre_archivo: string;
  chunks_generados: number;
  estado_moderacion: string;
}

type Tab = "activos" | "archivados" | "papelera";

interface ConfirmOptions {
  titulo: string;
  descripcion: string;
  labelAceptar: string;
  danger?: boolean;
  onConfirm: () => void;
}

// ---------------------------------------------------------------------------
// Confirm modal
// ---------------------------------------------------------------------------

function ConfirmModal({ opts, onClose }: { opts: ConfirmOptions; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          maxWidth: "400px",
          width: "calc(100% - 32px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{opts.titulo}</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
          >
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.5 }}>
          {opts.descripcion}
        </p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-strong)",
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { opts.onConfirm(); onClose(); }}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: opts.danger ? "var(--danger)" : "var(--accent)",
              color: opts.danger ? "#fff" : "var(--bg-base)",
              cursor: "pointer",
            }}
          >
            {opts.labelAceptar}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function BadgeEstado({ estado }: { estado: Documento["estado_moderacion"] }) {
  const styles: Record<string, React.CSSProperties> = {
    aprobado: { backgroundColor: "var(--accent-muted)", color: "var(--accent)" },
    pendiente: { backgroundColor: "rgba(255,255,255,0.06)", color: "var(--text-muted)" },
    rechazado: { backgroundColor: "rgba(239,68,68,0.12)", color: "var(--danger)" },
  };
  const labels: Record<string, string> = { aprobado: "Aprobado", pendiente: "Pendiente", rechazado: "Rechazado" };
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, ...styles[estado] }}>
      {labels[estado]}
    </span>
  );
}

function BadgeVisibilidad({ visibilidad }: { visibilidad: Documento["visibilidad"] }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500,
      backgroundColor: visibilidad === "compartido" ? "var(--accent-muted)" : "rgba(255,255,255,0.06)",
      color: visibilidad === "compartido" ? "var(--accent)" : "var(--text-muted)",
    }}>
      {visibilidad === "compartido" ? "Compartido" : "Privado"}
    </span>
  );
}

function BadgeFormato({ formato }: { formato: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 6px", borderRadius: "var(--radius-sm)", fontSize: "11px",
      fontWeight: 500, fontFamily: "monospace", backgroundColor: "rgba(255,255,255,0.06)",
      color: "var(--text-secondary)", textTransform: "uppercase",
    }}>
      {formato}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Upload panel
// ---------------------------------------------------------------------------

function UploadPanel({ temas, onUploaded, onClose }: { temas: Tema[]; onUploaded: () => void; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [temaId, setTemaId] = useState(temas[0]?.id ?? "");
  const [visibilidad, setVisibilidad] = useState<"privado" | "compartido">("privado");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) { setError("Seleccioná un archivo."); return; }
    if (!temaId) { setError("Seleccioná un tema."); return; }
    setSubiendo(true); setError(null); setExito(null);
    const form = new FormData();
    form.append("archivo", archivo);
    form.append("tema_id", temaId);
    form.append("visibilidad", visibilidad);
    try {
      const res = await apiFetchForm<SubidaResponse>("/documentos", form);
      setExito(`Subido correctamente — ${res.chunks_generados} fragmentos generados.`);
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
    padding: "8px 12px", fontSize: "14px", color: "var(--text-primary)", outline: "none", width: "100%",
  };

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-surface)", padding: "20px 24px", marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>Subir documento</p>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
          <ChevronUp size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={{ fontSize: "13px", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
            Archivo <span style={{ color: "var(--text-muted)" }}>(PDF, DOCX, TXT, MD — máx. 10 MB)</span>
          </label>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} style={{ ...inputStyle, cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontSize: "13px", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Tema</label>
            <select value={temaId} onChange={(e) => setTemaId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {temas.map((t) => (<option key={t.id} value={t.id}>{t.nombre}{t.es_predefinido ? " ★" : ""}</option>))}
            </select>
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label style={{ fontSize: "13px", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Visibilidad</label>
            <div style={{ display: "flex" }}>
              {(["privado", "compartido"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setVisibilidad(v)} style={{
                  flex: 1, padding: "8px 0", fontSize: "13px", fontWeight: 500,
                  border: "1px solid var(--border)", cursor: "pointer",
                  borderRadius: v === "privado" ? "var(--radius-sm) 0 0 var(--radius-sm)" : "0 var(--radius-sm) var(--radius-sm) 0",
                  backgroundColor: visibilidad === v ? "var(--accent-muted)" : "var(--bg-base)",
                  color: visibilidad === v ? "var(--accent)" : "var(--text-secondary)",
                }}>
                  {v === "privado" ? "Privado" : "Compartido"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {visibilidad === "compartido" && (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            Los documentos compartidos pasan por moderación automática antes de ser visibles para otros usuarios.
          </p>
        )}
        {error && <p style={{ fontSize: "13px", color: "var(--danger)", margin: 0 }}>{error}</p>}
        {exito && <p style={{ fontSize: "13px", color: "var(--accent)", margin: 0 }}>{exito}</p>}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={subiendo} style={{ padding: "8px 16px", fontSize: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", backgroundColor: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button type="submit" disabled={subiendo} style={{ padding: "8px 20px", fontSize: "14px", fontWeight: 500, borderRadius: "var(--radius-sm)", border: "none", backgroundColor: subiendo ? "var(--accent-muted)" : "var(--accent)", color: subiendo ? "var(--accent)" : "var(--bg-base)", cursor: subiendo ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Upload size={14} />
            {subiendo ? "Procesando..." : "Subir"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doc row — activos
// ---------------------------------------------------------------------------

function DocRow({
  doc, temaNombre, isLast, obrando, onArchivar, onEliminar, cols, isMobile, isTablet,
}: {
  doc: Documento; temaNombre: string; isLast: boolean; obrando: boolean;
  onArchivar: () => void; onEliminar: () => void;
  cols: string; isMobile: boolean; isTablet: boolean;
}) {
  const fecha = new Date(doc.subido_en).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: cols, padding: "12px 16px", borderBottom: isLast ? "none" : "1px solid var(--border)", alignItems: "center", backgroundColor: "var(--bg-base)" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-base)")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <BadgeFormato formato={doc.formato} />
        <span style={{ fontSize: "13px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={doc.nombre_archivo}>
          {doc.nombre_archivo}
        </span>
      </div>
      {!isMobile && !isTablet && (
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={temaNombre}>
            {temaNombre}
          </span>
        </div>
      )}
      {!isMobile && (
        <div style={{ minWidth: 0 }}>
          <BadgeVisibilidad visibilidad={doc.visibilidad} />
        </div>
      )}
      {!isMobile && (
        <div style={{ minWidth: 0 }}>
          <BadgeEstado estado={doc.estado_moderacion} />
          {doc.motivo_rechazo && (
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={doc.motivo_rechazo}>
              {doc.motivo_rechazo.slice(0, 40)}…
            </p>
          )}
        </div>
      )}
      {!isMobile && !isTablet && (
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fecha}</span>
        </div>
      )}
      {/* Acciones */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
        <ActionBtn title="Archivar" onClick={onArchivar} disabled={obrando}>
          <Archive size={13} />
        </ActionBtn>
        <ActionBtn title="Mover a papelera" onClick={onEliminar} disabled={obrando} danger>
          <Trash2 size={13} />
        </ActionBtn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doc row — archivados / papelera
// ---------------------------------------------------------------------------

function DocRowSecundario({
  doc, temaNombre, isLast, obrando, onRestaurar, onEliminarPerm, cols, isMobile, isTablet, tipo,
}: {
  doc: Documento; temaNombre: string; isLast: boolean; obrando: boolean;
  onRestaurar: () => void; onEliminarPerm: () => void;
  cols: string; isMobile: boolean; isTablet: boolean; tipo: "archivado" | "eliminado";
}) {
  const fecha = new Date(doc.subido_en).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: cols, padding: "12px 16px", borderBottom: isLast ? "none" : "1px solid var(--border)", alignItems: "center", backgroundColor: "var(--bg-base)", opacity: 0.8 }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; e.currentTarget.style.opacity = "1"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-base)"; e.currentTarget.style.opacity = "0.8"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <BadgeFormato formato={doc.formato} />
        <span style={{ fontSize: "13px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={doc.nombre_archivo}>
          {doc.nombre_archivo}
        </span>
      </div>
      {!isMobile && !isTablet && (
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <span style={{ fontSize: "13px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{temaNombre}</span>
        </div>
      )}
      {!isMobile && (
        <div style={{ minWidth: 0 }}>
          <BadgeVisibilidad visibilidad={doc.visibilidad} />
        </div>
      )}
      {!isMobile && (
        <div style={{ minWidth: 0 }}>
          <BadgeEstado estado={doc.estado_moderacion} />
        </div>
      )}
      {!isMobile && !isTablet && (
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fecha}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
        <ActionBtn title="Restaurar" onClick={onRestaurar} disabled={obrando}>
          <RotateCcw size={13} />
        </ActionBtn>
        {tipo === "eliminado" && (
          <ActionBtn title="Eliminar permanentemente" onClick={onEliminarPerm} disabled={obrando} danger>
            <Trash2 size={13} />
          </ActionBtn>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Botón de acción compacto
// ---------------------------------------------------------------------------

function ActionBtn({ title, onClick, disabled, danger, children }: {
  title: string; onClick: () => void; disabled: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer",
        color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "5px", borderRadius: "var(--radius-sm)", transition: "color 0.1s, background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.color = danger ? "var(--danger)" : "var(--accent)";
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = danger ? "rgba(239,68,68,0.1)" : "var(--accent-muted)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tabla wrapper
// ---------------------------------------------------------------------------

function TablaWrapper({ cols, headers, children, empty }: {
  cols: string; headers: string[]; children: React.ReactNode; empty: boolean;
}) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 16px", backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        {headers.map((col) => (
          <span key={col} style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            {col}
          </span>
        ))}
      </div>
      {empty ? (
        <div style={{ padding: "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <FileText size={28} style={{ color: "var(--text-muted)" }} />
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sin documentos aquí.</p>
        </div>
      ) : children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [papelera, setPapelera] = useState<Papelera>({ archivados: [], eliminados: [] });
  const [temas, setTemas] = useState<Tema[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoPapelera, setCargandoPapelera] = useState(false);
  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [tab, setTab] = useState<Tab>("activos");
  const [obrando, setObrando] = useState<string | null>(null);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const { isMobile, isTablet } = useBreakpoint();

  const temaMap = Object.fromEntries(temas.map((t) => [t.id, t.nombre]));

  useEffect(() => {
    Promise.all([apiFetch<Documento[]>("/documentos"), apiFetch<Tema[]>("/temas")])
      .then(([d, t]) => { setDocs(d); setTemas(t); })
      .catch(() => setErrorGlobal("No se pudieron cargar los documentos."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (tab === "archivados" || tab === "papelera") {
      setCargandoPapelera(true);
      apiFetch<Papelera>("/documentos/papelera")
        .then(setPapelera)
        .catch(() => {})
        .finally(() => setCargandoPapelera(false));
    }
  }, [tab]);

  function recargarActivos() {
    apiFetch<Documento[]>("/documentos").then(setDocs).catch(() => {});
  }

  function recargarPapelera() {
    apiFetch<Papelera>("/documentos/papelera").then(setPapelera).catch(() => {});
  }

  async function accion(id: string, fn: () => Promise<unknown>) {
    setObrando(id);
    setErrorGlobal(null);
    try { await fn(); }
    catch { setErrorGlobal("No se pudo completar la acción. Intentá de nuevo."); }
    finally { setObrando(null); }
  }

  function pedirArchivar(doc: Documento) {
    setConfirm({
      titulo: "Archivar documento",
      descripcion: `"${doc.nombre_archivo}" se moverá a la sección de archivados. Podrás restaurarlo en cualquier momento.`,
      labelAceptar: "Archivar",
      onConfirm: () => accion(doc.id, async () => {
        await apiFetch(`/documentos/${doc.id}/archivar`, { method: "PATCH" });
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
        recargarPapelera();
      }),
    });
  }

  function pedirMoverPapelera(doc: Documento) {
    setConfirm({
      titulo: "Mover a papelera",
      descripcion: `"${doc.nombre_archivo}" se moverá a la papelera. Podrás restaurarlo o eliminarlo permanentemente desde ahí.`,
      labelAceptar: "Mover a papelera",
      danger: true,
      onConfirm: () => accion(doc.id, async () => {
        await apiFetch(`/documentos/${doc.id}`, { method: "DELETE" });
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
        recargarPapelera();
      }),
    });
  }

  function pedirRestaurar(doc: Documento) {
    setConfirm({
      titulo: "Restaurar documento",
      descripcion: `"${doc.nombre_archivo}" volverá a tus documentos activos.`,
      labelAceptar: "Restaurar",
      onConfirm: () => accion(doc.id, async () => {
        await apiFetch(`/documentos/${doc.id}/restaurar`, { method: "PATCH" });
        recargarActivos();
        recargarPapelera();
      }),
    });
  }

  function pedirEliminarPermanente(doc: Documento) {
    setConfirm({
      titulo: "Eliminar permanentemente",
      descripcion: `"${doc.nombre_archivo}" se eliminará de forma permanente junto con todos sus fragmentos. Esta acción no se puede deshacer.`,
      labelAceptar: "Eliminar para siempre",
      danger: true,
      onConfirm: () => accion(doc.id, async () => {
        await apiFetch(`/documentos/${doc.id}`, { method: "DELETE" });
        recargarPapelera();
      }),
    });
  }

  const cols = isMobile
    ? "1fr 64px"
    : isTablet
    ? "1fr 110px 110px 64px"
    : "1fr 180px 110px 110px 80px 64px";

  const headers = isMobile
    ? ["Archivo", ""]
    : isTablet
    ? ["Archivo", "Visibilidad", "Estado", ""]
    : ["Archivo", "Tema", "Visibilidad", "Estado", "Subido", ""];

  const compartidos = docs.filter((d) => d.visibilidad === "compartido");
  const aprobados = docs.filter((d) => d.estado_moderacion === "aprobado");

  return (
    <div style={{ padding: isMobile ? "24px 16px" : "40px 48px", maxWidth: "960px", margin: "0 auto" }}>
      {confirm && <ConfirmModal opts={confirm} onClose={() => setConfirm(null)} />}

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
          Base de conocimiento
        </p>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>Documentos</h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Gestiona los archivos que alimentan tu asistente de ERP.</p>
          </div>
          {!mostrarSubida && tab === "activos" && (
            <button
              onClick={() => setMostrarSubida(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "14px", fontWeight: 500, borderRadius: "var(--radius-sm)", border: "none", backgroundColor: "var(--accent)", color: "var(--bg-base)", cursor: "pointer", flexShrink: 0 }}
            >
              <ChevronDown size={14} />
              Subir documento
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", backgroundColor: "var(--border)", marginBottom: "24px", overflow: "hidden" }}>
        {[
          { label: "Documentos", value: docs.length },
          { label: "Compartidos", value: compartidos.length },
          { label: "Aprobados", value: aprobados.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: "var(--bg-surface)", padding: "20px 24px" }}>
            <p style={{ fontSize: "26px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{cargando ? "—" : value}</p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Upload panel */}
      {mostrarSubida && <UploadPanel temas={temas} onUploaded={() => { recargarActivos(); }} onClose={() => setMostrarSubida(false)} />}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", marginBottom: "16px", borderBottom: "1px solid var(--border)" }}>
        {([
          { key: "activos", label: "Activos" },
          { key: "archivados", label: "Archivados" },
          { key: "papelera", label: "Papelera" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: tab === key ? 500 : 400,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: tab === key ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "color 0.1s",
            }}
          >
            {label}
            {key === "archivados" && papelera.archivados.length > 0 && (
              <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--text-muted)", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "1px 6px" }}>
                {papelera.archivados.length}
              </span>
            )}
            {key === "papelera" && papelera.eliminados.length > 0 && (
              <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--danger)", backgroundColor: "rgba(239,68,68,0.1)", borderRadius: "10px", padding: "1px 6px" }}>
                {papelera.eliminados.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {errorGlobal && <p style={{ fontSize: "13px", color: "var(--danger)", marginBottom: "12px" }}>{errorGlobal}</p>}

      {/* Tab: Activos */}
      {tab === "activos" && (
        cargando ? (
          <div style={{ padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Cargando...</p>
          </div>
        ) : (
          <TablaWrapper cols={cols} headers={headers} empty={docs.length === 0}>
            {docs.map((doc, i) => (
              <DocRow
                key={doc.id}
                doc={doc}
                temaNombre={temaMap[doc.tema_id ?? ""] ?? "—"}
                isLast={i === docs.length - 1}
                obrando={obrando === doc.id}
                onArchivar={() => pedirArchivar(doc)}
                onEliminar={() => pedirMoverPapelera(doc)}
                cols={cols} isMobile={isMobile} isTablet={isTablet}
              />
            ))}
          </TablaWrapper>
        )
      )}

      {/* Tab: Archivados */}
      {tab === "archivados" && (
        cargandoPapelera ? (
          <div style={{ padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Cargando...</p>
          </div>
        ) : (
          <TablaWrapper cols={cols} headers={headers} empty={papelera.archivados.length === 0}>
            {papelera.archivados.map((doc, i) => (
              <DocRowSecundario
                key={doc.id}
                doc={doc}
                temaNombre={temaMap[doc.tema_id ?? ""] ?? "—"}
                isLast={i === papelera.archivados.length - 1}
                obrando={obrando === doc.id}
                onRestaurar={() => pedirRestaurar(doc)}
                onEliminarPerm={() => pedirMoverPapelera(doc)}
                cols={cols} isMobile={isMobile} isTablet={isTablet}
                tipo="archivado"
              />
            ))}
          </TablaWrapper>
        )
      )}

      {/* Tab: Papelera */}
      {tab === "papelera" && (
        cargandoPapelera ? (
          <div style={{ padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Cargando...</p>
          </div>
        ) : (
          <>
            {papelera.eliminados.length > 0 && (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                Los documentos en papelera se pueden restaurar o eliminar permanentemente.
              </p>
            )}
            <TablaWrapper cols={cols} headers={headers} empty={papelera.eliminados.length === 0}>
              {papelera.eliminados.map((doc, i) => (
                <DocRowSecundario
                  key={doc.id}
                  doc={doc}
                  temaNombre={temaMap[doc.tema_id ?? ""] ?? "—"}
                  isLast={i === papelera.eliminados.length - 1}
                  obrando={obrando === doc.id}
                  onRestaurar={() => pedirRestaurar(doc)}
                  onEliminarPerm={() => pedirEliminarPermanente(doc)}
                  cols={cols} isMobile={isMobile} isTablet={isTablet}
                  tipo="eliminado"
                />
              ))}
            </TablaWrapper>
          </>
        )
      )}
    </div>
  );
}
