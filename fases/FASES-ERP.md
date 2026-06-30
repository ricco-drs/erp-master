# Fases del proyecto — ChatERP

Plan de trabajo del proyecto, de principio a fin, pensado para llegar listos a la feria. Cada fase indica su objetivo, lo que incluye, y la condición de salida (qué debe estar listo para pasar a la siguiente).

---

## Fase 0 — Definición y diseño (completada)

**Objetivo:** dejar cerradas todas las decisiones de negocio, arquitectura y diseño antes de escribir código de producto.

- Validación de la idea del chatbot frente al trabajo de investigación.
- Definición de alcance: RAG conceptual sobre ERP general + generación de evaluaciones.
- Arquitectura: monolito modular.
- Requerimientos funcionales (RF-01 a RF-23) y no funcionales (RNF-01 a RNF-19).
- Modelo de datos (diagrama E-R) y esquema SQL para Supabase, con RLS y políticas de Storage.
- Stack tecnológico definido: Next.js, FastAPI, Supabase, sentence-transformers, Groq/Ollama.
- Plan de contingencia nube/local para la feria.
- Documentación base: `README.md`, `AGENTS.md`, `docs/requerimientos.md`.
- Design system definido a partir de referencias visuales (`docs/design-system.md`).

**Condición de salida:** documentación completa, sin decisiones de arquitectura pendientes.

---

## Fase 1 — Inicialización del entorno (completada)

**Objetivo:** tener el esqueleto del proyecto corriendo localmente, sin lógica de negocio aún.

- Estructura de carpetas creada (`backend`, `frontend`, `sql`, `docs`).
- Entorno virtual de Python + dependencias instaladas (`requirements.txt`).
- Proyecto Next.js inicializado + Tailwind + cliente de Supabase instalado.
- Variables de entorno configuradas (`.env`, `.env.local`) con credenciales reales de Supabase y Groq.
- Repositorio Git inicializado y conectado a GitHub, primer push realizado.
- Base de datos Supabase creada y el script SQL (`01_schema_chatbot_erp.sql`) ejecutado sin errores.

**Condición de salida:** `git clone` del repo + seguir el README permite a cualquiera del equipo llegar al mismo punto.

---

## Fase 2 — Backend base y autenticación

**Objetivo:** tener una API funcional con autenticación end-to-end, sin RAG ni evaluaciones todavía.

- `app/main.py`: FastAPI mínimo con endpoint de salud (`/health`).
- `app/core/config.py`: carga de variables de entorno con Pydantic Settings.
- `app/core/supabase_client.py`: cliente con `service_role key` para el backend.
- Integración de Supabase Auth desde el frontend (registro / login / logout).
- Middleware o dependencia de FastAPI que valide el JWT de Supabase en endpoints protegidos (RF-01 a RF-04).
- Pantallas de frontend: login y registro, aplicando el design system definido.

**Condición de salida:** un usuario puede registrarse, iniciar sesión, y el backend reconoce su sesión en un endpoint protegido de prueba.

---

## Fase 3 — Base de conocimiento (ingesta de documentos)

**Objetivo:** poder subir un documento y que termine convertido en chunks con embeddings, listo para ser consultado por el RAG.

- `app/base_conocimiento/extraccion.py`: extracción de texto desde PDF, Word y texto plano/markdown (RF-06).
- `app/base_conocimiento/chunking.py`: fragmentación del texto extraído.
- `app/base_conocimiento/embeddings.py`: generación de embeddings con `sentence-transformers` (RF-10).
- `app/base_conocimiento/moderacion.py`: validación automática vía LLM para documentos marcados como compartidos (RF-08, RF-09).
- Endpoints de subida, listado y eliminación de documentos propios (RF-07, RF-23).
- Integración con Supabase Storage (subida del archivo original) + tabla `documento` y `chunk`.
- Carga inicial de la base de conocimiento predefinida sobre temas ERP generales (RF-05).
- Pantalla de frontend: subida de documentos, selección de visibilidad (privado/compartido), listado con estado de moderación.

**Condición de salida:** subir un PDF de prueba, ver que se procese, se generen embeddings, y aparezca correctamente como privado o (tras moderación) como compartido.

---

## Fase 4 — Chat conversacional (RAG)

**Objetivo:** que el chatbot responda preguntas usando recuperación de contexto, limitado al tema seleccionado.

- `app/chat/retriever.py`: búsqueda por similitud en `chunk` (pgvector), filtrada por `tema_id`.
- `app/core/llm_provider.py`: selector de proveedor (Groq / Ollama) vía variable de entorno.
- `app/chat/service.py`: orquestación del prompt (contexto recuperado + historial + pregunta) y llamada al LLM.
- Lógica de rechazo cuando no hay contexto relevante o la pregunta está fuera de alcance ERP (RF-13).
- Persistencia de `sesion_chat` y `mensaje` (RF-14, RF-15).
- Pantalla de frontend: selección de tema, interfaz de chat aplicando el design system (mensajes del asistente sin burbuja, estilo editorial).

**Condición de salida:** conversación de varios turnos sobre un tema, con respuestas basadas en el contexto correcto, y rechazo correcto ante preguntas fuera de alcance.

---

## Fase 5 — Evaluaciones

**Objetivo:** generar evaluaciones por tema, con corrección automática y feedback por LLM en preguntas abiertas.

- `app/evaluaciones/service.py`: generación de preguntas (opción múltiple, V/F, abiertas) basadas en el contexto del tema (RF-16, RF-17).
- Lógica de corrección automática para opción múltiple y V/F (RF-18).
- Lógica de calificación + feedback vía LLM para preguntas abiertas (RF-19).
- Cálculo de puntaje consolidado (RF-20).
- Persistencia de `intento_evaluacion` y `respuesta_usuario`, historial por usuario (RF-21).
- Pantalla de frontend: tomar evaluación, ver resultados con feedback.

**Condición de salida:** completar una evaluación de extremo a extremo y ver el puntaje + feedback correctamente guardado.

---

## Fase 6 — Perfil y seguimiento de progreso

**Objetivo:** que el usuario pueda ver un resumen de su actividad.

- Endpoint y pantalla de perfil: resumen de temas estudiados, evaluaciones realizadas, puntajes (RF-22).
- Vista de documentos propios con opción de eliminar (RF-23).
- Vista de historial de conversaciones.

**Condición de salida:** el perfil refleja correctamente la actividad generada en las fases anteriores.

---

## Fase 7 — Endurecimiento (RNF) y pulido de UI

**Objetivo:** cerrar los requerimientos no funcionales priorizados y aplicar el design system de forma consistente en toda la app.

- Rendimiento: validar tiempos de respuesta del chat y evaluaciones contra RNF-01, RNF-02, RNF-03.
- Seguridad: revisar que RLS cubra todos los casos, validar inputs (tipo/tamaño de archivo), confirmar que no hay credenciales expuestas en frontend.
- Usabilidad: estados de carga, mensajes de error claros, responsive (laptop/tablet).
- Manejo de errores ante fallas del LLM (timeout, reintento limitado) (RNF-13).
- Control de consumo de tokens y logging básico de uso del LLM (RNF-17, RNF-18).
- Revisión visual completa contra `docs/design-system.md` — ningún componente debe romper las reglas de paleta, radios o tipografía definidas.

**Condición de salida:** la app se siente rápida, consistente visualmente, y no se rompe ante errores comunes (archivo corrupto, LLM caído, input vacío).

---

## Fase 8 — Plan de contingencia y ensayo de feria

**Objetivo:** asegurar que el sistema funcione sin internet si es necesario, y que el equipo esté preparado para la demo en vivo.

- Levantar Supabase CLI local (`supabase start`, `supabase db reset`) y validar que el esquema funcione igual que en la nube.
- Descargar y probar el modelo de Ollama localmente (`ollama pull llama3.1:8b`).
- Probar el cambio completo entre plan A (nube) y plan B (local) solo modificando el `.env`.
- Ensayo completo de la demo: registro, selección de tema, conversación, evaluación, perfil — todo en vivo, cronometrado.
- Preparar datos de prueba/semilla (temas predefinidos, documentos base) ya cargados de antemano para no depender de subir archivos en vivo.

**Condición de salida:** la demo completa puede ejecutarse sin internet, sin errores, en menos de lo que dura el tiempo asignado por el jurado.

---

## Fase 9 — Documentación final y entrega

**Objetivo:** dejar todo listo para la presentación y evaluación del jurado.

- Revisión final de `README.md`, `AGENTS.md`, `docs/requerimientos.md`.
- Material de presentación (poster/slides) con el diagrama de arquitectura y el diagrama E-R.
- Verificación de que el repositorio en GitHub está actualizado y es presentable (sin credenciales filtradas, commits con mensajes claros).

**Condición de salida:** el proyecto está listo para la feria, con documentación y código en su estado final.

---

## Resumen de dependencias entre fases

```
Fase 0 (Definición)
   │
Fase 1 (Inicialización)
   │
Fase 2 (Backend + Auth)
   │
Fase 3 (Base de conocimiento) ──┐
   │                             │
Fase 4 (Chat / RAG) ◄───────────┘
   │
Fase 5 (Evaluaciones)
   │
Fase 6 (Perfil)
   │
Fase 7 (Endurecimiento RNF + UI)
   │
Fase 8 (Contingencia + ensayo)
   │
Fase 9 (Documentación final)
```

La Fase 4 depende de que la Fase 3 ya tenga al menos la base de conocimiento predefinida cargada (no hace falta que esté completa la subida de documentos de usuario para empezar a probar el RAG con contenido base).
