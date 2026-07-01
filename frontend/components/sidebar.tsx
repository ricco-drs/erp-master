"use client";

import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, FileText, ClipboardList, LayoutDashboard, User, LogOut } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/session-context";

const NAV_MAIN = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/evaluaciones", label: "Evaluaciones", icon: ClipboardList },
  { href: "/documentos", label: "Documentos", icon: FileText },
];

const NAV_CUENTA = [
  { href: "/perfil", label: "Perfil", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <aside
      style={{
        width: "220px",
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      {/* Brand */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "18px",
              backgroundColor: "var(--accent)",
              borderRadius: "2px",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            ChatERP
          </span>
        </div>
      </div>

      {/* Nav principal */}
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
        {NAV_MAIN.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={<Icon size={15} />}
              active={active}
              onClick={() => router.push(href)}
            />
          );
        })}

        <div
          style={{
            marginTop: "16px",
            marginBottom: "4px",
            paddingLeft: "8px",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            textTransform: "uppercase",
          }}
        >
          Cuenta
        </div>

        {NAV_CUENTA.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={<Icon size={15} />}
              active={active}
              onClick={() => router.push(href)}
            />
          );
        })}
      </nav>

      {/* Footer: user + logout */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: "2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {(user?.user_metadata?.nombre as string | undefined) ?? user?.email}
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginBottom: "10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user?.email}
        </p>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0",
          }}
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "100%",
        padding: "7px 8px 7px 6px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: active ? 500 : 400,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        backgroundColor: active ? "var(--bg-surface-hover)" : "transparent",
        textAlign: "left",
        transition: "background-color 0.1s, color 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-surface-hover)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
        }
      }}
    >
      <span style={{ color: active ? "var(--accent)" : "inherit", display: "flex" }}>{icon}</span>
      {label}
    </button>
  );
}
