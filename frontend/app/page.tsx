"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ClipboardCheck,
  FileText,
  Code2,
  Globe,
  Share2,
  Mail,
  MapPin,
  Shield,
  Zap,
  BookOpen,
  Users,
  Brain,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import logoVerde from "@/assets/logos/CHAT-ERP-LOGO-VERDE.png";
import logoBlanco from "@/assets/logos/CHAT-ERP-LOGO-BLANCO.png";
import imgDared from "@/assets/logos/members/dared-flores/Dared-Flores.jpeg";
import imgEvelyn from "@/assets/logos/members/evelyn-ventura/Evelyn-Ventura.jpeg";
import imgJoseCarlos from "@/assets/logos/members/josecarlos-valenzuela/Josecarlos-Valenzuela.jpg";
import imgJuan from "@/assets/logos/members/juan-pintado/Juan-Pintado.jpeg";
import imgKate from "@/assets/logos/members/kate-llantoy/Kate-Llantoy.jpeg";
import imgLady from "@/assets/logos/members/lady-torres/Lady-Torres.jpeg";
import imgRubi from "@/assets/logos/members/rubi-quispe/Rubí-Quispe.jpeg";

// ── Team ─────────────────────────────────────────────────────────────────────
const TEAM = [
  {
    nombre: "Dared Flores",
    rol: "Fullstack Developer & Project Lead",
    foto: imgDared,
    linkedin: "https://www.linkedin.com/in/flores-miranda/",
    color: "#4ADE80",
  },
  {
    nombre: "Lady Torres",
    rol: "DevOps & Infrastructure",
    foto: imgLady,
    linkedin: "https://www.linkedin.com/in/lady-torres-vera-96b4853a2/",
    color: "#34D399",
  },
  {
    nombre: "Rubí Quispe",
    rol: "ERP Specialist & Content",
    foto: imgRubi,
    linkedin: "https://www.linkedin.com/in/rubi-quispe-sierra/",
    color: "#FB923C",
  },
  {
    nombre: "Juan Pintado",
    rol: "ML Engineer & Embeddings",
    foto: imgJuan,
    linkedin: "https://www.linkedin.com/in/juan-andres-pintado-l%C3%B3pez-597826306",
    color: "#FBBF24",
  },
  {
    nombre: "Josecarlos Valenzuela",
    rol: "Frontend Developer & UX",
    foto: imgJoseCarlos,
    linkedin: "https://www.linkedin.com/in/josecarlos-valenzuela-arroyo",
    color: "#F472B6",
  },
  {
    nombre: "Kate Llantoy",
    rol: "Data Engineer",
    foto: imgKate,
    linkedin: "https://www.linkedin.com/in/kate-llantoy",
    color: "#A78BFA",
  },
  {
    nombre: "Evelyn Ventura",
    rol: "Backend Engineer",
    foto: imgEvelyn,
    linkedin: "https://www.linkedin.com/in/evelyn-janela-ventura-perez-51854241b",
    color: "#60A5FA",
  },
];

// ── Diferenciadores ───────────────────────────────────────────────────────────
const DIFERENCIADORES = [
  {
    icon: <Brain size={22} />,
    titulo: "IA generativa integrada",
    desc: "ChatERP usa modelos de lenguaje de última generación para responder preguntas en lenguaje natural sobre cualquier ERP, adaptando el nivel de detalle al usuario.",
  },
  {
    icon: <BookOpen size={22} />,
    titulo: "RAG sobre tu contenido",
    desc: "El sistema combina tu base de conocimiento propia con el material educativo estructurado, respondiendo siempre con contexto relevante y citable.",
  },
  {
    icon: <Zap size={22} />,
    titulo: "Sin costos de API de IA",
    desc: "Embeddings con modelos locales (sentence-transformers) y generación vía Groq API gratuita. No hay sorpresas en la facturación.",
  },
  {
    icon: <Shield size={22} />,
    titulo: "Privacidad y control total",
    desc: "Los documentos nunca salen de tu base de datos. RLS en Supabase garantiza que cada usuario solo accede a su propia información.",
  },
  {
    icon: <Users size={22} />,
    titulo: "Diseñado para equipos ERP",
    desc: "Flujo de capacitación estructurado: módulos → subtemas → evaluaciones → progreso. Pensado para proyectos de implementación real.",
  },
  {
    icon: <Lock size={22} />,
    titulo: "Evaluaciones automáticas",
    desc: "Genera exámenes de opción múltiple, V/F y preguntas abiertas con calificación y feedback inmediato por IA, sin intervención manual.",
  },
];

const NAV_SECTIONS = [
  { label: "Home", id: "home" },
  { label: "Nosotros", id: "nosotros" },
  { label: "Por qué nosotros", id: "por-que-nosotros" },
];

const FOOTER_AREAS = [
  "Chat ERP",
  "Evaluaciones automáticas",
  "Base de conocimiento",
  "Módulos de aprendizaje",
  "Seguimiento de progreso",
];

// ── ABET Badge (SVG inline) ───────────────────────────────────────────────────
function AbetBadge() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-label="ABET Accredited">
      <circle cx="36" cy="36" r="34" fill="#FFF7ED" stroke="#F97316" strokeWidth="2.5" />
      <circle cx="36" cy="36" r="27" fill="none" stroke="#F97316" strokeWidth="1" strokeDasharray="3 3" />
      <text x="36" y="33" textAnchor="middle" fontSize="13" fontWeight="800" fill="#EA580C" fontFamily="sans-serif" letterSpacing="1">
        ABET
      </text>
      <text x="36" y="47" textAnchor="middle" fontSize="7" fontWeight="500" fill="#F97316" fontFamily="sans-serif" letterSpacing="0.5">
        ACCREDITED
      </text>
    </svg>
  );
}

// ── UNI Badge (SVG inline) ────────────────────────────────────────────────────
function UniBadge() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-label="Universidad Nacional de Ingeniería">
      <circle cx="36" cy="36" r="34" fill="#FFF1F1" stroke="#8B1C1C" strokeWidth="2.5" />
      <circle cx="36" cy="36" r="27" fill="none" stroke="#8B1C1C" strokeWidth="1" strokeDasharray="3 3" />
      <text x="36" y="32" textAnchor="middle" fontSize="14" fontWeight="800" fill="#8B1C1C" fontFamily="sans-serif" letterSpacing="1">
        UNI
      </text>
      <text x="36" y="44" textAnchor="middle" fontSize="5.5" fontWeight="500" fill="#8B1C1C" fontFamily="sans-serif">
        LIMA · PERÚ
      </text>
    </svg>
  );
}

// ── Team Card ─────────────────────────────────────────────────────────────────
function TeamCard({ miembro }: { miembro: (typeof TEAM)[number] }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={miembro.linkedin}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        border: `1px solid ${hover ? miembro.color + "55" : "var(--border)"}`,
        backgroundColor: "var(--bg-surface)",
        transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
        transform: hover ? "translateY(-5px)" : "translateY(0)",
        boxShadow: hover ? `0 8px 24px ${miembro.color}18` : "none",
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      {/* Photo */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "120%",
          overflow: "hidden",
          backgroundColor: "var(--bg-base)",
        }}
      >
        <Image
          src={miembro.foto}
          alt={miembro.nombre}
          fill
          sizes="(max-width: 768px) 50vw, 200px"
          style={{ objectFit: "cover", objectPosition: "top center" }}
        />
        {/* LinkedIn badge */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            width: 30,
            height: 30,
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            border: "1.5px solid rgba(255,255,255,0.25)",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="15" cy="15" r="15" fill="#0A66C2"/>
            {/* i — dot */}
            <circle cx="10.5" cy="10" r="1.8" fill="white"/>
            {/* i — stem */}
            <rect x="9" y="13" width="3" height="9" rx="0.6" fill="white"/>
            {/* n */}
            <rect x="14" y="13" width="2.8" height="9" rx="0.6" fill="white"/>
            <path d="M16.8 15.8 C16.8 14.1 17.8 12.7 19.7 12.7 C21.5 12.7 22.4 14 22.4 15.8 L22.4 22 L19.6 22 L19.6 16.2 C19.6 15.4 19.2 14.9 18.5 14.9 C17.8 14.9 17.4 15.4 17.4 16.2 L17.4 22 L14.6 22 L14.6 13 L16.8 13 Z" fill="white"/>
          </svg>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 14px 18px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.01em" }}>
          {miembro.nombre}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Ingeniería Industrial · UNI
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          6to ciclo
        </p>
      </div>
    </a>
  );
}

// ── Diferenciador Card ────────────────────────────────────────────────────────
function DiferenciadoreCard({ item }: { item: (typeof DIFERENCIADORES)[number] }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "28px 24px",
        backgroundColor: hover ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        transition: "background-color 0.2s",
        cursor: "default",
      }}
    >
      <div style={{ color: "var(--accent)", marginBottom: 14 }}>{item.icon}</div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>
        {item.titulo}
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
        {item.desc}
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session) router.replace("/dashboard");
      });

    const handleMouseMove = (e: MouseEvent) => {
      if (overlayRef.current) {
        overlayRef.current.style.background = `radial-gradient(700px circle at ${e.clientX}px ${e.clientY}px, rgba(74,222,128,0.06) 0%, transparent 70%)`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [router]);

  function scrollTo(id: string) {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

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
        position: "relative",
      }}
    >
      {/* Mouse-tracking glow overlay */}
      <div
        ref={overlayRef}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* ── NAVBAR ── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 56,
          backgroundColor: "rgba(255,255,255,0.85)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Image src={logoVerde} alt="ChatERP" height={30} style={{ objectFit: "contain" }} />
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            ChatERP
          </span>
        </div>

        {/* Section nav — centered, desktop */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px 14px",
                borderRadius: "var(--radius-sm)",
                transition: "color 0.15s, background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Auth buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <a
            href="/login"
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              transition: "color 0.15s",
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
              padding: "6px 16px",
              borderRadius: "var(--radius-sm)",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
          >
            Comenzar →
          </a>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            top: 56,
            left: 0,
            right: 0,
            zIndex: 49,
            backgroundColor: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            padding: "8px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "10px 12px",
                textAlign: "left",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          HOME
      ═══════════════════════════════════════════ */}
      <section id="home">
        {/* Hero */}
        <div
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
          {/* Dot grid */}
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

          {/* Ambient glow orbs */}
          <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <div style={{
              position: "absolute", top: "10%", left: "15%",
              width: 500, height: 500,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 70%)",
              animation: "orbFloat1 12s ease-in-out infinite",
              filter: "blur(40px)",
            }} />
            <div style={{
              position: "absolute", top: "40%", right: "10%",
              width: 400, height: 400,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(74,222,128,0.05) 0%, transparent 70%)",
              animation: "orbFloat2 16s ease-in-out infinite",
              filter: "blur(50px)",
            }} />
            <div style={{
              position: "absolute", bottom: "5%", left: "40%",
              width: 350, height: 350,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(74,222,128,0.04) 0%, transparent 70%)",
              animation: "orbFloat3 20s ease-in-out infinite",
              filter: "blur(45px)",
            }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
            <div style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }} />
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

          <div style={{ width: "100%", maxWidth: 800, height: 1, backgroundColor: "var(--border)", marginBottom: 40 }} />

          {/* Chat mockup */}
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
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }} />
              <span style={{ marginLeft: 12, fontSize: 11, color: "var(--text-muted)" }}>ChatERP — Sesión activa</span>
            </div>

            <div style={{ display: "flex", height: 300 }}>
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

              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ flex: 1, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
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
                      <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }} />
                    </div>
                    <div style={{ backgroundColor: "var(--bg-surface-hover)", borderRadius: "var(--radius-md)", padding: "9px 13px", maxWidth: 380, border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                        Los sistemas ERP integran los procesos de negocio en una plataforma unificada,
                        permitiendo gestionar finanzas, RRHH e inventario desde un único sistema.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "flex-end" }}>
                    <div style={{ backgroundColor: "var(--accent-muted)", borderRadius: "var(--radius-md)", padding: "9px 13px", maxWidth: 260, border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
                        ¿Cuáles son los módulos principales de SAP?
                      </p>
                    </div>
                  </div>

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
                      <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }} />
                    </div>
                    <div style={{ backgroundColor: "var(--bg-surface-hover)", borderRadius: "var(--radius-md)", padding: "9px 13px", maxWidth: 380, border: "1px solid var(--border)" }}>
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

                <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
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
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Escribí tu pregunta...</span>
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg-base)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div id="features" style={{ borderTop: "1px solid var(--border)", padding: "96px 48px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }} />
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                Funcionalidades
              </span>
            </div>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 30px)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 48, letterSpacing: "-0.02em" }}>
              ¿Qué puede hacer ChatERP?
            </h2>
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
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface)")}
                >
                  <div style={{ color: "var(--accent)", marginBottom: 16 }}>{f.icon}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-secondary)", margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How it works */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "96px 48px" }}>
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
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }} />
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Flujo de uso
                </span>
              </div>
              <h2 style={{ fontSize: "clamp(24px, 3vw, 30px)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 40, letterSpacing: "-0.02em" }}>
                Así funciona →
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {[
                  { n: "01", title: "Seleccioná un tema", desc: "Elegí el módulo ERP que querés estudiar: fundamentos, gestión del cambio, implementación y más." },
                  { n: "02", title: "Conversá con el asistente", desc: "Hacé preguntas, pedí explicaciones o casos prácticos. El asistente responde solo con el material del tema." },
                  { n: "03", title: "Evaluá tu aprendizaje", desc: "Generá una evaluación automática de 8 preguntas y recibí calificación con feedback por IA en escala 0–20." },
                  { n: "04", title: "Revisá tu progreso", desc: "En tu perfil encontrás el historial de sesiones, puntajes por tema y los documentos que subiste." },
                ].map((step) => (
                  <div key={step.n} style={{ display: "flex", gap: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", flexShrink: 0, paddingTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      {step.n}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>{step.title}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Eval mockup */}
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", opacity: 0.9, backgroundColor: "var(--bg-surface)" }}>
              <div style={{ height: 36, backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 16px", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--border-strong)" }} />
                <span style={{ marginLeft: 12, fontSize: 11, color: "var(--text-muted)" }}>ChatERP — Evaluación</span>
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                    Pregunta 3 de 8
                  </div>
                  <div style={{ height: 3, backgroundColor: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{ width: "37%", height: "100%", backgroundColor: "var(--accent)", borderRadius: 2 }} />
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
                      border: opt.selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                      backgroundColor: opt.selected ? "var(--accent-muted)" : "transparent",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: opt.selected ? "var(--accent)" : "var(--text-muted)", width: 16, flexShrink: 0 }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: 12, color: opt.selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {opt.text}
                    </span>
                  </div>
                ))}

                <div style={{ marginTop: 4, display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--bg-base)", backgroundColor: "var(--accent)", padding: "7px 18px", borderRadius: "var(--radius-sm)" }}>
                    Siguiente →
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          NOSOTROS
      ═══════════════════════════════════════════ */}
      <section id="nosotros" style={{ borderTop: "1px solid var(--border)", padding: "96px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Nosotros
            </span>
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              marginBottom: 8,
              lineHeight: 1.1,
            }}
          >
            Las mentes detrás de{" "}
            <span style={{ color: "var(--accent)" }}>ChatERP</span>
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 56, maxWidth: 560 }}>
            Un equipo de la Universidad Nacional de Ingeniería comprometido con democratizar
            la capacitación en sistemas ERP mediante inteligencia artificial.
          </p>

          {/* Carousel nav buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 20 }}>
            {(["←", "→"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() =>
                  carouselRef.current?.scrollBy({ left: dir === "←" ? -252 : 252, behavior: "smooth" })
                }
                style={{
                  width: 36, height: 36,
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                  transition: "border-color 0.15s, color 0.15s, background-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.backgroundColor = "var(--bg-surface)";
                }}
              >
                {dir}
              </button>
            ))}
          </div>

          {/* Carousel track */}
          <div style={{ position: "relative" }}>
            <div
              ref={carouselRef}
              style={{
                display: "flex",
                gap: 16,
                overflowX: "auto",
                scrollbarWidth: "none",
                scrollSnapType: "x mandatory",
                paddingBottom: 8,
              }}
            >
              {TEAM.map((m) => (
                <div
                  key={m.nombre}
                  style={{ flex: "0 0 220px", scrollSnapAlign: "start" }}
                >
                  <TeamCard miembro={m} />
                </div>
              ))}
            </div>
            {/* Edge fades */}
            <div aria-hidden style={{
              position: "absolute", left: 0, top: 0, bottom: 8, width: 40,
              background: "linear-gradient(to right, var(--bg-base), transparent)",
              pointerEvents: "none",
            }} />
            <div aria-hidden style={{
              position: "absolute", right: 0, top: 0, bottom: 8, width: 40,
              background: "linear-gradient(to left, var(--bg-base), transparent)",
              pointerEvents: "none",
            }} />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          POR QUÉ NOSOTROS
      ═══════════════════════════════════════════ */}
      <section id="por-que-nosotros" style={{ borderTop: "1px solid var(--border)", padding: "96px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Hero banner */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(74,222,128,0.07) 0%, rgba(74,222,128,0.02) 100%)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: "var(--radius-md)",
              padding: "56px 48px",
              marginBottom: 64,
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "radial-gradient(rgba(74,222,128,0.12) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }} />
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)" }}>
                  Por qué nosotros
                </span>
                <div style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }} />
              </div>
              <h2
                style={{
                  fontSize: "clamp(30px, 4.5vw, 48px)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "var(--text-primary)",
                  marginBottom: 16,
                  lineHeight: 1.1,
                }}
              >
                La plataforma ERP más accesible
                <br />
                <span style={{ color: "var(--accent)" }}>del mundo académico</span>
              </h2>
              <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 580, margin: "0 auto" }}>
                ChatERP no es un curso en video ni un manual estático. Es un asistente inteligente que
                responde en tiempo real, evalúa tu comprensión y se adapta a tu base de conocimiento.
              </p>
            </div>
          </div>

          {/* Diferenciadores */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
            <div style={{ width: 20, height: 3, backgroundColor: "var(--accent)", borderRadius: 2 }} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Diferenciadores
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1,
              backgroundColor: "var(--border)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              marginBottom: 80,
            }}
          >
            {DIFERENCIADORES.map((d) => (
              <DiferenciadoreCard key={d.titulo} item={d} />
            ))}
          </div>

          {/* ABET + UNI strip */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "40px 48px",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              gap: 40,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
              <UniBadge />
              <AbetBadge />
            </div>

            <div style={{ width: 1, height: 64, backgroundColor: "var(--border)", flexShrink: 0 }} />

            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Proyecto académico
              </p>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 8, lineHeight: 1.3 }}>
                Feria de Proyectos ABET — UNI 2026
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65 }}>
                ChatERP fue desarrollado como proyecto de la{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Universidad Nacional de Ingeniería (UNI)</span>{" "}
                para la feria de proyectos bajo el estándar{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>ABET</span>,
                cumpliendo criterios de impacto social, viabilidad técnica y pertinencia profesional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER — 4 columnas (estilo Unicode)
      ═══════════════════════════════════════════ */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "64px 48px 32px",
          backgroundColor: "var(--bg-base)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Grid 4 columnas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr",
              gap: 48,
              marginBottom: 48,
              alignItems: "flex-start",
            }}
          >
            {/* Col 1: Logo + tagline + socials */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <Image src={logoBlanco} alt="ChatERP" height={26} style={{ objectFit: "contain" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  ChatERP
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 20, maxWidth: 240 }}>
                Plataforma de capacitación conversacional en sistemas ERP basada en inteligencia artificial.
                Aprende a tu ritmo, evalúate y progresa.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { icon: <Code2 size={15} />, label: "GitHub" },
                  { icon: <Globe size={15} />, label: "LinkedIn" },
                  { icon: <Share2 size={15} />, label: "Twitter" },
                ].map((s) => (
                  <button
                    key={s.label}
                    title={s.label}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "transparent",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-strong)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text-muted)";
                    }}
                  >
                    {s.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Col 2: Navegación */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
                Navegación
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {NAV_SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    style={{ fontSize: 13, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    {s.label}
                  </button>
                ))}
                {[{ label: "Iniciar sesión", href: "/login" }, { label: "Registrarse", href: "/registro" }].map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Col 3: Nuestras Áreas */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
                Nuestras Áreas
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {FOOTER_AREAS.map((area) => (
                  <span key={area} style={{ fontSize: 13, color: "var(--text-muted)" }}>{area}</span>
                ))}
              </div>
            </div>

            {/* Col 4: Contacto */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
                Contacto
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <MapPin size={13} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
                    Universidad Nacional de Ingeniería
                    <br />
                    Av. Túpac Amaru 210, Lima, Perú
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Mail size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <a
                    href="mailto:chaterpapp@gmail.com"
                    style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    chaterpapp@gmail.com
                  </a>
                </div>
              </div>
              <a
                href="/registro"
                style={{
                  display: "inline-block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--bg-base)",
                  backgroundColor: "var(--accent)",
                  textDecoration: "none",
                  padding: "8px 18px",
                  borderRadius: "var(--radius-sm)",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
              >
                Comenzar ahora →
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              © 2026 ChatERP — Proyecto académico UNI · Feria ABET 2026
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Hecho con IA, para aprender IA.
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes landingFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(50px, -40px) scale(1.06); }
          66%       { transform: translate(-30px, 25px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40%       { transform: translate(-60px, 30px) scale(1.08); }
          70%       { transform: translate(40px, -20px) scale(0.93); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(35px, 50px) scale(1.04); }
        }
        div[style*="scrollbarWidth"] { scrollbar-width: none; }
        div[style*="scrollbarWidth"]::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
