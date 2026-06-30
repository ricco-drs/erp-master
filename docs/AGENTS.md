# AGENTS.md

Este archivo da contexto a cualquier agente de IA (Claude Code u otro) que trabaje sobre este repositorio. Léelo antes de modificar código.

## Qué es este proyecto

Chatbot de capacitación en sistemas ERP, construido con arquitectura RAG, como complemento tecnológico de un trabajo de investigación académica sobre gestión del cambio y ética profesional en implementaciones de ERP. El objetivo del sistema es demostrar de forma aplicada la hipótesis "la capacitación influye positivamente en el desempeño operativo durante la implementación de un ERP", no ser un producto comercial.

Esto importa para las decisiones de código: se prioriza claridad, bajo costo y robustez en demo en vivo por encima de escalabilidad o features extensas.

## Restricciones de negocio no negociables

- **Cero modelos de IA de pago.** Embeddings con `sentence-transformers` (local, `all-MiniLM-L6-v2`, 384 dimensiones). LLM generativo con Groq API (gratis) como plan A y Ollama local como plan B. Extracción de texto de documentos (OCR) con Gemini Vision (Google AI Studio, plan de estudiante), usado únicamente para esa etapa puntual del pipeline de ingesta — no como LLM conversacional. Nunca introducir dependencias de OpenAI, Anthropic API de pago, u otro proveedor con costo, salvo que el usuario lo pida explícitamente.
- **El alcance del chatbot es ERP general**, no un software específico (SAP, Odoo, etc.) y no debe responder fuera de ese dominio: ante preguntas fuera de tema, debe rechazar y redirigir amablemente, nunca usar conocimiento general del LLM para responder.
- **Sin autenticación por confirmación de correo.** El registro/login debe ser inmediato, sin paso de verificación de email, porque la demo se hace en vivo frente a jurado.
- **El sistema debe poder correr 100% local sin internet** (plan B de contingencia: Supabase CLI local + Ollama). Ninguna URL, clave o endpoint debe quedar hardcodeada — todo vía variables de entorno (`.env`), de forma que cambiar entre plan A (nube) y plan B (local) sea solo cuestión de cambiar el `.env`.

## Arquitectura

Monolito modular. Un único backend desplegable (FastAPI), organizado internamente en módulos con responsabilidad separada. No introducir microservicios, colas de mensajes, ni servicios adicionales — la complejidad operativa no se justifica para el tamaño de este proyecto.

Módulos del backend:
- `chat/` — orquestación del RAG (retriever + llamada al LLM)
- `evaluaciones/` — generación de preguntas, corrección automática (opción múltiple/V-F) y calificación vía LLM (preguntas abiertas)
- `base_conocimiento/` — ingesta de documentos (extracción, chunking, embeddings), moderación automática de contenido compartido

## Stack y convenciones por capa

### Frontend (Next.js + TypeScript)
- App Router, no Pages Router.
- Tailwind CSS para estilos; no introducir otra librería de CSS.
- Cliente de Supabase (`@supabase/supabase-js`) con `anon key` únicamente. El `service_role key` nunca debe aparecer en código de frontend.

### Backend (Python + FastAPI)
- Async por defecto en endpoints que llamen a servicios externos (Groq, Supabase).
- Validación de entrada con Pydantic, no validación manual.
- El cliente Supabase con `service_role key` vive solo en el backend, nunca se expone a través de un endpoint sin control de acceso.
- Generación de embeddings: `sentence-transformers`, modelo `all-MiniLM-L6-v2`. Si se cambia de modelo, la dimensión de la columna `embedding` en la tabla `chunk` debe actualizarse y la tabla recrearse — avisar explícitamente si una tarea implica esto.
- LLM: el proveedor (`groq` u `ollama`) se selecciona vía variable de entorno `LLM_PROVIDER`. El código que arma el prompt y procesa la respuesta debe ser agnóstico al proveedor — no duplicar lógica de prompts por proveedor.

### Base de datos (Supabase / PostgreSQL + pgvector)
- El esquema fuente de verdad vive en `/sql`. Cualquier cambio de esquema debe reflejarse ahí, no solo aplicarse manualmente en el dashboard de Supabase.
- RLS (Row Level Security) está habilitado en todas las tablas. No desactivar RLS para "simplificar" una tarea — ajustar las políticas en su lugar.
- Operaciones administrativas (cambio de `estado_moderacion`, inserción de `chunk`/embeddings, generación de `evaluacion`/`pregunta`) se hacen desde el backend con `service_role key`, nunca desde el cliente con `anon key`.
- Los archivos originales de documentos van en Supabase Storage (bucket `documentos`), con `storage_path` en la tabla `documento` como referencia. Convención de ruta: `{usuario_id}/{documento_id}.{formato}`.

## Reglas de moderación y alcance del RAG

- Documento marcado como `compartido` pasa por moderación automática (vía LLM) antes de integrarse a la base de conocimiento general. Mientras esté `pendiente` o `rechazado`, no debe ser indexado ni visible para otros usuarios.
- Documento `privado` nunca pasa por moderación ni se comparte; solo es visible para su dueño.
- El retriever del RAG debe limitar la búsqueda al `tema_id` seleccionado por el usuario en la sesión activa. No mezclar contexto de temas distintos en una misma respuesta.
- Si la similitud de los chunks recuperados es baja (no hay contexto relevante), el chatbot debe rechazar y redirigir, no inventar una respuesta con conocimiento general del modelo.

## Qué evitar

- No agregar autenticación multifactor, OAuth social, ni flujos de verificación adicionales — están fuera de alcance y complican la demo.
- No agregar dependencias pagas (APIs de pago, servicios cloud con costo) sin confirmación explícita del usuario.
- No introducir microservicios, brokers de mensajes, o contenedores adicionales más allá de lo ya definido (backend, frontend, Supabase, y opcionalmente Ollama local).
- No usar `localStorage`/`sessionStorage` del navegador como mecanismo de persistencia real — la persistencia vive en Supabase.
- No mezclar lógica de negocio entre módulos (por ejemplo, que el módulo de evaluaciones llame directamente al retriever del chat sin pasar por una interfaz clara) — mantener la separación modular aunque todo corra en el mismo proceso.

## Antes de hacer cambios grandes

Si una tarea implica modificar el esquema de base de datos, cambiar el proveedor de embeddings/LLM, o alterar las políticas de RLS/Storage, confirmar explícitamente con el usuario antes de ejecutar — estos cambios son más costosos de revertir que un cambio de código de aplicación.
