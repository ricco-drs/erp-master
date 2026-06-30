"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/supabase/session-context";
import { getSupabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

interface UsuarioBackend {
  id: string;
  nombre: string;
  email: string;
  created_at: string;
}

export default function DashboardPage() {
  const { user } = useSession();
  const router = useRouter();
  const [backendUser, setBackendUser] = useState<UsuarioBackend | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UsuarioBackend>("/me")
      .then(setBackendUser)
      .catch((err: Error & { status?: number }) => {
        if (err.status === 401) {
          getSupabase().auth.signOut();
          router.replace("/login");
        } else {
          setBackendError("No se pudo conectar con el servidor.");
        }
      });
  }, [router]);

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 32px" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
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
          Dashboard
        </p>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Bienvenido, {user?.user_metadata?.nombre ?? user?.email}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "32px" }}>
          {user?.email}
        </p>

        {/* Datos confirmados desde el backend */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-surface)",
            padding: "16px 20px",
            marginBottom: "12px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            Verificado por el backend
          </p>

          {backendError ? (
            <p style={{ fontSize: "13px", color: "var(--danger)" }}>{backendError}</p>
          ) : backendUser ? (
            <dl style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Row label="Nombre" value={backendUser.nombre} />
              <Row label="Email" value={backendUser.email} />
              <Row label="ID" value={backendUser.id} mono />
              <Row
                label="Registrado"
                value={new Date(backendUser.created_at).toLocaleString("es-PE")}
              />
            </dl>
          ) : (
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Consultando backend...
            </p>
          )}
        </div>

        <button
          onClick={handleLogout}
          style={{
            marginTop: "20px",
            backgroundColor: "transparent",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 16px",
            fontSize: "14px",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "12px" }}>
      <dt
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          minWidth: "90px",
          flexShrink: 0,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          wordBreak: "break-all",
          fontFamily: mono ? "monospace" : "inherit",
          margin: 0,
        }}
      >
        {value}
      </dd>
    </div>
  );
}
