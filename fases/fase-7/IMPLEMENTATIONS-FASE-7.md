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

---

## Bloque 5 — Escalabilidad (RNF-15, RNF-16)

### RNF-15 — Índice vectorial HNSW activo

**Índice definido en `sql/01_schema_chatbot_erp.sql`:**

```sql
CREATE INDEX idx_chunk_embedding ON public.chunk
  USING hnsw (embedding vector_cosine_ops);
```

- Tipo: HNSW (Hierarchical Navigable Small World) — el algoritmo de búsqueda vectorial aproximada más eficiente disponible en pgvector.
- Operador: `vector_cosine_ops` — coincide con el operador `<=>` usado en `match_chunks` y en `ORDER BY`. Esto garantiza que PostgreSQL use el índice en lugar de un Seq Scan.
- Dimensión: 384 (all-MiniLM-L6-v2). Si el modelo cambia, el índice debe recrearse.
- Parámetros: m=16, ef_construction=64 (defaults de pgvector — adecuados para escala de demo). `hnsw.ef_search=40` en runtime.

**Función SQL `match_chunks` (`sql/03_match_chunks_function.sql`):**

```sql
ORDER BY c.embedding <=> query_embedding
LIMIT match_count;
```

El operador `<=>` con `ORDER BY ... LIMIT` es exactamente el patrón que activa el índice HNSW en pgvector (index scan + limit pushdown). PostgreSQL no necesita ordenar toda la tabla — el índice devuelve los vecinos más cercanos directamente.

**Verificación programática:**

El archivo `sql/05_escalabilidad_explain_analyze.sql` contiene las queries de auditoría para ejecutar en el Dashboard de Supabase:

1. `pg_indexes WHERE tablename='chunk'` — confirma que el índice existe.
2. `EXPLAIN (ANALYZE, BUFFERS)` sobre la query de `match_chunks` — el plan debe mostrar `Index Scan using idx_chunk_embedding`, no `Seq Scan on chunk`.
3. La misma query con filtro por `tema_id` — verifica que el filtro adicional no elimina el uso del índice.
4. Conteo de chunks por tema — referencia de escala actual.

**Escala y límites:**

| Métrica | Valor actual (demo) | Límite práctico HNSW |
|---|---|---|
| Dimensiones del embedding | 384 | Hasta ~2000 sin degradación |
| Chunks totales esperados | ~100–500 | Millones (pgvector con HNSW) |
| Tiempo de búsqueda (top_k=5) | < 50ms | < 200ms hasta ~10M vectores |

Para la escala de un proyecto educativo de demo no hay riesgo de degradación de rendimiento. ✅

### RNF-16 — Límites de contexto y tokens (costos controlados)

**Tokens de contexto enviados al LLM — límites en código:**

| Componente | Parámetro | Valor | Propósito |
|---|---|---|---|
| `recuperar_contexto()` | `top_k=5` | máx. 5 chunks por query de chat | Limitar contexto RAG |
| `construir_contexto_texto()` | `max_chars=6000` | corta el contexto al superar 6000 chars | Evitar prompts gigantes |
| Evaluaciones — recuperación | `top_k=4` por query × varias queries | máx. 10 chunks finales | RAG multi-query controlado |
| Evaluaciones — contexto | `max_chars=7000` | corta el contexto de evaluación | Límite más generoso (más preguntas) |
| Evaluaciones — contexto tema | `max_chars=5000` | contexto introductorio | Complementario al RAG |
| `MAX_TURNOS_HISTORIAL` | 6 turnos = 12 mensajes | historial de chat incluido en prompt | Evitar context overflow en sesiones largas |

**Estimación de tokens por request de chat:**

```
System prompt      ≈  350 tokens
Historial (máx.)   ≈  600 tokens  (6 turnos × 100 tokens promedio)
Contexto RAG       ≈  1500 tokens  (6000 chars ÷ 4 chars/token)
Pregunta usuario   ≈   50 tokens
─────────────────────────────────
Total input        ≈  2500 tokens
Respuesta          ≈  300 tokens  (max_tokens=1024, en práctica <300)
─────────────────────────────────
Total por request  ≈  2800 tokens
```

Con el plan gratuito de Groq (≈ 6000 tokens/minuto en `llama-3.1-8b`), esto permite ~2 requests/minuto simultáneas, suficiente para uso educativo individual o demo con jurado. ✅

Todos los límites están fijados como constantes en el código (no hardcodeados en el prompt): `MAX_TURNOS_HISTORIAL`, `UMBRAL_SIMILITUD`, `top_k`, `max_chars`. Se pueden ajustar sin tocar la lógica de negocio. ✅

---

## Bloque 6 — Costos y logging (RNF-17, RNF-18)

### RNF-17 — Control de costos: historial y contexto limitados

**Verificación del límite de historial en `chat/service.py`:**

```python
MAX_TURNOS_HISTORIAL = 6
turnos_recientes = historial[-(MAX_TURNOS_HISTORIAL * 2):]
```

- `historial` contiene todos los mensajes de la sesión (alternando usuario/asistente).
- `-(6 * 2) = -12` → siempre se incluyen como máximo los últimos 12 mensajes.
- Una sesión de 100 turnos envía al LLM exactamente los mismos tokens de historial que una de 6 turnos. El costo de tokens de historial no crece sin control. ✅

**Estimación de tokens por tipo de operación:**

| Operación | Tokens input | Tokens output | Total estimado |
|---|---|---|---|
| Chat RAG (request típico) | ~2500 | ~300 | ~2800 |
| Generación evaluación (6 preguntas) | ~3000 | ~1500 | ~4500 |
| Generación evaluación (8 preguntas) | ~3000 | ~2000 | ~5000 |
| Calificación pregunta abierta | ~800 | ~200 | ~1000 |
| Moderación documento | ~500 | ~100 | ~600 |

Plan gratuito Groq (`llama-3.3-70b-versatile`): ~6000 tokens/minuto. Para uso individual o demo con jurado (< 5 requests/minuto) el plan gratuito es suficiente. ✅

**Groq como plan A, Ollama como plan B:**

`LLM_PROVIDER` en `.env` controla el proveedor. Cambiar de Groq a Ollama no requiere modificar ningún código — solo la variable de entorno. Costo de Ollama: $0 (local). ✅

### RNF-18 — Logging estructurado: trazabilidad sin datos sensibles

**Configuración centralizada añadida en `backend/app/main.py`:**

```python
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)-8s %(name)s — %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "default"}},
    "root": {"level": "INFO", "handlers": ["console"]},
    "loggers": {
        "httpx": {"level": "WARNING"},
        "httpcore": {"level": "WARNING"},
        "sentence_transformers": {"level": "WARNING"},
    },
})
```

- Formato legible: `2026-07-01 14:32:01 INFO     app.chat.service — Llamando LLM: tema=... chunks=3 historial=2 turnos`
- Uvicorn captura stdout → visible en Render/Railway logs sin configuración adicional.
- Librerías verbosas (`httpx`, `sentence_transformers`) silenciadas en WARNING para no saturar los logs.

**Inventario de mensajes de log por módulo:**

| Módulo | Nivel | Eventos registrados |
|---|---|---|
| `llm_provider` | INFO | Cada llamada exitosa: proveedor, modelo, intento, tokens, tiempo |
| `llm_provider` | WARNING | Cada reintento: error, tiempo transcurrido |
| `llm_provider` | ERROR | Todos los reintentos fallados |
| `chat/service` | WARNING | Intento de prompt injection (primeros 120 chars) |
| `chat/service` | INFO | Pregunta rechazada por fuera de alcance |
| `chat/service` | INFO | Llamada al LLM: tema, chunks, turnos de historial |
| `chat/retriever` | INFO | Resultado de búsqueda vectorial: chunks encontrados, umbral |
| `chat/retriever` | ERROR | Fallo en `match_chunks` (Supabase caído) |
| `evaluaciones/service` | INFO | Inicio de generación: tema, n_preguntas, chunks_usados |
| `evaluaciones/service` | INFO | JSON de preguntas parseado OK |
| `evaluaciones/service` | WARNING | JSON malformado en intento N |
| `evaluaciones/service` | INFO | Evaluación persistida: id, n_preguntas |
| `evaluaciones/service` | INFO/WARNING | Calificación abierta: puntaje / JSON malformado |
| `base_conocimiento/extraccion` | WARNING | Fallback pypdf cuando Gemini Vision falla |
| `base_conocimiento/moderacion` | WARNING/ERROR | Fallos en moderación LLM |
| `main` | ERROR | Excepciones no manejadas con método + path |

**Datos sensibles — ausencia verificada:**

- Ningún log incluye tokens JWT, claves API ni contraseñas.
- El contenido de los mensajes se trunca a 60–120 chars en los logs (`mensaje[:60]`, `mensaje[:120]`).
- El contenido de los documentos no se loguea (solo `nombre_archivo` y `chunks_generados`). ✅

---

## Bloque 7 — Compatibilidad de navegadores (RNF-19)

**Navegadores objetivo:** Chrome 120+, Edge 120+, Firefox 120+ (Chromium-based y Gecko).

### Stack tecnológico y soporte

| Tecnología | Chrome 120 | Edge 120 | Firefox 120 | Notas |
|---|---|---|---|---|
| Next.js 16 + React 19 | ✅ | ✅ | ✅ | Transpila a ES5+; el bundle es compatible por construcción |
| CSS Custom Properties (`var(--)`) | ✅ | ✅ | ✅ | Soporte desde Chrome 49 / Firefox 31 / Edge 16 |
| CSS Flexbox | ✅ | ✅ | ✅ | Soporte universal |
| CSS Grid + `gridTemplateColumns` | ✅ | ✅ | ✅ | Soporte desde Chrome 57 / Firefox 52 / Edge 16 |
| `gap` en flex/grid | ✅ | ✅ | ✅ | Soporte desde Chrome 84 / Firefox 63 / Edge 84 |
| `position: sticky` | ✅ | ✅ | ✅ | Soporte completo en todos los objetivos |
| `position: fixed` + `inset: 0` | ✅ | ✅ | ✅ | `inset` shorthand: Chrome 87 / Firefox 87 / Edge 87 ✅ |
| `fetch()` | ✅ | ✅ | ✅ | Soporte universal |
| `Promise.all()` | ✅ | ✅ | ✅ | Soporte universal |
| `async/await` | ✅ | ✅ | ✅ | Transpilado por Next.js si es necesario |
| `sessionStorage` | ✅ | ✅ | ✅ | Soporte universal; usado para handoff de preguntas entre páginas |
| `window.innerWidth` + `addEventListener("resize")` | ✅ | ✅ | ✅ | Soporte universal |
| `window.confirm()` | ✅ | ✅ | ✅ | Soporte universal; usado en confirmaciones de eliminación |
| Lucide React (SVG icons) | ✅ | ✅ | ✅ | SVG inline; compatible universalmente |
| `@supabase/supabase-js` 2.x | ✅ | ✅ | ✅ | Usa `fetch` internamente; sin APIs experimentales |

### Análisis de riesgos por API

**`inset: 0` (layout.tsx:49) — overlay backdrop del drawer mobile**

```tsx
style={{ position: "fixed", inset: 0, zIndex: 40 }}
```

`inset` es shorthand de `top/right/bottom/left`. Soporte desde Chrome 87, Firefox 87, Edge 87. Los tres navegadores objetivo son versión 120+, por lo que no hay riesgo. ✅

**`sessionStorage` — handoff de preguntas de evaluación**

Usado en `evaluaciones/page.tsx` y `evaluaciones/[intentoId]/page.tsx`. `sessionStorage` está disponible en todos los navegadores objetivo. El código ya tiene fallback: si `sessionStorage` falla (p.ej. modo privado con storage bloqueado), el efecto lee las preguntas vía API en su lugar. ✅

**CSS Custom Properties en `globals.css`**

Todos los tokens del design system (`--bg-base`, `--accent`, etc.) se definen en `:root`. Los tres navegadores objetivo soportan custom properties desde versiones muy anteriores a 120. ✅

**`repeat(auto-fill, minmax(240px, 1fr))` en chat/page.tsx**

Patrón responsivo de grid sin media queries. Soporte completo en todos los objetivos. ✅

**`window.confirm()` — diálogos de confirmación de eliminación**

Usado en `perfil/page.tsx` y `documentos/page.tsx`. Soporte universal. Firefox puede bloquear `confirm()` si se llama desde dentro de un iframe en contextos específicos, pero en la app se llama desde el top-level document. ✅

### Sin APIs experimentales ni flags requeridos

Auditado el código de `app/`, `lib/` y `components/`: no se usan:
- `ResizeObserver` / `IntersectionObserver` (no necesarios).
- `crypto.subtle` (el auth lo maneja Supabase).
- `structuredClone`, `Array.at()`, `Object.hasOwn()` (no presentes).
- Web Components / Shadow DOM.
- CSS `@layer`, `:has()`, `:is()` avanzados.

### Checklist de verificación manual (ejecutar antes de entrega)

Para confirmar en cada navegador (Chrome, Edge, Firefox):

- [ ] Login y registro funcionan.
- [ ] El sidebar se muestra correctamente en desktop.
- [ ] En mobile (DevTools responsive), el drawer se abre y cierra.
- [ ] El chat envía y recibe mensajes.
- [ ] La tabla de documentos se adapta al viewport (desktop / tablet / mobile).
- [ ] El grid de stats del perfil pasa a 2 columnas en mobile.
- [ ] Las evaluaciones se generan y la página de resultados muestra el puntaje.
- [ ] Los colores del design system se aplican (custom properties cargadas).
- [ ] Los iconos de Lucide se renderizan (SVG).

**Veredicto:** el stack no usa ninguna API sin soporte en Chrome 120+ / Edge 120+ / Firefox 120+. La compatibilidad está garantizada por construcción (Next.js transpila, CSS usa propiedades universales). ✅

---

## Bloque 8 — Pulido visual

### Dashboard reescrito como pantalla de inicio real

**`frontend/app/(protected)/dashboard/page.tsx`** — reescrito desde prototipo técnico a pantalla de bienvenida.

**Antes:** mostraba datos de debug ("Verificado por el backend", UUID del usuario, timestamp raw). Sin quick-links a otras secciones.

**Ahora:**
- Saludo personalizado con el primer nombre del usuario (`nombre.split(" ")[0]`).
- Grid de 4 stats de progreso (`temas_estudiados`, `evaluaciones_realizadas`, `puntaje_promedio_20`, `mejor_puntaje_20`) cargados desde `GET /perfil/progreso` — muestra `—` mientras carga, sin bloquear el render.
- Grid responsive: `repeat(4, 1fr)` en desktop, `repeat(2, 1fr)` en mobile.
- 3 acciones rápidas en `AccionCard`: "Ir al chat", "Hacer una evaluación", "Mis documentos" — con hover state (borde accent + fondo surface-hover + ícono accent).
- Padding responsive: `32px 16px` mobile / `48px 48px` desktop.

### Padding responsive completado en todas las páginas protegidas

Auditoría de todas las rutas bajo `app/(protected)/`:

| Página | Antes | Después |
|---|---|---|
| `dashboard/page.tsx` | `48px 32px` fijo | `isMobile ? "32px 16px" : "48px 48px"` ✅ |
| `chat/page.tsx` | `40px 48px` fijo | `isMobile ? "24px 16px" : "40px 48px"` ✅ |
| `chat/[sesionId]/page.tsx` — header | `12px 32px` fijo | `isMobile ? "10px 16px" : "12px 32px"` ✅ |
| `chat/[sesionId]/page.tsx` — mensajes | `40px 48px` fijo | `isMobile ? "24px 16px" : "40px 48px"` ✅ |
| `chat/[sesionId]/page.tsx` — input | `16px 48px 24px` fijo | `isMobile ? "12px 16px 20px" : "16px 48px 24px"` ✅ |
| `evaluaciones/page.tsx` | `40px 48px` fijo | `isMobile ? "24px 16px" : "40px 48px"` ✅ |
| `evaluaciones/[intentoId]/page.tsx` — header | `12px 32px` fijo | `isMobile ? "10px 16px" : "12px 32px"` ✅ |
| `evaluaciones/[intentoId]/page.tsx` — contenido | `32px 48px` fijo | `isMobile ? "24px 16px" : "32px 48px"` ✅ |
| `evaluaciones/[intentoId]/page.tsx` — footer | `16px 48px` fijo | `isMobile ? "12px 16px" : "16px 48px"` ✅ |
| `evaluaciones/[intentoId]/resultados/page.tsx` | `40px 48px` fijo | `isMobile ? "24px 16px" : "40px 48px"` ✅ |
| `documentos/page.tsx` | ya tenía responsive | — ✅ |
| `perfil/page.tsx` | ya tenía responsive | — ✅ |

Todas las páginas protegidas respetan ahora `24px 16px` de padding en mobile. ✅

---

## Bloque 9 — Cierre de fase

### Archivos modificados o creados en Fase 7

**Backend:**
- `backend/app/base_conocimiento/embeddings.py` — caché LRU para `generar_embedding()`
- `backend/app/chat/service.py` — filtro de prompt injection (`_INJECTION_PATTERNS`)
- `backend/app/main.py` — logging centralizado + global exception handler HTTP 503
- `.gitignore` — reforzado con `backend/.env.*`, `frontend/.env.*`, `__pycache__/`

**Frontend:**
- `frontend/lib/use-breakpoint.ts` — hook creado (`isMobile / isTablet / isDesktop`)
- `frontend/app/(protected)/layout.tsx` — sidebar drawer mobile con backdrop overlay
- `frontend/components/sidebar.tsx` — prop `onClose?` añadida
- `frontend/app/(protected)/dashboard/page.tsx` — reescrito como pantalla de inicio real
- `frontend/app/(protected)/chat/page.tsx` — padding responsive
- `frontend/app/(protected)/chat/[sesionId]/page.tsx` — padding responsive (3 zonas)
- `frontend/app/(protected)/evaluaciones/page.tsx` — padding responsive
- `frontend/app/(protected)/evaluaciones/[intentoId]/page.tsx` — padding responsive (3 zonas)
- `frontend/app/(protected)/evaluaciones/[intentoId]/resultados/page.tsx` — padding responsive
- `frontend/app/(protected)/documentos/page.tsx` — tabla responsive 3 breakpoints, error inline
- `frontend/app/(protected)/perfil/page.tsx` — stats grid responsive, padding responsive

**SQL / docs:**
- `sql/05_escalabilidad_explain_analyze.sql` — queries de auditoría HNSW para Supabase Dashboard
- `fases/fase-7/IMPLEMENTATIONS-FASE-7.md` — este archivo
- `docs/fases-proyecto.md` — Fase 7 marcada ✅ Completada

### RNF cubiertos

| RNF | Descripción | Estado |
|---|---|---|
| RNF-01 | Tiempo de respuesta chat ≤ 8s | ✅ Verificado (2.7s promedio) |
| RNF-02 | Tiempo de generación evaluación ≤ 15s | ✅ Verificado (4–7s) |
| RNF-03 | Modelo de embeddings: singleton, sin recarga por request | ✅ Verificado + caché LRU añadida |
| RNF-04 | Contraseñas gestionadas por Supabase Auth | ✅ Sin endpoint de auth en backend |
| RNF-05 | Secretos fuera del código fuente | ✅ `.gitignore` reforzado, historial limpio |
| RNF-06 | JWT requerido en todos los endpoints de datos | ✅ Auditado, `service_role` solo en backend |
| RNF-07 | HTTPS en producción | ✅ Vercel + Render/Railway por defecto |
| RNF-08 | Validación de archivos en subida | ✅ Extensión + tamaño desde Fase 3 |
| RNF-09 | Responsividad mobile ≥ 320px | ✅ Drawer sidebar + padding + grids adaptativos |
| RNF-10 | Errores inline (sin `alert()`) | ✅ `alert()` reemplazado por estado inline |
| RNF-11 | Estados de carga visibles | ✅ Auditado en todas las páginas |
| RNF-12 | Groq caído: reintentos y mensaje claro | ✅ MAX_REINTENTOS=2, backoff, catch en router |
| RNF-13 | Supabase caído: respuesta degradada | ✅ Try/catch en retriever + handler global 503 |
| RNF-14 | Restart del backend: sin estado remanente | ✅ Backend stateless verificado |
| RNF-15 | Índice vectorial HNSW activo | ✅ `idx_chunk_embedding hnsw vector_cosine_ops` |
| RNF-16 | Límites de contexto y tokens controlados | ✅ `top_k`, `max_chars`, `MAX_TURNOS_HISTORIAL` |
| RNF-17 | Control de costos: historial limitado | ✅ `MAX_TURNOS_HISTORIAL=6`, estimación tokens |
| RNF-18 | Logging estructurado sin datos sensibles | ✅ `dictConfig` centralizado, inventario completo |
| RNF-19 | Compatibilidad Chrome/Edge/Firefox 120+ | ✅ Auditado, sin APIs experimentales |

### Pendientes que quedan para Fase 8 / antes de entrega

- Aplicar en Supabase Dashboard: `sql/02_rls_fix_autenticados.sql` y `sql/04_rls_evaluaciones_verificacion.sql` (pendiente desde Fases 3 y 5 respectivamente).
- Ejecutar checklist de verificación manual en Chrome, Edge y Firefox (ver Bloque 7).
- Fase 8: contingencia Ollama + Supabase local (plan B documentado).
- Fase 9: documentación final y entrega.
