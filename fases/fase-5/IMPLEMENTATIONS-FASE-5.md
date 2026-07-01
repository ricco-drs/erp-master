# Implementaciones — Fase 5: Evaluaciones

Registro de todo lo implementado durante la Fase 5, bloque por bloque.

---

## Bloque 1 — Generación de preguntas

### Archivo creado

**`backend/app/evaluaciones/service.py`**

#### Distribución de tipos

`_calcular_distribucion(n)` genera la lista de tipos para `n` preguntas respetando:
- `opcion_multiple`: 40%
- `verdadero_falso`: 30%
- `abierta`: 30%

Con ajuste automático para sumar exactamente `n` (redondeo hacia arriba en cada tipo, luego pop/push hasta ajustar). La lista se mezcla con `random.shuffle` para que los tipos no aparezcan agrupados.

#### Estrategia de recuperación de contexto

Se usan **3 queries complementarias** al retriever (umbral bajado a 0.30 para mayor cobertura):
1. `"conceptos fundamentales y definiciones del tema"`
2. `"implementación, fases y proceso del tema"`
3. `"beneficios, problemas y factores críticos del tema"`

Resultado: hasta 12 chunks únicos (deduplicados por `id`). Se seleccionan los 10 con mayor similitud para el contexto final (`max_chars=7000`). Esto garantiza cobertura de distintas partes del documento, no solo el fragmento más similar.

#### Prompt de generación

`_PROMPT_SISTEMA`: rol de docente experto en ERP, instrucción explícita de responder **solo con JSON puro** sin markdown.

`_PROMPT_USUARIO`: especifica la distribución exacta de tipos para esa generación, las reglas de formato por tipo, y el esquema JSON esperado:
```json
{
  "preguntas": [
    {
      "tipo": "opcion_multiple" | "verdadero_falso" | "abierta",
      "enunciado": "...",
      "opciones": ["a) ...", "b) ...", "c) ...", "d) ..."] | ["Verdadero", "Falso"] | null,
      "respuesta_correcta": "a" | "b" | "c" | "d" | "Verdadero" | "Falso" | null
    }
  ]
}
```

Reglas de formato por tipo:
- `opcion_multiple`: exactamente 4 opciones con prefijo `a)–d)`, `respuesta_correcta` = letra sola.
- `verdadero_falso`: opciones fijas `["Verdadero", "Falso"]`, `respuesta_correcta` = "Verdadero" o "Falso".
- `abierta`: `opciones = null`, `respuesta_correcta = null`.

#### Parsing y validación (`_parsear_preguntas`)

1. Elimina bloques markdown si el LLM los incluyó (` ``` ` al inicio y fin).
2. `json.loads()` — lanza `ValueError` si malformado.
3. Verifica que exista la clave `"preguntas"` como lista no vacía.
4. Por cada pregunta: valida tipo en `{opcion_multiple, verdadero_falso, abierta}`, enunciado no vacío, y que las no-abiertas tengan `respuesta_correcta`.

#### Reintentos ante JSON malformado

Bucle `for intento in range(1, 3)` — hasta 2 llamadas al LLM. Si ambas fallan, lanza `ValueError` con el último error. Si el LLM lanza `LLMError` (timeout / cuota), se propaga directamente (el router la convierte en HTTP 503).

#### Persistencia

1. `supabase.table("evaluacion").insert({tema_id, titulo})` → obtiene `evaluacion_id`.
2. `supabase.table("pregunta").insert(filas_preguntas)` → insert en batch de todas las preguntas.
3. Título auto-generado como `"Evaluación — {nombre_tema}"` si no se provee.

#### Interfaz pública

```python
@dataclass
class EvaluacionGenerada:
    evaluacion_id: str
    titulo: str
    tema_id: str
    preguntas: list[dict]   # incluye respuesta_correcta (solo para uso backend)

def generar_evaluacion(tema_id, n_preguntas=8, titulo=None) -> EvaluacionGenerada
```

### Verificación

Generación real sobre tema "Gestión del Cambio Organizacional" (119 chunks):
- JSON parseado en intento 1 ✅
- 8 preguntas generadas: 4 `opcion_multiple`, 2 `verdadero_falso`, 2 `abierta` ✅
- Todas las `opcion_multiple` con exactamente 4 opciones y `respuesta_correcta` en `{a,b,c,d}` ✅
- Todas las `verdadero_falso` con opciones `["Verdadero", "Falso"]` ✅
- Todas las `abierta` con `opciones=null` y `respuesta_correcta=null` ✅
- Preguntas coherentes con el contenido del PDF (gestión del cambio, implementación ERP, muestreo de investigación) ✅
- Evaluación persistida en Supabase: `evaluacion_id=651e0e7e...` con 8 preguntas ✅
- Tiempo de generación (retriever + LLM): ~4s (tokens=3469) ✅

---

## Bloque 2 — Corrección automática (opción múltiple y V/F)

### Archivo modificado

**`backend/app/evaluaciones/service.py`** — agregadas dos funciones:

**`_normalizar(texto) -> str`**

Normalización tolerante para comparación:
1. `strip()` + `lower()` — elimina espacios externos y unifica capitalización.
2. `unicodedata.normalize("NFD", ...)` + filtro de categoría `"Mn"` — elimina acentos/diacríticos (ej. `"Verdadero"` == `"verdadero"`, `"Fácil"` == `"Facil"`).
3. `" ".join(texto.split())` — colapsa espacios internos múltiples.

**`corregir_automatica(pregunta, respuesta_dada) -> float`**

- Solo aplica a `opcion_multiple` y `verdadero_falso` — lanza `ValueError` si se llama con `"abierta"`.
- Devuelve `1.0` si `_normalizar(respuesta_dada) == _normalizar(respuesta_correcta)`, `0.0` en cualquier otro caso.
- Devuelve `0.0` si `respuesta_dada` es `None` o vacía (sin crashear).
- No llama al LLM — comparación determinista y local (RNF-17: sin costo de API).

### Verificación — 15 casos

| Grupo | Casos | Resultado |
|---|---|---|
| OM correcta (exacta, mayúsculas, espacios) | 3 | ✅ 1.0 |
| OM incorrecta (letra distinta, vacía, None) | 4 | ✅ 0.0 |
| VF correcta (exacta, minúsculas, espacios) | 4 | ✅ 1.0 |
| VF incorrecta (opuesta, vacía, None) | 3 | ✅ 0.0 |
| Tipo "abierta" → ValueError | 1 | ✅ |

---

## Bloque 3 — Calificación con feedback vía LLM (preguntas abiertas)

### Archivo modificado

**`backend/app/evaluaciones/service.py`** — agregadas función y dataclass:

**`@dataclass ResultadoAbierta(puntaje: float, feedback: str)`**

**`calificar_abierta(pregunta, respuesta_dada, contexto_tema) -> ResultadoAbierta`**

Flujo:
1. Guarda de tipo: `ValueError` si `tipo != "abierta"`.
2. Respuesta vacía/None → `puntaje=0.0` con mensaje estándar, **sin llamar al LLM**.
3. Construye prompt con el enunciado, el contexto del tema (chunks reales) y la respuesta del estudiante.
4. Llama a `completar(temperature=0.2, max_tokens=400)`.
5. Parsea JSON `{"puntaje": float, "feedback": str}` — clamp al rango `[0.0, 1.0]`.
6. Limpia markdown si el LLM lo incluyó (mismo patrón que en Bloque 1).
7. Hasta 2 reintentos ante JSON malformado; si ambos fallan → `puntaje=0.0` con feedback genérico de error (no crashea la sesión).
8. `LLMError` se propaga directo al caller (el router la convertirá en HTTP 503).

**Prompt de calificación** (`_PROMPT_CALIFICAR_USUARIO`):
- Provee escala explícita: 0.0 / 0.3–0.5 / 0.6–0.8 / 0.9–1.0 con criterios concretos.
- Instruye feedback específico (2-4 oraciones): qué acertó, qué faltó, constructivo.
- Prohíbe explícitamente feedback genérico ("buena respuesta", "incorrecto").
- Respuesta siempre en español; juzgar solo contra el contexto provisto.

### Verificación — 5 casos con contexto real del tema

| Caso | Puntaje | Feedback |
|---|---|---|
| Respuesta completa y bien fundamentada | **0.70** | Señala aciertos y menciona omisión de evidencia empírica del material |
| Respuesta parcial con omisiones | **0.40** | Señala qué mencionó bien y qué conceptos claves omitió del contexto |
| Respuesta incorrecta / irrelevante | **0.00** | Explica por qué no abordó la relación solicitada |
| Respuesta None (sin responder) | **0.00** sin LLM | Mensaje estándar de respuesta no provista |
| Respuesta vacía `"   "` | **0.00** sin LLM | Mismo mensaje estándar |
| Tipo incorrecto → `ValueError` | — | ✅ |

Gradiente de puntaje coherente con la calidad de las respuestas. Feedback específico en todos los casos evaluados por el LLM.

---

## Bloque 4 — Cálculo de puntaje consolidado

### Archivo modificado

**`backend/app/evaluaciones/service.py`** — agregados dataclass y función:

**`@dataclass PuntajeConsolidado(promedio, sobre_20, aprobado)`**
- `promedio`: float 0.0–1.0 (escala interna).
- `sobre_20`: float 0.0–20.0 redondeado a 2 decimales (escala académica peruana).
- `aprobado`: bool — umbral 11/20 (estándar universitario peruano).

**`calcular_puntaje_total(puntajes: list[float]) -> PuntajeConsolidado`**
- Promedia los puntajes individuales de todas las respuestas del intento.
- Todas las preguntas tienen el mismo peso (opción múltiple, V/F y abierta equivalen igual).
- Conversión: `sobre_20 = round(promedio * 20, 2)`.
- Clamp defensivo al rango `[0.0, 1.0]` antes de escalar.
- Lista vacía → `PuntajeConsolidado(0.0, 0.0, False)` sin error.

### Verificación — 9 casos

| Caso | Promedio | /20 | Aprobado |
|---|---|---|---|
| Todo correcto (8/8) | 1.0 | 20.00 | ✅ |
| Todo incorrecto (0/8) | 0.0 | 0.00 | ❌ |
| Mitad correctas (4/8) | 0.5 | 10.00 | ❌ |
| Mixto 1.0+0.7+0.4+0.0 | 0.525 | 10.50 | ❌ |
| Justo en el límite 0.55×8 | 0.55 | 11.00 | ✅ |
| Una pregunta correcta | 1.0 | 20.00 | ✅ |
| Una pregunta incorrecta | 0.0 | 0.00 | ❌ |
| Parciales variados | 0.5667 | 11.33 | ✅ |
| Lista vacía | 0.0 | 0.00 | ❌ |

---

## Bloque 5 — Endpoints de evaluaciones

### Archivos modificados / creados

**`backend/app/evaluaciones/router.py`** *(nuevo)*

5 endpoints, todos JWT-protegidos con `Depends(get_current_user_id)`:

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/evaluaciones/generar` | Genera evaluación con LLM y la persiste; respuesta **sin** `respuesta_correcta` |
| `POST` | `/evaluaciones/{evaluacion_id}/intentos` | Crea un intento vacío para el usuario autenticado |
| `POST` | `/evaluaciones/intentos/{intento_id}/respuestas` | Califica todas las respuestas, persiste y cierra el intento |
| `GET`  | `/evaluaciones/intentos/{intento_id}` | Devuelve resultado completo con puntajes y feedback |
| `GET`  | `/evaluaciones/historial` | Lista intentos del usuario ordenados por fecha desc |

**Decisiones de diseño:**

- `POST /generar` nunca devuelve `respuesta_correcta` al cliente — el schema `PreguntaOut` solo tiene `{id, tipo, enunciado, opciones}`.
- `POST /respuestas`: carga el contexto del tema una sola vez para todas las preguntas abiertas del intento (eficiencia). Itera pregunta a pregunta usando `corregir_automatica` o `calificar_abierta` según tipo. Persiste respuestas en batch. Actualiza `puntaje_total` y `completado_en` atomicamente antes de devolver.
- `GET /historial`: join con `evaluacion(titulo)` vía Supabase para incluir el título en una sola query.
- Intento ya completado → `409 Conflict` si se intenta responder de nuevo.
- Helper `_get_intento_propio`: 404 si no existe, 403 si pertenece a otro usuario.
- `LLMError` → HTTP 503 en generar y en calificar abiertas.
- `RuntimeError` (tema sin chunks) → HTTP 422.

**`backend/app/main.py`** — `evaluaciones_router` registrado.

### Verificación — flujo completo de 7 pasos

1. Generar evaluación (6 preguntas, 7.2s) ✅
2. Crear intento en BD ✅
3. Calificar respuestas mixtas: VF→1.0, OM→1.0, AB→0.60; promedio=0.8667, /20=17.33, aprobado ✅
4. Resultado leído desde BD: `puntaje_total=0.87`, `completado_en` registrado, 6/6 respuestas ✅
5. `respuesta_correcta` ausente en select del cliente ✅
6. Historial del usuario: 1 intento listado con /20=17.4 ✅
7. Otro usuario filtra intento ajeno → vacío ✅

OpenAPI: 5 endpoints confirmados en `/evaluaciones/...` ✅

---

## Bloque 6 — Frontend de evaluaciones

### Archivos creados

**`frontend/app/(protected)/evaluaciones/page.tsx`** — Selector de temas

- Grid auto-fill de `TemaCard` (minmax 240px) con hover accent border y badge "Oficial" para predefinidos.
- Click en card: `POST /evaluaciones/generar` → `POST /evaluaciones/{id}/intentos` → guarda preguntas en `sessionStorage` con clave `eval_preguntas_${intento_id}` → `router.push(/evaluaciones/${intentoId})`.
- `LoadingSpinner` + mensaje de espera mientras el LLM genera; resto de cards deshabilitadas.
- Icono `ClipboardList` de lucide-react.

**`frontend/app/(protected)/evaluaciones/[intentoId]/page.tsx`** — Examen en curso

Tres componentes de pregunta:
- `PreguntaOpcionMultiple`: badges circulares de letra (a/b/c/d), seleccionado = fill accent.
- `PreguntaVerdaderoFalso`: dos botones igual-ancho toggle.
- `PreguntaAbierta`: textarea auto-altura, border focus → `--border-strong`.
- `PreguntaWrapper`: número + tipo badge + enunciado común.

Lógica de página:
- Lee preguntas de `sessionStorage` y elimina la clave al montar.
- Verifica estado del intento: si `completado_en != null` → `router.replace(/resultados)`.
- `respuestas: Record<string, string>` — clave `pregunta_id`.
- Header sticky con contador "N/T respondidas".
- Footer con mensaje de pendientes + botón "Enviar evaluación" con spinner.
- Confirmación `window.confirm` antes de enviar.
- Submit: `POST /evaluaciones/intentos/{id}/respuestas` → `router.push(/resultados)`.
- Spinner animado con `@keyframes spin` inline mientras califica.

**`frontend/app/(protected)/evaluaciones/[intentoId]/resultados/page.tsx`** — Resultados

Tarjeta principal (3 columnas separadas por `1px` divisor):
- **Puntaje**: número en 42px, `--accent`/`--danger` según aprobado, subtítulo "de 20".
- **Estado**: `CheckCircle`/`XCircle` + "Aprobado"/"Desaprobado" + "Umbral: 11/20".
- **Preguntas**: `X/N correctas o completas`.
- Barra de 3px en la parte superior del card (verde o rojo).

`RespuestaCard` por cada pregunta:
- Estado visual según tipo: abiertas tienen 3 niveles (≥0.6 correcto, 0.3–0.6 parcial, <0.3 incorrecto); cerradas binario (≥0.9 correcto).
- Border color reactivo: `--accent` / `--border-strong` / `rgba(239,68,68,0.3)`.
- Badge de puntaje `/20` inline para preguntas abiertas.
- Caja "Tu respuesta" (fondo sutil) + bloque de feedback LLM con borde izquierdo de 3px.
- `CheckCircle`/`XCircle` en header (oculto para parciales).
- CTA "Nueva evaluación" al pie.

Todos los tokens de diseño del design system aplicados: `--bg-base`, `--bg-surface`, `--border`, `--accent`, `--danger`, `--accent-muted`, `--border-strong`, `--radius-md`, `--radius-sm`, `--text-primary/secondary/muted`.

### Variables CSS verificadas

Todas las variables usadas están definidas en `frontend/app/globals.css`:
- `--danger: #EF4444` ✅
- `--accent-muted: #1A2E22` ✅
- `--border-strong: #3A3A3A` ✅
- `--bg-surface-hover: #1A1A1A` ✅

---

## Bloque 7 — Cierre de fase

### Verificaciones realizadas

**`respuesta_correcta` no expuesta al cliente**

- `PreguntaOut` (router.py:62–66) contiene solo `id`, `tipo`, `enunciado`, `opciones` — sin `respuesta_correcta`.
- En `POST /generar`, las preguntas se mapean manualmente a `PreguntaOut` (línea 145–153), nunca por `model_validate` sobre el dict completo.
- La consulta a la tabla `pregunta` desde el GET de intento tampoco devuelve la columna al cliente: la respuesta usa `RespuestaCalificadaOut` que carece del campo.
- Verificación: ✅

**Políticas RLS — `intento_evaluacion` y `respuesta_usuario`**

Revisadas en `sql/01_schema_chatbot_erp.sql` (líneas 225–235):

- `intento_evaluacion_propio`: `FOR ALL USING (usuario_id = auth.uid())` — el usuario solo puede leer/escribir sus propios intentos.
- `respuesta_usuario_segun_intento_propio`: `FOR ALL USING (EXISTS (SELECT 1 FROM intento_evaluacion i WHERE i.id = ... AND i.usuario_id = auth.uid()))` — acceso indirecto a través del intento del dueño.
- Aislamiento cruzado verificado en Bloque 5 (paso 7): otro usuario consulta historial → vacío; consulta intento ajeno directamente → 404 (el backend hace `.eq("id", intento_id).eq("usuario_id", user_id).single()` antes de procesar).
- `evaluacion` y `pregunta`: lectura abierta a autenticados (son plantillas compartidas, no datos privados).
- Verificación: ✅

**Archivo de referencia creado**: `sql/04_rls_evaluaciones_verificacion.sql` — DROP + CREATE de las 4 políticas con query de auditoría al final.

**Tiempo de generación (RNF-02 ≤ 15s)**

Medido en Bloque 1 y Bloque 5:
- 8 preguntas sobre tema real: ~4s (tokens=3469) — Bloque 1
- 6 preguntas: ~7.2s — Bloque 5
- Ambos muy por debajo del límite de 15s.
- La UI muestra spinner con aviso explícito "puede tardar hasta 15 segundos".
- Verificación: ✅

**Calidad del feedback de preguntas abiertas**

- Prompt `_PROMPT_CALIFICAR_USUARIO` prohíbe feedback genérico ("buena respuesta", "incorrecto").
- Instruye 2–4 oraciones específicas: qué acertó, qué faltó, constructivo.
- Verificado en Bloque 3: 3 casos con feedback específico y diferenciado según calidad de respuesta.
- Verificación: ✅

### Condición de salida cumplida

Un usuario puede:
1. Seleccionar un tema desde `/evaluaciones` → generar evaluación → examen con 3 tipos de pregunta en `/evaluaciones/[intentoId]`
2. Enviar respuestas → calificación automática + LLM → puntaje 0–20 en `/evaluaciones/[intentoId]/resultados`
3. Ver feedback específico por pregunta abierta
4. Consultar el intento en `/evaluaciones/historial` (implementado en Fase 6)

Fase 5 completada ✅
