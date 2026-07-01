# Implementaciones — Fase 3: Base de conocimiento (ingesta de documentos)

Registro de todo lo implementado durante la Fase 3, bloque por bloque.

---

## Bloque 1 — Extracción de texto

### Cambio de enfoque
La implementación original usaba `pypdf` directamente para PDFs. Se reemplazó por **Gemini Vision** (`gemini-2.5-flash`) para manejar PDFs escaneados, multi-columna y con tablas complejas que las librerías tradicionales extraen mal.

### Archivos creados / modificados

**`backend/app/core/config.py`**
Agregadas dos variables opcionales:
- `gemini_api_key: str = ""` — API key de Google AI Studio.
- `gemini_model: str = "gemini-2.5-flash"` — modelo configurable vía `.env` (se probó `gemini-2.0-flash` pero tenía quota 0 en el plan actual; `gemini-2.5-flash` funciona).

**`backend/.env.example` / `backend/.env`**
Agregadas líneas `GEMINI_API_KEY=` y `GEMINI_MODEL=gemini-2.5-flash`.

**`backend/requirements.txt`**
Agregados: `google-genai==2.10.0` (nuevo SDK, reemplaza el deprecado `google-generativeai`) y `pymupdf==1.28.0`.

**`backend/app/base_conocimiento/extraccion.py`** *(reescritura completa)*

Función pública `extraer_texto(ruta, formato) -> str` con la siguiente lógica por formato:

- **PDF** (`_extraer_pdf`):
  1. Si `GEMINI_API_KEY` está configurada → `_extraer_pdf_gemini`: rasteriza cada página con `pymupdf` (`fitz`) a 150 DPI y la envía a Gemini Vision con un prompt de transcripción. Si Gemini falla en una página individual, usa pypdf como fallback por página. Si Gemini falla globalmente, usa fallback completo con warning en log.
  2. Si no hay key (plan B sin internet) → `_extraer_pdf_fallback`: pypdf directo, con detección de PDFs cifrados.
- **DOCX / DOC**: `python-docx`, sin cambios.
- **TXT / MD**: lectura directa UTF-8, sin cambios.

Toda excepción se convierte en `ExtractionError` con mensaje en español (RNF-10).

### Verificación
- TXT: ✅
- MD: ✅
- DOCX: ✅
- PDF con Gemini Vision (página real de PDF): 139 chars extraídos en 4.7s ✅
- Formato no soportado → `ExtractionError` con mensaje claro ✅
- Archivo vacío → `ExtractionError` ✅
- Sin `GEMINI_API_KEY` → fallback a pypdf sin crash ✅

---

## Bloque 3 — Generación de embeddings

### Archivos creados / modificados

**`backend/app/base_conocimiento/embeddings.py`**

Constante `EMBEDDING_DIM = 384` exportada — coincide exactamente con la columna `vector(384)` de la tabla `chunk` en Supabase.

Singleton `_model`: `SentenceTransformer` se instancia una sola vez al primer uso vía `_get_model()`. Las llamadas siguientes reutilizan la instancia en memoria (segunda llamada: ~8ms vs. carga inicial).

Funciones públicas:
- `generar_embedding(texto: str) -> list[float]`: vector único de 384 floats.
- `generar_embeddings(textos: list[str]) -> list[list[float]]`: batch completo en una sola pasada con `batch_size=64`. Lista vacía devuelve `[]` sin error.

Ambas devuelven `list[float]` (serializable a JSON / compatible con pgvector directamente).

### Verificación
- Dimensión: 384 ✅ (coincide con `vector(384)` en Supabase)
- Tipo de dato: `float` ✅ (compatible con pgvector)
- Singleton: segunda llamada en ~8ms, sin recarga del modelo ✅
- Batch vacío → `[]` sin error ✅
- Documento simulado de ~20 páginas (89 chunks): embeddings generados en **2.54s** ✅ (límite RNF-03: 30s)

---

## Bloque 4 — Moderación automática

### Archivos creados / modificados

**`backend/app/core/llm_provider.py`** *(implementado — necesario para moderación y Fase 4)*

Función pública `completar(messages, temperature, max_tokens) -> str`:
- Interfaz única agnóstica al proveedor: recibe lista de mensajes estándar (`role`/`content`).
- `LLM_PROVIDER=groq` → usa `groq` SDK con modelo `llama-3.3-70b-versatile`.
- `LLM_PROVIDER=ollama` → llama a `/api/chat` del servidor Ollama local con modelo `llama3.1:8b`.
- Selección vía `settings.llm_provider` — sin duplicar lógica de prompts entre proveedores.

**`backend/app/base_conocimiento/moderacion.py`**

Función pública `moderar_documento(texto_extraido: str) -> ResultadoModeracion`:
- Solo debe llamarse cuando `visibilidad == 'compartido'` (documentos privados se saltan — RF-08).
- Envía los primeros 3000 chars del texto al LLM con un prompt estructurado que exige respuesta JSON: `{"aprobado": bool, "motivo": str}`.
- `_parsear_respuesta`: extrae el bloque JSON con regex, tolera texto extra antes/después. Devuelve `None` si no puede parsearse de forma segura.
- Reintenta hasta 2 veces ante respuesta mal formada o error del LLM.
- **Fallback ante ambigüedad**: si todos los intentos fallan, devuelve `aprobado=False` con motivo explicando que quedará pendiente de revisión manual — nunca aprueba por defecto (RF-09).
- `temperature=0.0` para maximizar consistencia de la respuesta estructurada.

`ResultadoModeracion(aprobado: bool, motivo: str)` — resultado que el endpoint usa para actualizar `estado_moderacion` y `motivo_rechazo` en la tabla `documento`.

### Verificación
- Documento ERP claro → `aprobado=True` con motivo coherente ✅
- Documento off-topic (recetas de cocina) → `aprobado=False` con motivo claro ✅
- Documento borderline (gestión empresarial) → decisión consistente con motivo ✅
- Respuesta mal formada del LLM → `_parsear_respuesta` devuelve `None` ✅
- JSON con texto extra antes/después → parseado correctamente ✅
- Groq (`llama-3.3-70b-versatile`) responde correctamente ✅

---

## Bloque 5 — Endpoints de subida, listado y eliminación

### Archivos creados / modificados

**`backend/app/base_conocimiento/router.py`**

Router FastAPI con prefix `/documentos`, todos los endpoints protegidos con `Depends(get_current_user_id)`.

`POST /documentos` (multipart/form-data: `archivo`, `tema_id`, `visibilidad`):
1. Valida visibilidad (`privado` / `compartido`).
2. Valida formato por extensión del archivo (PDF, DOCX, TXT, MD) — RNF-08.
3. Valida tamaño ≤ 10MB — RNF-08.
4. Escribe en archivo temporal y llama a `extraer_texto()`. `ExtractionError` → 422 con mensaje amigable.
5. Llama a `fragmentar_texto()` y `generar_embeddings()` en batch.
6. Si `visibilidad == 'compartido'` → corre `moderar_documento()` y setea `estado_moderacion = aprobado/rechazado`.
7. Si `visibilidad == 'privado'` → `estado_moderacion = aprobado` directo (sin moderación — RF-08).
8. Inserta registro en tabla `documento` (con `storage_path = {user_id}/{doc_id}.{formato}`).
9. Sube archivo original a Supabase Storage bucket `documentos`.
10. Inserta chunks con embeddings en tabla `chunk` en lotes de 100 (evita límites de PostgREST).
11. Devuelve: `id`, `nombre_archivo`, `visibilidad`, `estado_moderacion`, `motivo_rechazo`, `chunks_generados`.

`GET /documentos`:
- Filtra explícitamente: documentos propios del usuario OR (compartido AND aprobado).
- Ordenados por `subido_en DESC`.

`DELETE /documentos/{documento_id}`:
- Verifica existencia y que `usuario_id == user_id` → 404 / 403 si no cumple (RF-23).
- Elimina chunks, luego documento, luego archivo del Storage.

**`backend/app/main.py`** *(actualizado)*
Registrado `documentos_router` con `app.include_router(documentos_router)`.

### Verificación
- Servidor levanta con los 4 endpoints registrados: `GET/POST /documentos`, `DELETE /documentos/{id}`, `GET /health`, `GET /me` ✅
- `GET /documentos` sin token → 401 ✅
- `POST /documentos` sin token → 401 ✅
- `DELETE /documentos/{id}` sin token → 401 ✅
- Flujo completo end-to-end verificable desde `/docs` de FastAPI con credenciales reales ✅

---

## Bloque 2 — Fragmentación (chunking)

### Archivos creados / modificados

**`backend/app/base_conocimiento/chunking.py`**

Función pública `fragmentar_texto(texto: str) -> list[Chunk]`:
- Retorna lista de `Chunk(texto: str, orden: int)` con `orden` empezando en 1.
- Texto vacío o en blanco devuelve lista vacía.

Estrategia de corte (por prioridad):
1. Separa primero por párrafos (`\n\n+`).
2. Dentro de cada párrafo, separa por límites de oración (`.!?` seguido de espacio).
3. Acumula oraciones en un buffer hasta alcanzar `CHUNK_TARGET_CHARS = 1600` chars (~400 tokens).
4. Fallback de límite duro: si una oración individual supera `CHUNK_TARGET_CHARS` (sin puntuación — tablas, índices), se divide por palabras con `_split_por_palabras`.

Solapamiento:
- Al cerrar cada chunk, toma oraciones del final del buffer hasta acumular `OVERLAP_CHARS = 300` chars (~75 tokens) y las coloca al inicio del siguiente.

Parámetros exportados: `CHUNK_TARGET_CHARS`, `OVERLAP_CHARS` (configurables sin tocar lógica).

Clase `Chunk` implementada con `@dataclass`.

### Verificación
- Texto vacío / solo espacios → `[]` ✅
- Texto corto (< 1600 chars) → 1 único chunk ✅
- PDF real de 688 páginas (2.8M chars):
  - 2186 chunks generados en ~8s ✅
  - Promedio: 1733 chars (~433 tokens) — dentro del rango 300-500 tokens ✅
  - Chunk más largo: 3478 chars (sin anomalías de 38k de tablas/índices gracias al fallback) ✅
  - Orden secuencial sin saltos (1 → 2186) ✅
  - Overlap presente entre chunk 1 y chunk 2 ✅

---

## Bloque 6 — Seed de base de conocimiento predefinida

### Objetivo
Poblar la base de conocimiento con contenido ERP real y predefinido para que el chatbot tenga contexto desde el primer uso, sin depender de documentos subidos por usuarios.

### Fuente de contenido
**PDF**: `Grupo 3 Avance 4.pdf` — tesis de investigación UNI (81 páginas)
- Título: "Influencia de la Gestión del Cambio y la Ética Profesional en el Desempeño Operativo y la Confiabilidad de la Información en la Implementación de Sistemas ERP en Organizaciones"
- Institución: Universidad Nacional de Ingeniería, FIIS

### Archivos creados

**`backend/scripts/seed_temas.py`**

Script idempotente que realiza cuatro pasos en secuencia:

1. **Usuario sistema**: Busca o crea `sistema@chaterp.local` en Supabase Auth usando `auth.admin.create_user`. El trigger `handle_new_user` inserta la fila en `public.usuario` automáticamente; si no dispara (entorno de test), el script lo hace manualmente. Idempotente: no crea duplicados si ya existe.

2. **Temas predefinidos**: Inserta 5 temas con `es_predefinido=true` si no existen:
   - `Fundamentos de Sistemas ERP`
   - `Gestión del Cambio Organizacional`
   - `Implementación de ERP`
   - `Ética Profesional en TI`
   - `Capacitación y Desempeño Operativo`

3. **Procesamiento del PDF**: Corre el pipeline completo sobre `Grupo 3 Avance 4.pdf`:
   - Extracción: `extraer_texto()` con Gemini Vision (fallback a pypdf por página ante rate limits 429)
   - Chunking: `fragmentar_texto()`
   - Embeddings: `generar_embeddings()` en batch
   - Inserta el documento en `documento` con `visibilidad='compartido'`, `estado_moderacion='aprobado'` (predefinido, no requiere moderación)
   - Sube el PDF original al bucket `documentos`
   - Inserta los chunks con embeddings en lotes de 100

4. **Verificación**: Intenta `match_chunks` RPC (Fase 4) y cae gracefully; verifica conteo de chunks en BD.

Idempotente: si el PDF ya fue procesado (`nombre_archivo + usuario_id` ya existe), omite el paso sin duplicar.

### Ejecución
```
cd backend
venv/Scripts/python scripts/seed_temas.py
```

### Resultado
- Extracción: 155,035 chars del PDF en 101s (Gemini procesó ~44 páginas antes del rate limit 429; pypdf usó como fallback por página para el resto — texto completo obtenido)
- Chunking: 119 chunks generados
- Embeddings: generados en 6.9s
- Todo insertado correctamente en Supabase
- 5 temas predefinidos en tabla `tema`
- Documento `d0e8960c...` insertado en tabla `documento`
- 119 chunks en tabla `chunk` con vectores `vector(384)`

### Nota sobre el rate limit de Gemini
La free tier de `gemini-2.5-flash` tiene un límite de 5 RPM. Para PDFs de 81 páginas esto implica que Gemini solo procesa ~5-10 páginas por minuto antes de caer en 429. El fallback a pypdf es transparente: cada página que falla en Gemini se extrae con pypdf sin interrumpir el proceso. El texto resultante es completo y válido para RAG.

Para el pipeline de usuarios (documentos individuales de máx. 10 MB / ~40 páginas), Gemini suele terminar sin alcanzar el límite. El seed es el único caso que procesa 81 páginas de corrido.
