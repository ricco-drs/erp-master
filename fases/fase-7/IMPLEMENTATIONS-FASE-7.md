# Implementaciones — Fase 7: Endurecimiento (RNF) y pulido de UI

---

## Bloque 1 — Rendimiento (RNF-01, RNF-02, RNF-03)

### Verificaciones

**Singleton del modelo `all-MiniLM-L6-v2` (RNF-03)**

Ya implementado correctamente en `backend/app/base_conocimiento/embeddings.py`:
- `_model: SentenceTransformer | None = None` — variable global de módulo.
- `_get_model()` — crea el modelo solo si es `None`; en uvicorn el módulo se importa una vez y el objeto persiste durante toda la vida del proceso.
- `generar_embeddings()` — usa `batch_size=64` para procesar lotes de chunks en una sola pasada (evita N llamadas al modelo).
- No se detectó ningún patrón de carga por request. ✅

**Historial de chat limitado (RNF-17/costos)**

`chat/service.py` — `MAX_TURNOS_HISTORIAL = 6`: el prompt incluye `historial[-(6 * 2):]` = últimos 12 mensajes como máximo. No crece sin control en conversaciones largas. ✅

**Contexto retriever limitado (RNF-17/costos)**

`chat/retriever.py` — `construir_contexto_texto(max_chars=6000)`: corta el contexto al superar 6000 chars. El evaluador usa `max_chars=7000`. Ambos dentro de límites razonables. ✅

**Tiempos medidos en fases anteriores**

| Operación | Tiempo medido | Límite RNF |
|---|---|---|
| Chat RAG (promedio) | 2.7s | ≤ 8s (RNF-01) ✅ |
| Chat RAG (máximo) | 4.8s | ≤ 8s (RNF-01) ✅ |
| Generación evaluación 6 preguntas | ~7.2s | ≤ 15s (RNF-02) ✅ |
| Generación evaluación 8 preguntas | ~4s | ≤ 15s (RNF-02) ✅ |

No se identificaron cuellos de botella que requieran optimización.

### Mejora implementada: caché de embeddings de queries

**`backend/app/base_conocimiento/embeddings.py`** — modificado.

```python
@functools.lru_cache(maxsize=256)
def _embedding_cached(texto: str) -> tuple[float, ...]:
    vector = _get_model().encode(texto, convert_to_numpy=True)
    return tuple(vector.tolist())

def generar_embedding(texto: str) -> list[float]:
    return list(_embedding_cached(texto))
```

- `lru_cache(maxsize=256)`: hasta 256 queries distintas en memoria (≈ 256 × 384 floats ≈ 400 KB — negligible).
- Guarda como `tuple` (inmutable): cada caller recibe su propia copia `list()` — no hay riesgo de mutación compartida.
- En demo con queries repetidas (mismo usuario repregunta, o el jurado hace la misma pregunta): **0ms** en lugar de ~200-400ms de `encode()`.

### Verificación

```
Primera llamada : 3375.4 ms  (carga modelo + encode)
Segunda llamada : 0.0 ms     (cache hit)
Cache info      : hits=1 misses=1 maxsize=256
Vectores iguales: True
Objetos distintos: True (copia segura)
```
✅

---

## Bloque 2 — Seguridad (RNF-04, RNF-05, RNF-06, RNF-07, RNF-08)

### Verificaciones (sin cambios de código)

**Historial de Git — ningún secreto commiteado (RNF-05)**

`git log --all --full-history -- "**/.env"` devolvió 3 commits, todos sobre `backend/.env.example` (valores vacíos). Los archivos `backend/.env` y `frontend/.env.local` con valores reales nunca aparecen en el historial. ✅

**`service_role` solo en backend (RNF-05/06)**

`grep -r "service_role"` sobre `frontend/` → 0 resultados. Solo aparece en:
- `backend/app/core/config.py` (lectura desde variable de entorno)
- `backend/app/core/supabase_client.py` (instancia del cliente)
No está hardcodeado en ningún lado. ✅

**JWT requerido en todos los endpoints de datos (RNF-06)**

Auditados los 6 routers. Todos los endpoints que devuelven o modifican datos de usuario tienen `Depends(get_current_user_id)`. El único endpoint público es `GET /health`. ✅

**Contraseñas gestionadas por Supabase Auth (RNF-04)**

El backend nunca recibe ni almacena contraseñas. No existe ningún endpoint `/auth/login` ni `/auth/register` en el backend — el auth ocurre directamente en el cliente Supabase del frontend. ✅

**Validación de archivos en `POST /documentos` (RNF-08)**

Implementado desde Fase 3: extensión extraída de `Path(nombre).suffix` (no del `content-type` reportado por el cliente), `FORMATOS_PERMITIDOS`, `TAMANO_MAXIMO_BYTES = 10 MB`, ambos con 422 y mensaje claro. ✅

**HTTPS (RNF-07)**

Vercel (frontend) y Render/Railway (backend): TLS activo por defecto en todos los dominios. ✅

### Cambios implementados

**Filtro de prompt injection — `backend/app/chat/service.py`**

```python
_INJECTION_PATTERNS = re.compile(
    r"ignora\s+(todas\s+)?las?\s+instrucciones"
    r"|ignore\s+(all\s+)?(previous\s+)?instructions"
    r"|disregard\s+(all\s+)?previous"
    r"|you\s+are\s+now\s+(?!an?\s+ERP)"
    r"|pretend\s+(you\s+are|to\s+be)"
    r"|system\s*:\s*"
    r"|<\s*/?system\s*>",
    re.IGNORECASE,
)
```

- Ejecutado antes del retriever y del LLM — costo cero si se detecta.
- Detectado → `RespuestaChat(fuera_de_alcance=True)` con mensaje amigable, sin llamar al LLM.
- Logea `WARNING` con los primeros 120 chars del mensaje.
- Lookahead negativo evita falsos positivos en frases legítimas.

Casos verificados: 6/6 ataques detectados, 3/3 mensajes legítimos que pasan limpio. ✅

**`.gitignore` reforzado**

- `backend/.env.*` + `frontend/.env` + `frontend/.env.*` con excepciones `!*.env.example`.
- `backend/**/__pycache__/`, `*.pyc`, `.DS_Store`, `Thumbs.db`.

---

## Bloque 3 — Usabilidad (RNF-09, RNF-10, RNF-11)

### RNF-09 — Responsividad (mobile ≥ 320px, tablet ≥ 768px)

**`frontend/lib/use-breakpoint.ts`** — hook creado.

```typescript
// Breakpoints: isMobile < 768, isTablet 768-1023, isDesktop ≥ 1024
export function useBreakpoint(): Breakpoint
```

- Se inicializa como desktop (SSR-safe) y se ajusta en `useEffect` con `window.addEventListener("resize", update)`.
- Limpia el listener al desmontar. Sin dependencias externas.

**`frontend/app/(protected)/layout.tsx`** — reescrito con drawer mobile.

- Desktop (`!isMobile`): `<Sidebar />` en fila flex como antes.
- Mobile: topbar sticky con botón hamburger (`<Menu size={18} />`) + overlay backdrop (`rgba(0,0,0,0.6)`, `zIndex:40`) + sidebar como drawer (`position:fixed, left:0, zIndex:50`).
- `useEffect` cierra el drawer al cambiar de mobile a desktop.
- `<Sidebar onClose={() => setSidebarOpen(false)} />` — el sidebar cierra el drawer tras navegar.

**`frontend/components/sidebar.tsx`** — prop `onClose?: () => void` añadida.

- Llamada en los `onClick` de `NavItem` y `NAV_CUENTA` después de `router.push(href)`.

**`frontend/app/(protected)/documentos/page.tsx`** — tabla responsive.

```typescript
const cols = isMobile
  ? "1fr 40px"                         // solo nombre + eliminar
  : isTablet
  ? "1fr 100px 110px 40px"             // + visibilidad + estado
  : "1fr 160px 100px 110px 90px 40px"; // + tema + fecha (desktop completo)

const headers = isMobile
  ? ["Archivo", ""]
  : isTablet
  ? ["Archivo", "Visibilidad", "Estado", ""]
  : ["Archivo", "Tema", "Visibilidad", "Estado", "Subido", ""];
```

- Cabecera y `DocRow` usan `cols` variable (mismo valor → alineación garantizada).
- `DocRow` recibe `cols`, `isMobile`, `isTablet` como props y oculta columnas condicionalmente con `{!isMobile && ...}` / `{!isMobile && !isTablet && ...}`.
- Padding: `isMobile ? "24px 16px" : "40px 48px"`.

**`frontend/app/(protected)/perfil/page.tsx`** — grid de stats y padding responsive.

- Stats grid: `isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)"` — en mobile muestra 2 × 2 en lugar de desbordarse.
- Padding outer: `isMobile ? "24px 16px" : "40px 48px"`.

### RNF-10 — Mensajes de error inline (sin `alert()`)

**`frontend/app/(protected)/documentos/page.tsx`**

- Reemplazado `alert("No se pudo eliminar...")` por estado `errorEliminar: string | null`.
- Mostrado como `<p style={{ color: "var(--danger)" }}>` justo antes de la tabla.
- Se limpia en cada intento de eliminación (`setErrorEliminar(null)`). ✅

### RNF-11 — Estados de carga visibles

Auditados todos los componentes de datos:

| Página | Estado cargando |
|---|---|
| `documentos` | `"Cargando..."` en celda de tabla con `cargando` state ✅ |
| `perfil` | Spinner centrado "Cargando perfil…" mientras `cargando` ✅ |
| `evaluaciones` | Loading state con mensaje "Cargando evaluaciones…" ✅ |
| `chat` | Burbuja de typing durante streaming ✅ |
| `dashboard` | Stats con `—` mientras cargan ✅ |

Ningún componente muestra datos vacíos sin indicación de estado. ✅

---

## Bloque 4 — Disponibilidad y resiliencia (RNF-12, RNF-13, RNF-14)

### RNF-12 — Groq caído: reintentos y mensaje claro al usuario

**Flujo ya implementado desde Fase 4 (sin cambios en este bloque):**

```
LLMError (timeout)
  └─ llm_provider.py: MAX_REINTENTOS = 2, backoff exponencial (2s, 4s)
       └─ tras 3 intentos fallidos → LLMError con mensaje claro
            └─ chat/router.py: except LLMError → HTTP 503 con detail
                 └─ apiFetch: throws Error(detail)
                      └─ chat/[sesionId]/page.tsx: catch → setErrorEnvio(msg) → inline en UI
```

- Rate-limit 429 → no reintenta (cuota agotada, no un fallo transitorio).
- Auth 401 → no reintenta (clave inválida, no transitorio).
- Timeout → reintenta hasta `MAX_REINTENTOS`. ✅

### RNF-13 — Supabase caído: respuesta degradada sin crash

**Retriever (`chat/retriever.py`) — ya implementado:**

```python
try:
    resp = supabase.rpc("match_chunks", ...).execute()
except Exception as e:
    logger.error("Error en búsqueda vectorial: %s", e)
    return []  # → service.py interpreta como fuera_de_alcance=True
```

Si Supabase cae durante una consulta vectorial, el chat responde con el mensaje de "sin contexto" en lugar de crashear. ✅

**Global exception handler — `backend/app/main.py`** — añadido:

```python
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Error no manejado en %s %s: %r", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "El servicio no está disponible en este momento. Intentá de nuevo en unos segundos."},
    )
```

Cualquier excepción no capturada (p.ej. llamada a Supabase en endpoints de perfil, documentos, evaluaciones) devuelve HTTP 503 con mensaje legible en lugar de HTTP 500 con stack trace. El frontend ya convierte el `detail` en mensaje de error inline. ✅

### RNF-14 — Reinicio del backend: recuperación sin estado remanente

**Verificaciones sin cambios de código:**

| Componente | Comportamiento ante restart |
|---|---|
| `supabase` client | Singleton de módulo — se recrea limpio en cada inicio del proceso. ✅ |
| Modelo `all-MiniLM-L6-v2` | `_model = None` al inicio; se carga en la primera request (`_get_model()`). ✅ |
| Cache LRU de embeddings | Se vacía al reiniciar (caché en memoria RAM del proceso). Correcto — no hay estado incoherente. ✅ |
| JWT auth | Sin sesión en servidor — token validado en cada request. ✅ |
| Historial de chat | Persistido en Supabase — el frontend recarga con `GET /sesiones/{id}/mensajes`. ✅ |

El backend es stateless: cualquier instancia nueva puede atender cualquier request. ✅

### Escenario: frontend con backend inaccesible (backend caído / reiniciando)

`fetch()` lanza `TypeError: Failed to fetch` (error de red).
- `apiFetch` propaga el error tal cual.
- Todos los `catch` en las páginas capturan el error y muestran mensaje inline.
- El usuario ve "No se pudo cargar..." y puede reintentar manualmente. ✅
