"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabase/client";
import logoVerde from "@/assets/logos/CHAT-ERP-LOGO-VERDE.png";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "40px 36px 36px",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Logo + brand */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--accent-muted)",
            border: "1px solid rgba(74,222,128,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "12px",
          }}
        >
          <Image src={logoVerde} alt="ChatERP" height={32} style={{ objectFit: "contain" }} />
        </div>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          ChatERP
        </span>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: "6px",
          letterSpacing: "-0.02em",
        }}
      >
        Bienvenido de vuelta
      </h1>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "28px", lineHeight: 1.6 }}>
        Ingresá tus credenciales para continuar.
      </p>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "var(--border)", marginBottom: "28px" }} />

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Email */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.5)"; e.currentTarget.style.outline = "none"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        {/* Password */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Contraseña
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
              style={{ ...inputStyle, paddingRight: "44px" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: "11px",
                fontWeight: 500,
                padding: 0,
                letterSpacing: "0.02em",
              }}
            >
              {showPass ? "Ocultar" : "Ver"}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              backgroundColor: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: loading ? "var(--accent-hover)" : "var(--accent)",
            color: "var(--bg-base)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "11px 16px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            width: "100%",
            marginTop: "4px",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.15s, background-color 0.15s",
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "var(--accent-hover)"; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "var(--accent)"; }}
        >
          {loading ? "Iniciando sesión…" : "Iniciar sesión →"}
        </button>
      </form>

      {/* Footer */}
      <div style={{ marginTop: "24px", height: "1px", backgroundColor: "var(--border)" }} />
      <p style={{ marginTop: "20px", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
        ¿No tenés cuenta?{" "}
        <Link href="/registro" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
          Registrate
        </Link>
      </p>
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
  transition: "border-color 0.15s",
};
