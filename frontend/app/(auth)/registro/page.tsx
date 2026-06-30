"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { nombre } },
    });

    setLoading(false);

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        setError("Ya existe una cuenta con ese correo electrónico.");
      } else {
        setError("No se pudo crear la cuenta. Verificá los datos e intentá de nuevo.");
      }
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "400px",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "40px 32px",
      }}
    >
      <h1
        style={{
          fontSize: "22px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "8px",
        }}
      >
        Crear cuenta
      </h1>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "32px" }}>
        Ingresá tus datos para comenzar.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Field label="Nombre">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Correo electrónico">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Contraseña">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            minLength={6}
            required
            style={inputStyle}
          />
        </Field>

        {error && (
          <p style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={loading ? { ...primaryBtn, opacity: 0.6, cursor: "not-allowed" } : primaryBtn}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p style={{ marginTop: "24px", fontSize: "13px", color: "var(--text-secondary)", textAlign: "center" }}>
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 12px",
  fontSize: "14px",
  color: "var(--text-primary)",
  outline: "none",
  width: "100%",
};

const primaryBtn: React.CSSProperties = {
  backgroundColor: "var(--accent)",
  color: "var(--bg-base)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  width: "100%",
  marginTop: "8px",
};
