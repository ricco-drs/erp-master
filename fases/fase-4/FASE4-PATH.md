# Fase 4 — Chat conversacional (RAG)

Desglose de tareas para implementar el núcleo del chatbot: recuperación de contexto por similitud vectorial, orquestación del prompt, llamada al LLM, control de alcance ERP, y persistencia del historial de conversaciones.

Esta fase depende de que la Fase 3 haya cargado al menos los temas predefinidos con contenido en la tabla `chunk` — sin eso, el retriever no tiene nada que buscar. Cubre RF-11 a RF-15.

---

## 1. Selector de proveedor LLM

- [ ] Escribir `app/core/llm_provider.py`: función `get_llm_client()` que lea `LLM_PROVIDER` del entorno y retorne el cliente correspondiente (Groq o Ollama), con la misma interfaz de llamada para ambos — el resto del código no debe saber qué proveedor está activo.
- [ ] Para Groq: usar el SDK `groq`, modelo por defecto `llama-3.3-70b-versatile`, configurable vía variable de entorno `GROQ_MODEL`.
- [ ] Para Ollama: usar `httpx` o el cliente oficial de Ollama para Python (`ollama`), apuntando a `OLLAMA_BASE_URL`, modelo configurable vía `OLLAMA_MODEL` (por defecto `llama3.1:8b`).
- [ ] Manejar el caso de que el proveedor activo no esté disponible (Groq con internet caído, Ollama sin el modelo descargado): devolver un error claro que el servicio de chat pueda capturar y convertir en un mensaje amigable al usuario (RNF-13).
- [ ] Probar el cambio entre Groq y Ollama modificando únicamente el `.env`, sin tocar código.

**Verificación de bloque:** una llamada de prueba al LLM funciona con ambos proveedores, alternando solo por variable de entorno.

---

## 2. Retriever (búsqueda por similitud vectorial)

- [ ] Escribir `app/chat/retriever.py`: función `recuperar_contexto(query, tema_id, top_k=5)` que:
  - Genere el embedding de la pregunta del usuario usando el mismo modelo (`all-MiniLM-L6-v2`) que se usó para indexar los documentos.
  - Consulte la tabla `chunk` en Supabase usando búsqueda por similitud coseno (`<=>` de pgvector), filtrada por `documento.tema_id` para no mezclar contexto de temas distintos.
  - Devuelva los `top_k` chunks más relevantes con su contenido y su score de similitud.
- [ ] Definir un umbral mínimo de similitud (por ejemplo, `0.4`): si ningún chunk supera ese umbral, devolver lista vacía — esto es lo que dispara el rechazo por fuera de alcance en el servicio de chat.
- [ ] Confirmar que el índice HNSW definido en el SQL (`idx_chunk_embedding`) está siendo usado por la consulta (no un full scan).
- [ ] Probar con una pregunta relacionada al tema (debe devolver chunks relevantes) y con una pregunta fuera de tema (debe devolver lista vacía o score muy bajo).

**Verificación de bloque:** búsqueda con una pregunta real sobre ERP devuelve chunks coherentes y ordenados por relevancia; búsqueda con pregunta fuera de tema devuelve vacío o score bajo que dispararía rechazo.

---

## 3. Servicio de chat y orquestación del RAG

- [ ] Escribir `app/chat/service.py`: función `procesar_mensaje(mensaje, sesion_id, tema_id, historial)` que orqueste el flujo completo:
  1. Llamar al retriever con el mensaje del usuario y el `tema_id` activo.
  2. Si no hay contexto relevante (lista vacía o score bajo): devolver un mensaje de rechazo amable y redirigir al usuario al tema, sin llamar al LLM — economiza tokens y evita respuestas inventadas (RF-13).
  3. Si hay contexto: construir el prompt completo (system prompt + contexto recuperado + historial de la sesión + mensaje del usuario) y llamar al LLM vía `llm_provider`.
  4. Devolver la respuesta del LLM.
- [ ] Diseñar el system prompt con cuidado — debe instruir al modelo a: responder únicamente basándose en el contexto provisto, no inventar información ausente en ese contexto, rechazar preguntas fuera de ERP, y mantener un tono de tutor/capacitador (no un chatbot genérico).
- [ ] Controlar el tamaño del historial incluido en cada prompt: incluir solo los últimos N turnos (por ejemplo, los últimos 6 mensajes) para no exceder el context window del LLM y para controlar el consumo de tokens (RNF-17).
- [ ] Controlar el tamaño del contexto recuperado: concatenar como máximo los `top_k` chunks necesarios sin exceder un límite de tokens razonable para el contexto (por ejemplo, 2000 tokens de contexto máximo).

**Verificación de bloque:** una pregunta dentro del tema devuelve una respuesta coherente basada en el contexto; una pregunta fuera de tema devuelve el mensaje de rechazo sin llamar al LLM; el historial de la sesión se mantiene en los siguientes turnos.

---

## 4. Persistencia de sesiones y mensajes

- [ ] Endpoint `POST /chat/sesiones`: crea una nueva `sesion_chat` para el usuario autenticado con el `tema_id` seleccionado, devuelve el `sesion_id`.
- [ ] Endpoint `POST /chat/sesiones/{sesion_id}/mensajes`: recibe el mensaje del usuario, ejecuta el pipeline RAG, persiste tanto el mensaje del usuario como la respuesta del asistente en la tabla `mensaje`, y devuelve la respuesta.
- [ ] Endpoint `GET /chat/sesiones`: lista las sesiones pasadas del usuario (para el historial consultable del perfil — RF-15).
- [ ] Endpoint `GET /chat/sesiones/{sesion_id}/mensajes`: devuelve el historial completo de mensajes de una sesión.
- [ ] Validar en todos los endpoints que el `sesion_id` pertenece al usuario autenticado (no acceder a sesiones ajenas — RNF-06).

**Verificación de bloque:** una conversación de 3+ turnos queda persistida correctamente en `sesion_chat` y `mensaje`; el historial es consultable vía el endpoint correspondiente.

---

## 5. Control de consumo de tokens y logging

- [ ] Registrar en logs básicos (consola o archivo de log): número de tokens usados por llamada al LLM, proveedor activo, tiempo de respuesta, y si la llamada se realizó (o se cortó por rechazo de alcance antes de llegar al LLM) — conecta con RNF-17 y RNF-18.
- [ ] Implementar un mecanismo básico de reintento limitado ante timeout del LLM: máximo 2 reintentos con backoff simple antes de devolver un error controlado al usuario (RNF-13).
- [ ] Si el LLM falla completamente después de los reintentos, devolver un mensaje de error amigable sin romper la sesión del usuario.

**Verificación de bloque:** simular un timeout del LLM (por ejemplo, desconectando internet con Groq activo) y confirmar que el sistema reintenta, falla de forma controlada, y devuelve un mensaje amigable sin crash.

---

## 6. Frontend: interfaz de chat

- [ ] Pantalla de selección de tema (`/chat`): lista de temas disponibles (predefinidos + documentos propios del usuario) como cards seleccionables, aplicando el design system.
- [ ] Al seleccionar un tema: crear la sesión vía `POST /chat/sesiones` y redirigir a la vista de chat con ese contexto activo.
- [ ] Interfaz de chat (`/chat/[sesionId]`):
  - Input de mensaje en la parte inferior, botón de enviar.
  - Mensajes del usuario con fondo `--bg-surface-hover`.
  - Respuestas del asistente como texto directo sobre `--bg-base`, sin burbuja (estilo editorial, según `docs/design-system.md`).
  - Scroll automático al mensaje más reciente.
  - Indicador de carga ("pensando...") mientras el LLM responde (RNF-11).
  - Mensajes de rechazo (fuera de alcance) visibles con un estilo diferenciado (por ejemplo, texto en `--text-muted`, sin el estilo de respuesta normal).
- [ ] Manejo de error de red o LLM caído: mostrar mensaje de error inline sin romper la UI (RNF-10).
- [ ] Aplicar el design system completo: paleta, tipografía Inter, radios bajos, bordes finos.

**Verificación de bloque:** conversación de varios turnos funciona en la UI de extremo a extremo: seleccionar tema → escribir mensaje → ver respuesta → escribir otro mensaje → el historial se mantiene visible.

---

## 7. Cierre de la fase

- [ ] Confirmar que las políticas RLS de `sesion_chat` y `mensaje` están funcionando correctamente (un usuario no puede ver ni escribir en sesiones ajenas).
- [ ] Validar el tiempo de respuesta del chat contra RNF-01 (máximo 5-8 segundos) con el proveedor activo (Groq en plan A).
- [ ] Confirmar que el rechazo de preguntas fuera de ERP funciona de forma consistente con distintos tipos de preguntas no relacionadas.
- [ ] Actualizar `docs/fases-proyecto.md` marcando la Fase 4 como completada.
- [ ] Commit y push de todo lo desarrollado en esta fase, separado por bloque cuando tenga sentido.

**Condición de salida de la fase:** el chatbot puede sostener una conversación de varios turnos sobre un tema ERP seleccionado, basándose solo en el contexto recuperado; rechaza preguntas fuera de alcance de forma amable; el historial queda persistido; la UI está aplicada con el design system; el tiempo de respuesta se mantiene dentro de los 8 segundos con Groq activo.
