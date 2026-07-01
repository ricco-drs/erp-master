# Implementaciones — Fase 4: Chat conversacional (RAG)

Registro de todo lo implementado durante la Fase 4, bloque por bloque.

---

## Bloque 1 — Selector de proveedor LLM

### Contexto
`app/core/llm_provider.py` ya existía desde la Fase 3 (fue necesario para la moderación automática de documentos). Este bloque completa los requisitos que faltaban: modelos configurables vía env vars y manejo explícito de errores de proveedor con una excepción tipada (`LLMError`).

### Archivos modificados

**`backend/app/core/config.py`**
Agregadas dos variables opcionales:
- `groq_model: str = "llama-3.3-70b-versatile"` — modelo de Groq configurable sin tocar código.
- `ollama_model: str = "llama3.1:8b"` — modelo de Ollama configurable sin tocar código.

**`backend/.env`**
Agregadas líneas `GROQ_MODEL=llama-3.3-70b-versatile` y `OLLAMA_MODEL=llama3.1:8b`.

**`backend/app/core/llm_provider.py`** *(reescritura)*

Cambios respecto a la versión de Fase 3:

1. **`LLMError(Exception)`** — excepción personalizada que el servicio de chat puede capturar específicamente sin atrapar todo. Contiene mensajes en español listos para mostrar al usuario (RNF-10).

2. **Modelos desde `settings`** — `_GROQ_MODEL` y `_OLLAMA_MODEL` hardcodeados reemplazados por `settings.groq_model` y `settings.ollama_model`.

3. **Error handling en Groq** (`_completar_groq`):
   - API key vacía → `LLMError` con instrucción clara.
   - Rate limit (429) → mensaje específico de cuota agotada.
   - Auth error (401) → mensaje de key inválida.
   - Cualquier otro error → `LLMError` wrapeando la excepción original.

4. **Error handling en Ollama** (`_completar_ollama`):
   - `ConnectError` → "Verificá que Ollama esté corriendo (`ollama serve`)."
   - `TimeoutException` → "El modelo puede estar cargando."
   - `HTTPStatusError 404` → "Descargalo con `ollama pull <model>`."
   - Otros HTTP → mensaje con código y body.

5. **Proveedor inválido** → `LLMError` (antes `ValueError`).

La interfaz pública `completar(messages, temperature, max_tokens) -> str` no cambió — el resto del código (moderación, servicio de chat) es compatible sin modificaciones.

---

## Bloque 2 — Retriever (búsqueda por similitud vectorial)

### Archivos creados

**`sql/03_match_chunks_function.sql`** *(aplicado en Supabase Dashboard)*

Función SQL `public.match_chunks(query_embedding, match_threshold, match_count, p_tema_id)` que:
- Hace un JOIN entre `chunk` y `documento` para filtrar por `tema_id` y `estado_moderacion = 'aprobado'`.
- Calcula similitud coseno como `1 - (embedding <=> query_embedding)`.
- Usa `ORDER BY embedding <=> query_embedding` para aprovechar el índice HNSW (`idx_chunk_embedding`).
- Pre-filtra por `match_threshold` en SQL para reducir tráfico de red.
- `p_tema_id = NULL` → busca en todos los temas aprobados (útil para Fase 6+).
- Declarada `STABLE` (no modifica BD, puede cachear resultados en una transacción).

**`backend/app/chat/retriever.py`**

`@dataclass ChunkRecuperado(id, documento_id, contenido, orden, similitud)`

`recuperar_contexto(query, tema_id, top_k=5, umbral=0.50) -> list[ChunkRecuperado]`:
1. Genera el embedding de la query con `generar_embedding()` (mismo modelo `all-MiniLM-L6-v2` que el índice).
2. Llama a `supabase.rpc("match_chunks", {...})`.
3. Mapea resultados a `ChunkRecuperado` y ordena por similitud descendente.
4. Retorna lista vacía si RPC falla o no hay resultados — el chat service lo convierte en rechazo de alcance.

`construir_contexto_texto(chunks, max_chars=6000) -> str`:
- Concatena chunks en bloques `[Fragmento N]\n{contenido}`, separados por `\n\n`.
- Respeta límite de `max_chars` para no exceder el context window del LLM.

### Calibración del umbral

Se midieron similitudes coseno con el corpus real (119 chunks del PDF de investigación UNI):

| Tipo de pregunta | Similitud top-1 |
|---|---|
| On-topic: "¿Qué es un sistema ERP?" | 0.682 |
| On-topic: "gestión del cambio en ERP" | 0.749 |
| Off-topic: "receta de ceviche" | 0.429 |
| Off-topic: "mundial de fútbol" | 0.402 |
| Off-topic: "segunda ley de Newton" | 0.384 |

Gap claro entre 0.43 (máx off-topic) y 0.59 (mín on-topic). Umbral elegido: **0.50**.

### Verificación
- On-topic "¿Qué es un sistema ERP?" → 5 chunks, top sim=0.592 ✅
- On-topic "gestión del cambio en ERP" → 5 chunks, top sim=0.707 ✅
- Off-topic "ceviche" → 0 chunks ✅
- Off-topic "mundial fútbol" → 0 chunks ✅
- Off-topic "Newton" → 0 chunks ✅
- Búsqueda sin `tema_id` (None) → devuelve chunks de todos los temas aprobados ✅
- `construir_contexto_texto` respeta límite de `max_chars` ✅

---

## Bloque 3 — Servicio de chat y orquestación del RAG

### Archivos creados

**`backend/app/chat/service.py`**

Constantes:
- `MAX_TURNOS_HISTORIAL = 6` — últimos 6 turnos (12 mensajes) incluidos en el prompt. Evita exceder el context window del LLM.

Dataclasses de interfaz:
- `MensajeChat(rol, contenido)` — mensaje del historial, `rol ∈ {"usuario", "asistente"}`.
- `RespuestaChat(contenido, fuera_de_alcance, chunks_usados)` — resultado del turno con metadata de trazabilidad.

`procesar_mensaje(mensaje, tema_id, historial) -> RespuestaChat`:

Flujo de orquestación:
1. Llama a `recuperar_contexto(mensaje, tema_id)` del retriever.
2. Si chunks vacíos → devuelve `RespuestaChat(contenido=_RESPUESTA_SIN_CONTEXTO, fuera_de_alcance=True, chunks_usados=0)` **sin llamar al LLM**. Economiza tokens y evita respuestas inventadas (RF-13).
3. Si hay chunks → llama a `construir_contexto_texto(chunks)` y arma el prompt.
4. Llama a `completar(messages, temperature=0.3, max_tokens=1024)`. Puede lanzar `LLMError` (el router lo convierte en HTTP 503).
5. Devuelve `RespuestaChat` con `fuera_de_alcance=False` y `chunks_usados=len(chunks)`.

`_construir_messages(mensaje_usuario, contexto, historial)`:
- Estructura: `[system]` + historial reciente truncado + `[user con contexto inyectado]`.
- El contexto se inyecta solo en el mensaje actual, no en el historial — el LLM siempre tiene contexto fresco para la pregunta actual.
- Truncado a `historial[-(MAX_TURNOS_HISTORIAL * 2):]`.

`_SYSTEM_PROMPT`: instruye al LLM a responder exclusivamente con el contexto provisto, rechazar preguntas fuera de ERP, mantener tono de tutor, responder en español, y no mencionar "fragmentos" o "chunks" explícitamente.

### Verificación
- On-topic → respuesta coherente basada en el contexto, `fuera_de_alcance=False`, 5 chunks usados ✅
- Off-topic ("torta de chocolate") → `fuera_de_alcance=True`, 0 chunks, sin llamar al LLM ✅
- Multi-turno con historial → segunda pregunta relacionada al corpus obtiene respuesta coherente que referencia contexto del turno anterior ✅
- Historial largo (20 mensajes) → truncado a 12 en el prompt (límite `MAX_TURNOS_HISTORIAL * 2`) ✅
- `LLMError` propagado al caller (el router lo manejará en Bloque 4) ✅

### Verificación
- Config: `settings.groq_model == "llama-3.3-70b-versatile"` y `settings.ollama_model == "llama3.1:8b"` ✅
- Groq (plan A): llamada real con key válida devuelve respuesta correcta ✅
- Ollama sin servidor (plan B): lanza `LLMError` con mensaje en español ("Verificá que Ollama esté corriendo") ✅
- Proveedor inválido: lanza `LLMError` explicando los valores aceptados ✅
- Cambio de proveedor: solo requiere modificar `LLM_PROVIDER` en `.env`, sin tocar código ✅
