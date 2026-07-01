"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ClipboardCheck, FileText } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session) router.replace("/dashboard");
      });
  }, [router]);

  function scrollToFeatures(e: React.MouseEvent) {
    e.preventDefault();
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--bg-base)",
        color: "var(--text-primary)",
        minHeight: "100vh",
        animation: "landingFadeIn 0.4s ease both",
      }}
    >
      {/* ── NAVBAR ── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 56,
          backgroundColor: "var(--bg-base)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 48px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo image placeholder — reemplazar con <Image> cuando esté disponible */}
          <div
            style={{
              width: 28,
              height: 28,
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 7, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              logo
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 3,
                height: 18,
                backgroundColor: "var(--accent)",
                borderRadius: 2,
              }}
            />
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              ChatERP
            </span>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/login"
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              textDecoration: "none",
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            Iniciar sesión
          </a>
          <a
            href="/registro"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--bg-base)",
              backgroundColor: "var(--accent)",
              textDecoration: "none",
              padding: "7px 18px",
              borderRadius: "var(--radius-sm)",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
          >
            Comenzar →
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 48px 80px",
          overflow: "hidden",
        }}
      >
        {/* Dot grid texture */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.04,
            pointerEvents: "none",
          }}
        />

        {/* Label */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div
            style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Asistente de capacitación ERP
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(44px, 6vw, 64px)",
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            textAlign: "center",
            color: "var(--text-primary)",
            marginBottom: 20,
            maxWidth: 680,
          }}
        >
          Aprende ERP.
          <br />
          A tu ritmo.{" "}
          <span style={{ color: "var(--accent)" }}>Con IA.</span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--text-secondary)",
            textAlign: "center",
            maxWidth: 500,
            marginBottom: 36,
          }}
        >
          Capacitación conversacional en sistemas ERP basada en inteligencia artificial.
          Practica, evalúate y avanza a tu propio ritmo.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 64 }}>
          <a
            href="/registro"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--bg-base)",
              backgroundColor: "var(--accent)",
              textDecoration: "none",
              padding: "10px 22px",
              borderRadius: "var(--radius-sm)",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
          >
            Comenzar gratis →
          </a>
          <a
            href="#features"
            onClick={scrollToFeatures}
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-secondary)",
              textDecoration: "none",
              padding: "10px 22px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              transition: "border-color 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-strong)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Ver cómo funciona
          </a>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            maxWidth: 800,
            height: 1,
            backgroundColor: "var(--border)",
            marginBottom: 40,
          }}
        />

        {/* Product mockup — chat */}
        <div
          style={{
            width: "100%",
            maxWidth: 800,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            opacity: 0.9,
            backgroundColor: "var(--bg-surface)",
          }}
        >
          {/* Window chrome */}
          <div
            style={{
              height: 36,
              backgroundColor: "var(--bg-base)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              gap: 6,
            }}
          >
            <div
              style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }}
            />
            <div
              style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }}
            />
            <div
              style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }}
            />
            <span style={{ marginLeft: 12, fontSize: 11, color: "var(--text-muted)" }}>
              ChatERP — Sesión activa
            </span>
          </div>

          {/* Body: sidebar + chat */}
          <div style={{ display: "flex", height: 300 }}>
            {/* Sidebar */}
            <div
              style={{
                width: 152,
                borderRight: "1px solid var(--border)",
                padding: "14px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                flexShrink: 0,
              }}
            >
              {(["Inicio", "Chat", "Evaluaciones", "Documentos"] as const).map((item, i) => (
                <div
                  key={item}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 11,
                    color: i === 1 ? "var(--text-primary)" : "var(--text-muted)",
                    backgroundColor: i === 1 ? "var(--bg-surface-hover)" : "transparent",
                    borderLeft: i === 1 ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>

            {/* Chat area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div
                style={{
                  flex: 1,
                  padding: "18px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  overflow: "hidden",
                }}
              >
                {/* Assistant */}
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--accent-muted)",
                      border: "1px solid var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }}
                    />
                  </div>
                  <div
                    style={{
                      backgroundColor: "var(--bg-surface-hover)",
                      borderRadius: "var(--radius-md)",
                      padding: "9px 13px",
                      maxWidth: 380,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                      Los sistemas ERP integran los procesos de negocio en una plataforma unificada,
                      permitiendo gestionar finanzas, RRHH e inventario desde un único sistema.
                    </p>
                  </div>
                </div>

                {/* User */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "var(--accent-muted)",
                      borderRadius: "var(--radius-md)",
                      padding: "9px 13px",
                      maxWidth: 260,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
                      ¿Cuáles son los módulos principales de SAP?
                    </p>
                  </div>
                </div>

                {/* Assistant 2 */}
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--accent-muted)",
                      border: "1px solid var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }}
                    />
                  </div>
                  <div
                    style={{
                      backgroundColor: "var(--bg-surface-hover)",
                      borderRadius: "var(--radius-md)",
                      padding: "9px 13px",
                      maxWidth: 380,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                      SAP incluye{" "}
                      <span style={{ color: "var(--accent)" }}>FI</span> (finanzas),{" "}
                      <span style={{ color: "var(--accent)" }}>MM</span> (materiales),{" "}
                      <span style={{ color: "var(--accent)" }}>SD</span> (ventas) y{" "}
                      <span style={{ color: "var(--accent)" }}>HR</span> (recursos humanos) como módulos base...
                    </p>
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div
                style={{
                  padding: "10px 18px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 32,
                    backgroundColor: "var(--bg-base)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Escribí tu pregunta...
                  </span>
                </div>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: "var(--accent)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--bg-base)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="features"
        style={{
          borderTop: "1px solid var(--border)",
          padding: "96px 48px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div
              style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              Funcionalidades
            </span>
          </div>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 30px)",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 48,
              letterSpacing: "-0.02em",
            }}
          >
            ¿Qué puede hacer ChatERP?
          </h2>

          {/* Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            {[
              {
                icon: <MessageSquare size={20} />,
                title: "Chat conversacional",
                desc: "Conversa con el asistente sobre cualquier módulo ERP. Responde únicamente con base en el material del tema seleccionado.",
              },
              {
                icon: <ClipboardCheck size={20} />,
                title: "Evaluaciones automáticas",
                desc: "Genera preguntas de opción múltiple, V/F y abiertas. Recibí calificación y feedback inmediato generado por IA.",
              },
              {
                icon: <FileText size={20} />,
                title: "Base de conocimiento",
                desc: "Subí tus propios materiales (PDF, Word, Markdown) para personalizar el asistente con el contenido que necesitás.",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                style={{
                  padding: "28px 24px",
                  backgroundColor: "var(--bg-surface)",
                  borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                  transition: "background-color 0.2s",
                  cursor: "default",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--bg-surface)")
                }
              >
                <div style={{ color: "var(--accent)", marginBottom: 16 }}>{f.icon}</div>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.65,
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        style={{
          borderTop: "1px solid var(--border)",
          padding: "96px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "2fr 3fr",
            gap: 72,
            alignItems: "center",
          }}
        >
          {/* Left: steps */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div
                style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Flujo de uso
              </span>
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 30px)",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 40,
                letterSpacing: "-0.02em",
              }}
            >
              Así funciona →
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {[
                {
                  n: "01",
                  title: "Seleccioná un tema",
                  desc: "Elegí el módulo ERP que querés estudiar: fundamentos, gestión del cambio, implementación y más.",
                },
                {
                  n: "02",
                  title: "Conversá con el asistente",
                  desc: "Hacé preguntas, pedí explicaciones o casos prácticos. El asistente responde solo con el material del tema.",
                },
                {
                  n: "03",
                  title: "Evaluá tu aprendizaje",
                  desc: "Generá una evaluación automática de 8 preguntas y recibí calificación con feedback por IA en escala 0–20.",
                },
                {
                  n: "04",
                  title: "Revisá tu progreso",
                  desc: "En tu perfil encontrás el historial de sesiones, puntajes por tema y los documentos que subiste.",
                },
              ].map((step) => (
                <div key={step.n} style={{ display: "flex", gap: 16 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--accent)",
                      flexShrink: 0,
                      paddingTop: 2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {step.n}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      {step.title}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}
                    >
                      {step.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: evaluacion mockup */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              opacity: 0.9,
              backgroundColor: "var(--bg-surface)",
            }}
          >
            {/* Window chrome */}
            <div
              style={{
                height: 36,
                backgroundColor: "var(--bg-base)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                gap: 6,
              }}
            >
              <div
                style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }}
              />
              <div
                style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }}
              />
              <div
                style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }}
              />
              <span style={{ marginLeft: 12, fontSize: 11, color: "var(--text-muted)" }}>
                ChatERP — Evaluación
              </span>
            </div>

            {/* Evaluacion body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  Pregunta 3 de 8
                </div>
                {/* Progress bar */}
                <div
                  style={{
                    height: 3,
                    backgroundColor: "var(--border)",
                    borderRadius: 2,
                    overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: "37%",
                      height: "100%",
                      backgroundColor: "var(--accent)",
                      borderRadius: 2,
                    }}
                  />
                </div>
                <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
                  ¿Cuál describe mejor la función del módulo FI en SAP?
                </p>
              </div>

              {[
                { label: "A", text: "Gestión de recursos humanos", selected: false },
                { label: "B", text: "Contabilidad financiera y controlling", selected: true },
                { label: "C", text: "Planificación de la producción", selected: false },
                { label: "D", text: "Gestión de la cadena de suministro", selected: false },
              ].map((opt) => (
                <div
                  key={opt.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: opt.selected
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border)",
                    backgroundColor: opt.selected ? "var(--accent-muted)" : "transparent",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: opt.selected ? "var(--accent)" : "var(--text-muted)",
                      width: 16,
                      flexShrink: 0,
                    }}
                  >
                    {opt.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: opt.selected ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {opt.text}
                  </span>
                </div>
              ))}

              <div
                style={{
                  marginTop: 4,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--bg-base)",
                    backgroundColor: "var(--accent)",
                    padding: "7px 18px",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  Siguiente →
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          ChatERP · Proyecto académico — Feria de proyectos 2026
        </span>
        <div style={{ display: "flex", gap: 20 }}>
          <a
            href="/login"
            style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            Iniciar sesión
          </a>
          <a
            href="/registro"
            style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            Registrarse
          </a>
        </div>
      </footer>

      <style>{`
        @keyframes landingFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
