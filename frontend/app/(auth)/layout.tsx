import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 16px 40px",
        position: "relative",
      }}
    >
      {/* Back to landing */}
      <Link
        href="/"
        className="auth-back"
        style={{
          position: "fixed",
          top: 20,
          left: 24,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--text-secondary)",
          textDecoration: "none",
          padding: "6px 14px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface)",
          backdropFilter: "blur(8px)",
          zIndex: 20,
          transition: "color 0.15s, border-color 0.15s",
        }}
      >
        ← Inicio
      </Link>

      {/* Ambient glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(74,222,128,0.045) 0%, transparent 70%)",
        }}
      />

      {/* Dot grid */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.35,
        }}
      />

      <style>{`
        .auth-back:hover {
          color: var(--text-primary) !important;
          border-color: var(--border-strong) !important;
          background-color: var(--bg-surface-hover) !important;
        }
      `}</style>

      {children}
    </div>
  );
}
