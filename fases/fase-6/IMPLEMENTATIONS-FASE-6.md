# Implementaciones — Fase 6: Perfil y seguimiento de progreso

---

## Bloque 1 — Endpoints de perfil y progreso

### Archivos creados

**`backend/app/perfil/__init__.py`** *(nuevo módulo)*

**`backend/app/perfil/router.py`** *(nuevo)*

7 endpoints, todos JWT-protegidos con `Depends(get_current_user_id)`:

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/perfil`                        | Datos del usuario autenticado |
| `PATCH`  | `/perfil`                        | Actualizar nombre (único campo editable) |
| `GET`    | `/perfil/progreso`               | Resumen de actividad (temas, evaluaciones, puntajes) |
| `GET`    | `/perfil/sesiones`               | Historial de sesiones de chat con nombre de tema |
| `GET`    | `/perfil/evaluaciones`           | Historial de intentos completados con puntaje 0-20 |
| `GET`    | `/perfil/documentos`             | Documentos propios del usuario |
| `DELETE` | `/perfil/documentos/{id}`        | Eliminar documento propio (BD + Storage) |

**`backend/app/main.py`** — `perfil_router` registrado.

#### Decisiones de diseño

- `PATCH /perfil`: solo permite cambiar `nombre` — correo y rol no son editables desde el cliente. Validación de nombre vacío con 422.
- `GET /perfil/progreso`: calcula todo en Python sobre datos de Supabase (sin RPCs SQL). Join `sesion_chat → tema`, join `intento_evaluacion → evaluacion → tema`. `puntaje_total` interno (0-1) se convierte a escala /20 en el servicio.
- `GET /perfil/evaluaciones`: filtra `completado_en IS NOT NULL` — solo intentos terminados. `aprobado` recalculado en servidor con umbral 11/20 (igual que en evaluaciones/router).
- `DELETE /perfil/documentos/{id}`: elimina chunks explícitamente + registro en `documento` + archivo en Storage `"documentos"` bucket. Misma lógica que `DELETE /documentos/{id}` en base_conocimiento/router (no duplica el endpoint existente — este filtra solo documentos propios del usuario).
- Todos los queries filtran por `user_id` explícitamente (backend usa service_role que ignora RLS).

### Verificación

7 endpoints confirmados en OpenAPI spec (`GET /openapi.json`):
- `GET /perfil` ✅
- `PATCH /perfil` ✅
- `GET /perfil/progreso` ✅
- `GET /perfil/sesiones` ✅
- `GET /perfil/evaluaciones` ✅
- `GET /perfil/documentos` ✅
- `DELETE /perfil/documentos/{documento_id}` ✅

---

## Bloque 2 — Frontend: pantalla de perfil

### Archivo modificado

**`frontend/app/(protected)/perfil/page.tsx`** *(reescrito desde placeholder)*

#### Estructura de la página

Todas las secciones bajo `/perfil`, separadas por divisores de `1px`, en columna central de `maxWidth: 760px`.

**Sección: Mi cuenta (`SeccionPerfil`)**
- Tarjeta con borde fino, 3 campos: nombre, correo y fecha de registro.
- Edición de nombre inline: botón lápiz (`Pencil`) abre un `<input>` en el mismo lugar con botones check/X flotando a la derecha. Enter confirma, Escape cancela. `PATCH /perfil` en `guardando` state; error inline bajo el campo.
- Correo y fecha solo lectura (no editables desde el cliente).

**Sección: Resumen de actividad (`SeccionProgreso`)**
- Grid de 4 cards estilo hackO.dev: número grande 28px + label 11px uppercase + sub-texto opcional.
- Stats: Temas estudiados / Evaluaciones realizadas / Puntaje promedio /20 / Mejor puntaje /20 (con nombre del tema).
- Valores `null` muestran "—".

**Sección: Historial de conversaciones (`SeccionSesiones`)**
- Lista compacta tipo Vercel (borde único exterior, filas separadas por `1px`).
- Cada fila: icono `MessageSquare` + nombre del tema + fecha alineada a la derecha.
- Clickeable → `router.push(/chat/${id})`.
- Estado vacío: icono + texto en `--text-muted` + CTA "Ir al chat" en `--accent`.

**Sección: Historial de evaluaciones (`SeccionEvaluaciones`)**
- Misma lista compacta: `CheckCircle`/`XCircle` en `--accent`/`--danger` + nombre del tema + puntaje /20 en color reactivo + fecha.
- Clickeable → `router.push(/evaluaciones/${intento_id}/resultados)`.
- Estado vacío con CTA "Hacer una evaluación".

**Sección: Mis documentos (`SeccionDocumentos`)**
- Lista con badges de formato (uppercase muted), badge de estado con colores del design system (aprobado=accent/rechazado=danger/pendiente=muted) y fecha.
- Botón eliminar (`Trash2`) con hover rojo + confirmación `window.confirm` + spinner inline mientras elimina. Eliminación optimista: quita la fila del estado local sin recargar.
- Motivo de rechazo mostrado inline bajo la fila cuando `estado_moderacion === "rechazado"`.
- Estado vacío con CTA "Subir un documento".

#### Estados vacíos (`EmptyState`)

Componente compartido: borde dashed + icono 50% opacidad + texto en `--text-muted` + botón CTA en `--accent`. Tres instancias: sin sesiones / sin evaluaciones / sin documentos.

#### Carga de datos

`Promise.all` de 5 llamadas paralelas en `useEffect`: `/perfil`, `/perfil/progreso`, `/perfil/sesiones`, `/perfil/evaluaciones`, `/perfil/documentos`. Estado de `cargando` global con texto centrado; `error` con ícono `AlertCircle`.

### Verificación

TypeScript: `npx tsc --noEmit` sin errores en el archivo ✅

---

## Bloque 3 — Navegación global (sidebar)

### Archivo modificado

**`frontend/components/sidebar.tsx`**

#### Cambios aplicados

**Reestructura del nav:**
- `NAV_MAIN`: Inicio (`/dashboard`), Chat, Evaluaciones, Documentos — orden lógico de uso.
- `NAV_CUENTA`: solo Perfil (Dashboard movido a principal, sección "Cuenta" queda limpia con un solo item).

**Borde izquierdo en item activo:**
- `NavItem` ahora tiene `borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent"` — el ítem activo muestra la línea verde característica del design system.
- `padding` ajustado a `7px 8px 7px 6px` para compensar el borde sin desplazar el texto.
- Transición suave: `transition: "background-color 0.1s, color 0.1s, border-color 0.1s"`.

**Nombre del usuario en footer:**
- Muestra `user?.user_metadata?.nombre` (establecido en el registro) con fallback a `user?.email`.
- Debajo, el correo en texto pequeño (`--text-muted`, 11px).
- El nombre va en `--text-secondary` 13px peso 500 — más prominente que el correo.

#### Lo que ya estaba correcto (sin cambios)

- `active` calculado con `pathname === href || pathname.startsWith(href + "/")` — activa correctamente en subrutas.
- `Sidebar` presente en todas las rutas protegidas vía `(protected)/layout.tsx`.
- `LogOut` visible siempre en el footer.
- Brand "ChatERP" con barra verde en el header del sidebar.

### Verificación

TypeScript: `npx tsc --noEmit` sin errores ✅
