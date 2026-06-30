# Chatbot de capacitación ERP

Asistente conversacional basado en RAG (Retrieval-Augmented Generation) para capacitar a usuarios en el uso de sistemas ERP de forma general. Desarrollado como complemento tecnológico para la feria de proyectos del trabajo de investigación *"Gestión del cambio y ética profesional en la implementación de sistemas ERP"* (Grupo 3).

## Descripción

El sistema permite a un usuario seleccionar un tema relacionado a sistemas ERP (módulos, buenas prácticas, terminología, gestión del cambio, etc.) y conversar con un asistente que responde basándose en una base de conocimiento curada, sin salirse del alcance ERP. Adicionalmente, genera evaluaciones (opción múltiple, verdadero/falso, preguntas abiertas) para medir el aprendizaje del usuario, con retroalimentación y calificación automática.

El proyecto nace de una de las hipótesis centrales de la investigación: la capacitación influye positivamente en el desempeño operativo durante la implementación de un ERP. El chatbot es un prototipo aplicado de esa hipótesis, no un producto comercial independiente.

## Funcionalidades principales

- Chat conversacional con recuperación de contexto (RAG) limitado a temas ERP.
- Selección de módulos de aprendizaje predefinidos o material propio subido por el usuario (PDF, Word, texto/markdown).
- Documentos privados o compartidos (sujetos a moderación automática antes de unirse a la base general).
- Generación de evaluaciones con corrección automática (opción múltiple, V/F) y calificación vía LLM con feedback (preguntas abiertas).
- Historial de conversaciones y evaluaciones por usuario.
- Rechazo controlado de preguntas fuera del alcance ERP.

## Arquitectura

Monolito modular. Un solo backend desplegable, organizado internamente en módulos con responsabilidades separadas:

```
Frontend (Next.js)
   │
   ▼
Backend API (FastAPI)
   ├── Módulo de Chat / RAG
   ├── Módulo de Evaluaciones
   └── Módulo de Base de Conocimiento (ingesta y moderación de documentos)
   │
   ▼
Supabase (PostgreSQL + pgvector + Auth + Storage)
```

Ver el documento de arquitectura del proyecto para el detalle de requerimientos funcionales y no funcionales.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend | Python 3.11+ con FastAPI |
| Extracción de texto / OCR (PDF) | Gemini Vision (Google AI Studio, plan de estudiante) — con `pypdf` como fallback sin internet |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`, local, 384 dimensiones, gratuito) |
| LLM generativo | Groq API (plan A, requiere internet) / Ollama local (plan B, sin internet) |
| Base de datos | Supabase (PostgreSQL + pgvector) |
| Autenticación | Supabase Auth (login básico, sin confirmación de correo) |
| Almacenamiento de archivos | Supabase Storage |
| Hosting frontend | Vercel |
| Hosting backend | Render / Railway |

No se utilizan modelos de IA de pago. Todo el stack de inteligencia artificial corre sobre opciones gratuitas o locales.

## Estructura del repositorio

```
chatbot-erp/
├── frontend/                          # Aplicación Next.js
│   ├── app/                           # App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── registro/
│   │   ├── chat/
│   │   ├── evaluaciones/
│   │   ├── perfil/
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/
│   │   └── supabase/                  # Cliente Supabase (anon key)
│   ├── public/
│   ├── .env.local
│   ├── next.config.js
│   ├── package.json
│   └── tailwind.config.ts
│
├── backend/                            # API FastAPI
│   ├── app/
│   │   ├── chat/                      # Módulo: chat conversacional (RAG)
│   │   │   ├── router.py
│   │   │   ├── retriever.py
│   │   │   └── service.py
│   │   ├── evaluaciones/              # Módulo: generación y calificación
│   │   │   ├── router.py
│   │   │   └── service.py
│   │   ├── base_conocimiento/         # Módulo: ingesta y moderación de documentos
│   │   │   ├── router.py
│   │   │   ├── extraccion.py          # PDF/Word/texto → texto plano
│   │   │   ├── chunking.py
│   │   │   ├── embeddings.py          # sentence-transformers
│   │   │   └── moderacion.py
│   │   ├── core/
│   │   │   ├── config.py              # Carga de variables de entorno
│   │   │   ├── supabase_client.py     # Cliente con service_role key
│   │   │   └── llm_provider.py        # Selector Groq / Ollama
│   │   └── main.py
│   ├── requirements.txt
│   └── .env
│
├── sql/                                 # Esquema de base de datos (Supabase)
│   └── 01_schema_chatbot_erp.sql
│
├── docs/                                # Documentación del proyecto
│   ├── requerimientos.md
│   └── diagrama_er_chatbot_erp.html
│
├── README.md
└── AGENTS.md
```

Cada subcarpeta dentro de `backend/app/` (`chat`, `evaluaciones`, `base_conocimiento`) es un módulo independiente, siguiendo la arquitectura de monolito modular: un único backend desplegable, con responsabilidades separadas internamente. `core/` centraliza configuración y clientes compartidos (Supabase, selector de proveedor LLM) para evitar duplicación entre módulos.

## Requisitos previos

- Node.js 18+
- Python 3.11+
- Cuenta de Supabase (proyecto creado, con el script de `/sql` ya ejecutado)
- Cuenta gratuita de Groq (API key) para el plan A del LLM
- Ollama instalado localmente (plan B, opcional pero recomendado tenerlo listo)

## Variables de entorno

El proyecto no debe tener credenciales ni URLs hardcodeadas. Todo se configura vía `.env`:

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM
LLM_PROVIDER=groq          # groq | ollama
GROQ_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434

# Extracción de texto / OCR
GEMINI_API_KEY=

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

Cambiar entre el plan A (nube) y el plan B (local, sin internet) es cuestión de modificar este archivo y reiniciar los servicios, sin tocar código.

## Puesta en marcha

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd chatbot-erp
```

### 2. Base de datos (Supabase)

Crear un proyecto en [supabase.com](https://supabase.com), ir a **SQL Editor → New query**, pegar el contenido de `sql/01_schema_chatbot_erp.sql` y ejecutar.

Copiar del dashboard (**Settings → API**) los valores de `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Backend (FastAPI)

```bash
cd backend

# Crear y activar entorno virtual
python -m venv venv
source venv/bin/activate          # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env              # luego completar con los valores reales

# Levantar el servidor de desarrollo
uvicorn app.main:app --reload --port 8000
```

El backend queda disponible en `http://localhost:8000` (documentación interactiva en `http://localhost:8000/docs`).

### 4. Frontend (Next.js)

En otra terminal:

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.local.example .env.local  # luego completar con los valores reales

# Levantar el servidor de desarrollo
npm run dev
```

El frontend queda disponible en `http://localhost:3000`.

### 5. Modelo generativo (LLM)

**Plan A — Groq (requiere internet):** crear una cuenta gratuita en [console.groq.com](https://console.groq.com), generar una API key, y colocarla en `GROQ_API_KEY` dentro del `.env` del backend. No requiere instalación adicional.

**Plan B — Ollama (sin internet):**

```bash
# Instalar Ollama: https://ollama.com/download

# Descargar el modelo (hacerlo con anticipación, no el día de la feria)
ollama pull llama3.1:8b

# Dejarlo corriendo en segundo plano
ollama serve
```

Luego, en el `.env` del backend, cambiar `LLM_PROVIDER=ollama`.

### 6. Verificación rápida

Con backend y frontend corriendo:

1. Abrir `http://localhost:3000`, registrarse con un usuario de prueba.
2. Seleccionar un tema predefinido e iniciar una conversación en el chat.
3. Generar una evaluación de ese tema y completarla.

Si los tres pasos funcionan sin errores, el entorno está correctamente configurado.

## Plan de contingencia para la feria

| Componente | Plan A (nube) | Plan B (local, sin internet) |
|---|---|---|
| Frontend | Vercel | `next dev` / build local |
| Backend | Render / Railway | `uvicorn` local |
| Base de datos | Supabase (nube) | Supabase CLI (`supabase start`, Docker local) |
| LLM | Groq API | Ollama local |

El plan B debe probarse completo con anticipación, no el día previo a la feria.

**Comandos para levantar Supabase en modo local (plan B):**

```bash
# Instalar Supabase CLI: https://supabase.com/docs/guides/cli

# Iniciar la instancia local (requiere Docker corriendo)
supabase start

# Aplicar el esquema a la instancia local
supabase db reset    # ejecuta automáticamente los scripts de /sql

# Una vez levantado, supabase start muestra una URL y claves locales (anon key, service_role key)
# Esos valores reemplazan a SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el .env
```

Para detener la instancia local:

```bash
supabase stop
```

## Estado del proyecto

Prototipo desarrollado como complemento a un trabajo de investigación académica. No está pensado como producto en producción; el alcance se mantiene intencionalmente acotado (ver `/docs` para el detalle de requerimientos funcionales y no funcionales priorizados).
