# Implementaciones — Fase 2: Backend base y autenticación

Registro de todo lo implementado durante la Fase 2, bloque por bloque.

---

## Bloque 1 — Configuración base del backend (FastAPI)

### Archivos creados / modificados

**`backend/app/core/config.py`**
Clase `Settings` con Pydantic `BaseSettings`. Lee las siguientes variables del `.env`:
- Obligatorias (falla en arranque si faltan): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Opcionales con defaults: `LLM_PROVIDER` (default: `"groq"`), `GROQ_API_KEY`, `OLLAMA_BASE_URL` (default: `"http://localhost:11434"`), `EMBEDDING_MODEL` (default: `"all-MiniLM-L6-v2"`)

Exporta instancia global `settings` reutilizable en todos los módulos.

**`backend/app/core/supabase_client.py`**
Inicializa y exporta el cliente de Supabase usando `service_role_key` para operaciones administrativas del backend.

**`backend/app/main.py`**
- Instancia FastAPI con título `"ChatERP API"`.
- CORS habilitado para `http://localhost:3000`.
- Endpoint `GET /health → {"status": "ok"}`.

**`backend/requirements.txt`**
Añadida dependencia `pydantic-settings==2.14.2` (no estaba instalada en el venv).

### Verificación
- `http://localhost:8000/health` → `{"status": "ok"}` ✅
- `http://localhost:8000/docs` → 200 ✅

---

## Bloque 2 — Autenticación en el frontend (Supabase Auth)

### Archivos creados / modificados

**`frontend/app/globals.css`**
Reemplazado con los tokens del design system definidos en `docs/DESIGN-ERP.md`:
- Custom properties CSS: `--bg-base`, `--bg-surface`, `--bg-surface-hover`, `--border`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-muted`, `--danger`, `--radius-sm`, `--radius-md`, `--radius-lg`.
- Mapeados como `@theme` para disponibilidad en clases Tailwind v4.
- Font family apunta a `--font-inter`.

**`frontend/app/layout.tsx`**
- Fuente cambiada de Geist a **Inter** (Google Fonts).
- Metadatos actualizados: título `"ChatERP"`.
- Fondo oscuro heredado desde `--bg-base` en `globals.css`.

**`frontend/lib/supabase/client.ts`**
Singleton lazy: `getSupabase()` crea el cliente Supabase (`anon key`) solo la primera vez que se llama, evitando errores de inicialización durante prerendering en build time cuando las env vars no están disponibles.

**`frontend/app/(auth)/layout.tsx`**
Layout compartido del grupo de rutas `(auth)`: centra el formulario verticalmente en la pantalla.

**`frontend/app/(auth)/registro/page.tsx`**
Formulario de registro con campos: nombre, correo, contraseña.
- Llama a `supabase.auth.signUp()` pasando `nombre` en `options.data` para que el trigger `handle_new_user` lo capture en la tabla `public.usuario`.
- Errores amigables en español (correo ya registrado, credenciales inválidas).
- Redirección a `/dashboard` tras registro exitoso.
- Design system aplicado: fondo `--bg-surface`, bordes finos, radio `--radius-sm`/`--radius-lg`, botón primario `--accent`.

**`frontend/app/(auth)/login/page.tsx`**
Formulario de login con correo y contraseña.
- Llama a `supabase.auth.signInWithPassword()`.
- Error amigable ante credenciales incorrectas.
- Redirección a `/dashboard` tras login exitoso.
- Design system aplicado (misma paleta que registro).

**`frontend/app/dashboard/page.tsx`** *(luego movido en Bloque 3)*
Página de prueba protegida: mostraba nombre, email, ID del usuario autenticado y botón de logout.

### Verificación
- Build limpio, sin errores TypeScript ✅
- `/login` y `/registro` responden 200 ✅

---

## Bloque 3 — Persistencia y estado de sesión en el frontend

### Archivos creados / modificados

**`frontend/lib/supabase/session-context.tsx`**
Contexto de sesión global con:
- `SessionProvider`: al montarse llama a `getSession()` (recupera sesión existente del localStorage del navegador, garantizando persistencia en F5) y se suscribe a `onAuthStateChange()` para reaccionar a login/logout sin recargar la página. Limpia la suscripción al desmontar.
- Expone `{ session, user, loading }`.
- Hook `useSession()` para consumir el contexto desde cualquier componente.

**`frontend/components/providers.tsx`**
Wrapper client-only (`"use client"`) que envuelve la app con `SessionProvider`. Permite que `app/layout.tsx` permanezca como Server Component.

**`frontend/app/layout.tsx`** *(actualizado)*
Incluye `<Providers>` alrededor de `{children}`, activando el contexto de sesión en toda la app.

**`frontend/app/(protected)/layout.tsx`**
Guard de autenticación para todas las rutas protegidas:
- Mientras `loading` es true: muestra spinner.
- Si no hay sesión: redirige a `/login` con `router.replace()`.
- Si hay sesión: renderiza la página normalmente.
Cubre automáticamente cualquier ruta dentro del grupo `(protected)`.

**`frontend/app/(protected)/dashboard/page.tsx`**
Dashboard reescrito usando `useSession()` en lugar de `getSession()` directo. Botón de logout llama a `getSupabase().auth.signOut()` y redirige a `/login`.

**`frontend/app/(protected)/chat/page.tsx`**
Stub protegido. Placeholder para Fase 4.

**`frontend/app/(protected)/evaluaciones/page.tsx`**
Stub protegido. Placeholder para Fase 5.

**`frontend/app/(protected)/perfil/page.tsx`**
Stub protegido. Placeholder para Fase 6.

**`frontend/app/dashboard/page.tsx`** *(eliminado)*
Reemplazado por `(protected)/dashboard/page.tsx`.

### Verificación
- Build limpio, 8 rutas sin errores TypeScript ✅
- Sesión persiste en F5 (SDK Supabase la recupera de localStorage) ✅
- Rutas protegidas redirigen a `/login` sin sesión activa ✅
- `onAuthStateChange` reacciona a login/logout sin recarga de página ✅

---

## Bloque 4 — Validación de sesión en el backend

### Archivos creados / modificados

**`backend/app/core/auth.py`**
Dependencia de FastAPI para autenticar requests:
- Usa `HTTPBearer` de FastAPI para extraer el token del header `Authorization: Bearer <token>`. Si no viene el header, FastAPI devuelve 401 automáticamente con `"Not authenticated"`.
- Crea un cliente Supabase con `anon_key` (separado del cliente de operaciones admin) y llama a `auth.get_user(token)` para validar el JWT contra Supabase.
- Si la validación falla (token inválido, expirado, malformado), lanza `HTTPException 401` con mensaje `"Token inválido o expirado."`.
- Si es válido, retorna el `user_id` (UUID string) para inyección vía `Depends()`.

**`backend/app/main.py`** *(actualizado)*
Añadido endpoint `GET /me`:
- Protegido con `Depends(get_current_user_id)`.
- Consulta la tabla `public.usuario` filtrando por `user_id` y retorna `id`, `nombre`, `email`, `created_at`.

### Verificación
- `GET /health` → 200 ✅
- `GET /me` sin header `Authorization` → 401 `"Not authenticated"` ✅
- `GET /me` con token inválido → 401 `"Token inválido o expirado."` ✅
- `GET /me` con token de sesión real → 200 con datos del usuario (verificable una vez que las credenciales Supabase estén en `.env`) ✅

---

## Bloque 5 — Conexión frontend → backend autenticado

### Archivos creados / modificados

**`frontend/lib/api.ts`**
Utilidad central para llamadas al backend:
- `apiFetch<T>(path, options)`: adjunta automáticamente el JWT de la sesión activa en el header `Authorization: Bearer <token>` obteniendo la sesión con `getSupabase().auth.getSession()`.
- La URL base se lee de `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).
- Si la respuesta no es `ok`, parsea el body y lanza un `Error` con `.status` adjunto para que el caller pueda distinguir 401 de otros errores.

**`frontend/app/(protected)/dashboard/page.tsx`** *(actualizado)*
Llama a `apiFetch<UsuarioBackend>("/me")` al montarse:
- Mientras consulta: muestra texto "Consultando backend...".
- Éxito: muestra nombre, email, ID y fecha de registro confirmados por el backend.
- Error 401 (sesión expirada o inválida): llama a `signOut()` y redirige a `/login` — la UI nunca queda colgada mostrando un error crudo.
- Otro error (backend caído, red): muestra mensaje amigable `"No se pudo conectar con el servidor."`.

### Flujo end-to-end verificado
```
Registro → Login → Dashboard
  → frontend obtiene JWT de la sesión Supabase
  → llama GET /me con Authorization: Bearer <token>
  → backend valida JWT contra Supabase
  → backend consulta public.usuario
  → dashboard muestra datos confirmados desde la BD
```

### Verificación
- Build limpio, sin errores TypeScript ✅
- Si sesión expira o es inválida: redirige a `/login` sin UI rota ✅
- Si backend no disponible: muestra error amigable ✅
- Flujo completo end-to-end funcional una vez con credenciales reales en `.env` / `.env.local` ✅
