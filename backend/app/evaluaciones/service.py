from __future__ import annotations

import json
import logging
import random
import unicodedata
from dataclasses import dataclass

from app.chat.retriever import recuperar_contexto, construir_contexto_texto
from app.core.llm_provider import completar, LLMError
from app.core.supabase_client import supabase

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Distribución de tipos de pregunta
# ---------------------------------------------------------------------------

_DISTRIBUCION = {
    "opcion_multiple": 0.40,
    "verdadero_falso": 0.30,
    "abierta":         0.30,
}


def _calcular_distribucion(n: int) -> list[str]:
    """
    Devuelve la lista de tipos de pregunta para n preguntas,
    respetando la distribución configurada.
    """
    tipos: list[str] = []
    for tipo, fraccion in _DISTRIBUCION.items():
        cantidad = max(1, round(n * fraccion))
        tipos.extend([tipo] * cantidad)
    # Ajustar al total exacto
    while len(tipos) > n:
        tipos.pop()
    while len(tipos) < n:
        tipos.append("opcion_multiple")
    random.shuffle(tipos)
    return tipos


# ---------------------------------------------------------------------------
# Prompt de generación
# ---------------------------------------------------------------------------

_PROMPT_SISTEMA = """\
Eres un docente experto en sistemas ERP que genera evaluaciones académicas rigurosas.
Tu tarea es generar preguntas de evaluación basadas ÚNICAMENTE en el contexto de documentos
proporcionado — nunca inventar preguntas sobre contenido ausente en ese contexto.

Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin markdown,
sin bloques de código — solo el JSON puro.
"""

_PROMPT_USUARIO = """\
Genera exactamente {n_preguntas} preguntas de evaluación basadas en el siguiente contexto.

Distribución requerida de tipos:
{distribucion_str}

Contexto de documentos:
---
{contexto}
---

Reglas:
- Cada pregunta debe ser directamente verificable con el contexto provisto.
- Nunca incluyas información que no esté en el contexto.
- Las preguntas deben ser claras, sin ambigüedades.
- Para "opcion_multiple": exactamente 4 opciones, una sola correcta. Formato de opciones: ["a) texto", "b) texto", "c) texto", "d) texto"]. respuesta_correcta debe ser la letra: "a", "b", "c" o "d".
- Para "verdadero_falso": opciones fijas ["Verdadero", "Falso"]. respuesta_correcta debe ser "Verdadero" o "Falso".
- Para "abierta": opciones es null y respuesta_correcta es null.

Devuelve SOLO este JSON (sin texto antes ni después):
{{
  "preguntas": [
    {{
      "tipo": "opcion_multiple" | "verdadero_falso" | "abierta",
      "enunciado": "texto de la pregunta",
      "opciones": ["a) ...", "b) ...", "c) ...", "d) ..."] | ["Verdadero", "Falso"] | null,
      "respuesta_correcta": "a" | "b" | "c" | "d" | "Verdadero" | "Falso" | null
    }}
  ]
}}
"""


def _construir_prompt(n_preguntas: int, contexto: str) -> list[dict[str, str]]:
    tipos = _calcular_distribucion(n_preguntas)
    conteo = {t: tipos.count(t) for t in set(tipos)}
    distribucion_str = "\n".join(
        f"- {t.replace('_', ' ')}: {c} pregunta{'s' if c > 1 else ''}"
        for t, c in conteo.items()
    )
    prompt = _PROMPT_USUARIO.format(
        n_preguntas=n_preguntas,
        distribucion_str=distribucion_str,
        contexto=contexto,
    )
    return [
        {"role": "system", "content": _PROMPT_SISTEMA},
        {"role": "user",   "content": prompt},
    ]


# ---------------------------------------------------------------------------
# Parsing y validación del JSON del LLM
# ---------------------------------------------------------------------------

def _parsear_preguntas(texto: str) -> list[dict]:
    """
    Extrae y valida el JSON de preguntas devuelto por el LLM.
    Lanza ValueError si el formato no es válido.
    """
    # Limpiar markdown si el LLM lo incluyó a pesar de la instrucción
    texto = texto.strip()
    if texto.startswith("```"):
        lineas = texto.splitlines()
        texto = "\n".join(
            l for l in lineas
            if not l.strip().startswith("```")
        ).strip()

    try:
        data = json.loads(texto)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON malformado: {e}") from e

    preguntas = data.get("preguntas")
    if not isinstance(preguntas, list) or not preguntas:
        raise ValueError("El JSON no contiene la clave 'preguntas' o está vacía.")

    tipos_validos = {"opcion_multiple", "verdadero_falso", "abierta"}
    for i, p in enumerate(preguntas):
        if p.get("tipo") not in tipos_validos:
            raise ValueError(f"Pregunta {i+1}: tipo inválido '{p.get('tipo')}'.")
        if not p.get("enunciado", "").strip():
            raise ValueError(f"Pregunta {i+1}: enunciado vacío.")
        if p["tipo"] != "abierta" and not p.get("respuesta_correcta"):
            raise ValueError(f"Pregunta {i+1}: falta respuesta_correcta para tipo '{p['tipo']}'.")

    return preguntas


# ---------------------------------------------------------------------------
# Corrección automática (opción múltiple y verdadero/falso)
# ---------------------------------------------------------------------------

def _normalizar(texto: str) -> str:
    """
    Normaliza un texto para comparación tolerante:
    - Minúsculas
    - Sin acentos (NFD → solo ASCII base)
    - Sin espacios al inicio/fin
    - Espacios internos colapsados a uno
    """
    texto = texto.strip().lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = " ".join(texto.split())
    return texto


def corregir_automatica(pregunta: dict, respuesta_dada: str | None) -> float:
    """
    Compara la respuesta del usuario con pregunta["respuesta_correcta"].
    Solo válida para tipos "opcion_multiple" y "verdadero_falso".

    Devuelve:
        1.0  si la respuesta es correcta (normalizada)
        0.0  si es incorrecta, nula o el tipo no aplica

    No llama al LLM — comparación determinista y local.
    """
    tipo = pregunta.get("tipo")
    if tipo not in ("opcion_multiple", "verdadero_falso"):
        raise ValueError(
            f"corregir_automatica solo aplica a opcion_multiple y verdadero_falso, no a '{tipo}'."
        )

    correcta = pregunta.get("respuesta_correcta")
    if not correcta or not respuesta_dada:
        return 0.0

    return 1.0 if _normalizar(respuesta_dada) == _normalizar(correcta) else 0.0


# ---------------------------------------------------------------------------
# Calificación con feedback vía LLM (preguntas abiertas)
# ---------------------------------------------------------------------------

_PROMPT_CALIFICAR_SISTEMA = """\
Eres un docente evaluador experto en sistemas ERP. Tu tarea es calificar la respuesta
de un estudiante a una pregunta abierta, comparándola contra el contexto del material
de estudio provisto.

Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin markdown.
"""

_PROMPT_CALIFICAR_USUARIO = """\
Califica la siguiente respuesta de un estudiante.

Pregunta:
{enunciado}

Contexto del material de estudio (fuente de verdad):
---
{contexto}
---

Respuesta del estudiante:
\"\"\"{respuesta_dada}\"\"\"

Instrucciones de calificación:
- Asigna un puntaje entre 0.0 y 1.0 (donde 1.0 = respuesta completa y correcta).
  - 0.0: respuesta incorrecta, en blanco, o completamente irrelevante.
  - 0.3–0.5: respuesta parcial con errores importantes o conceptos incompletos.
  - 0.6–0.8: respuesta mayormente correcta pero con omisiones o imprecisiones menores.
  - 0.9–1.0: respuesta completa, precisa y bien fundamentada en el material.
- Escribe un feedback específico (2-4 oraciones) que:
  - Señale exactamente qué acertó el estudiante y qué le faltó o tuvo incorrecto.
  - Sea constructivo y útil para que el estudiante entienda su error.
  - No sea genérico (evitar "buena respuesta" o "incorrecto" sin explicación).
  - Se base únicamente en el contexto provisto, no en conocimiento externo.
- Responde siempre en español.

Devuelve SOLO este JSON (sin texto antes ni después):
{{"puntaje": <número entre 0.0 y 1.0>, "feedback": "<texto del feedback>"}}
"""


@dataclass
class ResultadoAbierta:
    puntaje: float       # 0.0 – 1.0
    feedback: str


def calificar_abierta(
    pregunta: dict,
    respuesta_dada: str | None,
    contexto_tema: str,
) -> ResultadoAbierta:
    """
    Califica una pregunta abierta usando el LLM.

    Evalúa la respuesta del estudiante contra el contexto real del tema.
    Devuelve puntaje (0.0–1.0) y feedback específico y constructivo.

    Si la respuesta está vacía/None → puntaje 0.0 sin llamar al LLM.
    Si el LLM devuelve JSON malformado → reintento; si persiste → 0.0 con feedback genérico.
    Lanza LLMError si el proveedor falla (se propaga al router → HTTP 503).
    """
    if pregunta.get("tipo") != "abierta":
        raise ValueError(
            f"calificar_abierta solo aplica a preguntas abiertas, no a '{pregunta.get('tipo')}'."
        )

    # Respuesta vacía → puntaje 0 sin LLM
    if not respuesta_dada or not respuesta_dada.strip():
        return ResultadoAbierta(
            puntaje=0.0,
            feedback="No se proporcionó una respuesta. Intentá responder con tus propias palabras basándote en el material del tema.",
        )

    messages = [
        {"role": "system", "content": _PROMPT_CALIFICAR_SISTEMA},
        {
            "role": "user",
            "content": _PROMPT_CALIFICAR_USUARIO.format(
                enunciado=pregunta["enunciado"],
                contexto=contexto_tema,
                respuesta_dada=respuesta_dada.strip(),
            ),
        },
    ]

    ultimo_error: Exception | None = None
    for intento in range(1, 3):
        try:
            texto_llm = completar(messages, temperature=0.2, max_tokens=400)

            # Limpiar posible markdown
            texto = texto_llm.strip()
            if texto.startswith("```"):
                texto = "\n".join(
                    l for l in texto.splitlines() if not l.strip().startswith("```")
                ).strip()

            data = json.loads(texto)
            puntaje = float(data["puntaje"])
            feedback = str(data["feedback"]).strip()

            # Clamp al rango válido
            puntaje = max(0.0, min(1.0, puntaje))

            if not feedback:
                raise ValueError("feedback vacío en la respuesta del LLM")

            logger.info(
                "[EVAL] Calificación abierta intento=%d puntaje=%.2f",
                intento, puntaje,
            )
            return ResultadoAbierta(puntaje=puntaje, feedback=feedback)

        except LLMError:
            raise  # propagar — el router lo convierte en 503
        except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
            ultimo_error = e
            logger.warning("[EVAL] JSON calificación malformado intento %d: %s", intento, e)

    # Ambos intentos fallaron
    logger.error("[EVAL] No se pudo parsear calificación tras 2 intentos: %s", ultimo_error)
    return ResultadoAbierta(
        puntaje=0.0,
        feedback="No fue posible calificar esta respuesta automáticamente. Un docente la revisará.",
    )


# ---------------------------------------------------------------------------
# Función principal pública
# ---------------------------------------------------------------------------

@dataclass
class EvaluacionGenerada:
    evaluacion_id: str
    titulo: str
    tema_id: str
    preguntas: list[dict]   # incluye respuesta_correcta (solo para el backend)


def generar_evaluacion(
    tema_id: str,
    n_preguntas: int = 8,
    titulo: str | None = None,
) -> EvaluacionGenerada:
    """
    Genera una evaluación para el tema dado:
    1. Recupera chunks representativos del tema.
    2. Pide al LLM que genere preguntas en JSON.
    3. Parsea y valida el JSON (un reintento si falla).
    4. Persiste evaluacion + preguntas en Supabase.
    5. Devuelve la evaluación generada con sus preguntas.

    Lanza LLMError si el proveedor falla.
    Lanza ValueError si el JSON sigue malformado tras el reintento.
    Lanza RuntimeError si el tema no tiene contexto suficiente.
    """
    # --- 1. Contexto del tema ---
    # Usamos 3 queries complementarias para cubrir distintas partes del contenido
    queries = [
        "conceptos fundamentales y definiciones del tema",
        "implementación, fases y proceso del tema",
        "beneficios, problemas y factores críticos del tema",
    ]
    todos_los_chunks: list = []
    vistos: set[str] = set()
    for q in queries:
        chunks = recuperar_contexto(q, tema_id=tema_id, top_k=4, umbral=0.30)
        for c in chunks:
            if c.id not in vistos:
                todos_los_chunks.append(c)
                vistos.add(c.id)

    if not todos_los_chunks:
        raise RuntimeError(
            f"El tema {tema_id} no tiene chunks indexados. "
            "Verificá que existan documentos aprobados para ese tema."
        )

    # Limitar a los top 10 chunks más relevantes para no exceder el contexto
    todos_los_chunks.sort(key=lambda c: c.similitud, reverse=True)
    chunks_usados = todos_los_chunks[:10]
    contexto = construir_contexto_texto(chunks_usados, max_chars=7000)

    logger.info(
        "[EVAL] Generando evaluación: tema=%s n=%d chunks_usados=%d",
        tema_id, n_preguntas, len(chunks_usados),
    )

    # --- 2. Llamar al LLM (con 1 reintento si JSON malformado) ---
    messages = _construir_prompt(n_preguntas, contexto)
    preguntas_data: list[dict] | None = None
    ultimo_error: Exception | None = None

    for intento in range(1, 3):  # máx 2 intentos
        try:
            texto_llm = completar(messages, temperature=0.4, max_tokens=2500)
            preguntas_data = _parsear_preguntas(texto_llm)
            logger.info("[EVAL] JSON parseado OK en intento %d (%d preguntas)", intento, len(preguntas_data))
            break
        except ValueError as e:
            ultimo_error = e
            logger.warning("[EVAL] JSON malformado intento %d: %s", intento, e)
        except LLMError:
            raise  # LLMError se propaga directo (el router la convierte en 503)

    if preguntas_data is None:
        raise ValueError(
            f"El LLM devolvió JSON inválido después de 2 intentos. "
            f"Último error: {ultimo_error}"
        )

    # --- 3. Persistir evaluacion ---
    tema_resp = supabase.table("tema").select("nombre").eq("id", tema_id).single().execute()
    nombre_tema = tema_resp.data["nombre"] if tema_resp.data else "Tema"
    titulo_final = titulo or f"Evaluación — {nombre_tema}"

    eval_resp = supabase.table("evaluacion").insert({
        "tema_id": tema_id,
        "titulo": titulo_final,
    }).execute()
    evaluacion_id = eval_resp.data[0]["id"]

    # --- 4. Persistir preguntas ---
    filas_preguntas = []
    for p in preguntas_data:
        opciones = p.get("opciones")
        filas_preguntas.append({
            "evaluacion_id": evaluacion_id,
            "tipo": p["tipo"],
            "enunciado": p["enunciado"].strip(),
            "opciones": opciones,
            "respuesta_correcta": p.get("respuesta_correcta"),
        })

    preg_resp = supabase.table("pregunta").insert(filas_preguntas).execute()
    preguntas_guardadas = preg_resp.data

    logger.info(
        "[EVAL] Evaluación persistida: id=%s preguntas=%d",
        evaluacion_id, len(preguntas_guardadas),
    )

    return EvaluacionGenerada(
        evaluacion_id=evaluacion_id,
        titulo=titulo_final,
        tema_id=tema_id,
        preguntas=preguntas_guardadas,
    )
