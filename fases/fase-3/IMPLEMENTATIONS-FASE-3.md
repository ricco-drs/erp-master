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
