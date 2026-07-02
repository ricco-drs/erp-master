from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.core.llm_provider import LLMError
from app.evaluaciones.service import (
    generar_evaluacion,
    generar_evaluacion_modulo,
    corregir_automatica,
    calificar_abierta,
    calcular_puntaje_total,
)
from app.chat.retriever import recuperar_contexto, construir_contexto_texto

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/evaluaciones", tags=["evaluaciones"])

_UMBRAL_APROBACION = 0.55  # 11/20

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_intento_propio(intento_id: str, user_id: str) -> dict:
    """404 si no existe, 403 si pertenece a otro usuario."""
    resp = (
        supabase.table("intento_evaluacion")
        .select("id, usuario_id, evaluacion_id, puntaje_total, completado_en")
        .eq("id", intento_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Intento no encontrado.")
    if resp.data["usuario_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés acceso a este intento.")
    return resp.data


def _get_preguntas(evaluacion_id: str) -> list[dict]:
    resp = (
        supabase.table("pregunta")
        .select("id, tipo, enunciado, opciones, respuesta_correcta")
        .eq("evaluacion_id", evaluacion_id)
        .execute()
    )
    return resp.data or []


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GenerarEvaluacionRequest(BaseModel):
    tema_id: str
    n_preguntas: int = 8


class GenerarEvaluacionModuloRequest(BaseModel):
    n_preguntas: int = 12


class PreguntaOut(BaseModel):
    id: str
    tipo: str
    enunciado: str
    opciones: list[str] | None


class GenerarEvaluacionResponse(BaseModel):
    evaluacion_id: str
    titulo: str
    preguntas: list[PreguntaOut]


class CrearIntentoResponse(BaseModel):
    intento_id: str
    evaluacion_id: str


class RespuestaItem(BaseModel):
    pregunta_id: str
    respuesta_dada: str | None = None


class EnviarRespuestasRequest(BaseModel):
    respuestas: list[RespuestaItem]


class RespuestaCalificadaOut(BaseModel):
    pregunta_id: str
    tipo: str
    enunciado: str
    respuesta_dada: str | None
    puntaje_obtenido: float
    feedback_llm: str | None


class ResultadoIntentoResponse(BaseModel):
    intento_id: str
    evaluacion_id: str
    puntaje_total: float | None
    sobre_20: float | None
    aprobado: bool | None
    completado_en: str | None
    respuestas: list[RespuestaCalificadaOut]


class HistorialItemOut(BaseModel):
    intento_id: str
    evaluacion_id: str
    titulo_evaluacion: str | None
    puntaje_total: float | None
    sobre_20: float | None
    aprobado: bool | None
    completado_en: str | None


# ---------------------------------------------------------------------------
# POST /evaluaciones/generar
# ---------------------------------------------------------------------------

@router.post("/generar", status_code=status.HTTP_201_CREATED, response_model=GenerarEvaluacionResponse)
async def generar(
    body: GenerarEvaluacionRequest,
    user_id: str = Depends(get_current_user_id),
):
    logger.info(
        "[EVAL] POST /generar — tema_id=%s n_preguntas=%d user=%s",
        body.tema_id, body.n_preguntas, user_id,
    )

    # Verificar que el tema existe
    tema_resp = supabase.table("tema").select("id, nombre").eq("id", body.tema_id).single().execute()
    if not tema_resp.data:
        logger.error("[EVAL] tema_id=%s no existe en la tabla tema", body.tema_id)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El tema indicado no existe.")

    logger.info("[EVAL] Tema encontrado: %s", tema_resp.data.get("nombre"))

    if not (3 <= body.n_preguntas <= 15):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "n_preguntas debe estar entre 3 y 15.")

    try:
        ev = generar_evaluacion(body.tema_id, n_preguntas=body.n_preguntas)
    except RuntimeError as e:
        logger.error(
            "[EVAL] Sin chunks indexados — tema_id=%s error=%s",
            body.tema_id, e,
        )
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    except ValueError as e:
        logger.error(
            "[EVAL] JSON inválido del LLM — tema_id=%s error=%s",
            body.tema_id, e,
        )
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Error generando preguntas: {e}")
    except LLMError as e:
        logger.error("[EVAL] LLM no disponible — tema_id=%s error=%s", body.tema_id, e)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"El asistente no está disponible: {e}")

    # Nunca exponer respuesta_correcta al cliente
    preguntas_out = [
        PreguntaOut(
            id=p["id"],
            tipo=p["tipo"],
            enunciado=p["enunciado"],
            opciones=p.get("opciones"),
        )
        for p in ev.preguntas
    ]

    return GenerarEvaluacionResponse(
        evaluacion_id=ev.evaluacion_id,
        titulo=ev.titulo,
        preguntas=preguntas_out,
    )


# ---------------------------------------------------------------------------
# POST /evaluaciones/modulo/{modulo_id}/generar — evaluación final de módulo
# ---------------------------------------------------------------------------

@router.post(
    "/modulo/{modulo_id}/generar",
    status_code=status.HTTP_201_CREATED,
    response_model=GenerarEvaluacionResponse,
)
async def generar_modulo(
    modulo_id: str,
    body: GenerarEvaluacionModuloRequest,
    user_id: str = Depends(get_current_user_id),
):
    logger.info(
        "[EVAL] POST /modulo/%s/generar — n_preguntas=%d user=%s",
        modulo_id, body.n_preguntas, user_id,
    )

    # Verificar que el módulo existe
    mod_resp = supabase.table("modulo").select("id, nombre").eq("id", modulo_id).single().execute()
    if not mod_resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Módulo no encontrado.")

    if not (8 <= body.n_preguntas <= 15):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "n_preguntas debe estar entre 8 y 15.")

    # RF-32: Verificar que el usuario completó al menos una evaluación por cada
    # sub-tema con orden >= 1 que ya tenga evaluaciones generadas.
    subtemas_resp = (
        supabase.table("tema")
        .select("id, nombre")
        .eq("modulo_id", modulo_id)
        .gte("orden", 1)
        .execute()
    )
    subtemas = subtemas_resp.data or []

    for subtema in subtemas:
        evals_resp = (
            supabase.table("evaluacion")
            .select("id")
            .eq("tema_id", subtema["id"])
            .eq("nivel", "tema")
            .execute()
        )
        eval_ids = [e["id"] for e in (evals_resp.data or [])]
        if not eval_ids:
            continue  # sub-tema sin evaluaciones aún → no bloquear

        intentos_resp = (
            supabase.table("intento_evaluacion")
            .select("id")
            .eq("usuario_id", user_id)
            .in_("evaluacion_id", eval_ids)
            .filter("completado_en", "not.is", "null")
            .gte("puntaje_total", _UMBRAL_APROBACION)
            .limit(1)
            .execute()
        )
        if not intentos_resp.data:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f'Debés aprobar la evaluación del sub-tema "{subtema["nombre"]}" '
                f"con al menos 11/20 antes del examen final.",
            )

    try:
        ev = generar_evaluacion_modulo(modulo_id, n_preguntas=body.n_preguntas)
    except RuntimeError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    except ValueError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Error generando preguntas: {e}")
    except LLMError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"El asistente no está disponible: {e}")

    preguntas_out = [
        PreguntaOut(
            id=p["id"],
            tipo=p["tipo"],
            enunciado=p["enunciado"],
            opciones=p.get("opciones"),
        )
        for p in ev.preguntas
    ]

    return GenerarEvaluacionResponse(
        evaluacion_id=ev.evaluacion_id,
        titulo=ev.titulo,
        preguntas=preguntas_out,
    )


# ---------------------------------------------------------------------------
# POST /evaluaciones/{evaluacion_id}/intentos
# ---------------------------------------------------------------------------

@router.post(
    "/{evaluacion_id}/intentos",
    status_code=status.HTTP_201_CREATED,
    response_model=CrearIntentoResponse,
)
async def crear_intento(
    evaluacion_id: str,
    user_id: str = Depends(get_current_user_id),
):
    eval_resp = supabase.table("evaluacion").select("id").eq("id", evaluacion_id).single().execute()
    if not eval_resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluación no encontrada.")

    resp = supabase.table("intento_evaluacion").insert({
        "usuario_id": user_id,
        "evaluacion_id": evaluacion_id,
    }).execute()

    intento = resp.data[0]
    return CrearIntentoResponse(intento_id=intento["id"], evaluacion_id=evaluacion_id)


# ---------------------------------------------------------------------------
# POST /evaluaciones/intentos/{intento_id}/respuestas
# ---------------------------------------------------------------------------

@router.post(
    "/intentos/{intento_id}/respuestas",
    status_code=status.HTTP_201_CREATED,
    response_model=ResultadoIntentoResponse,
)
async def enviar_respuestas(
    intento_id: str,
    body: EnviarRespuestasRequest,
    user_id: str = Depends(get_current_user_id),
):
    intento = _get_intento_propio(intento_id, user_id)

    if intento["completado_en"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este intento ya fue completado.")

    evaluacion_id = intento["evaluacion_id"]
    preguntas = _get_preguntas(evaluacion_id)
    if not preguntas:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "La evaluación no tiene preguntas.")

    pregunta_map = {p["id"]: p for p in preguntas}

    # Contexto del tema para calificación de abiertas (una sola carga)
    eval_resp = (
        supabase.table("evaluacion")
        .select("tema_id, nivel, modulo_id")
        .eq("id", evaluacion_id)
        .single()
        .execute()
    )
    tema_id = eval_resp.data["tema_id"] if eval_resp.data else None
    nivel_eval = (eval_resp.data or {}).get("nivel", "tema")
    modulo_id_eval = (eval_resp.data or {}).get("modulo_id")
    contexto_tema = ""
    if tema_id:
        chunks = recuperar_contexto(
            "conceptos clave implementación ERP gestión del cambio",
            tema_id=tema_id, top_k=6, umbral=0.30,
        )
        contexto_tema = construir_contexto_texto(chunks, max_chars=5000)

    # Calificar cada respuesta
    puntajes: list[float] = []
    filas_respuesta: list[dict] = []
    resultados_out: list[RespuestaCalificadaOut] = []

    resp_map = {r.pregunta_id: r.respuesta_dada for r in body.respuestas}

    try:
        for pregunta in preguntas:
            pid = pregunta["id"]
            tipo = pregunta["tipo"]
            respuesta_dada = resp_map.get(pid)

            if tipo in ("opcion_multiple", "verdadero_falso"):
                puntaje = corregir_automatica(pregunta, respuesta_dada)
                feedback = None
            else:  # abierta
                resultado = calificar_abierta(pregunta, respuesta_dada, contexto_tema)
                puntaje = resultado.puntaje
                feedback = resultado.feedback

            puntajes.append(puntaje)
            filas_respuesta.append({
                "intento_id": intento_id,
                "pregunta_id": pid,
                "respuesta_dada": respuesta_dada,
                "puntaje_obtenido": puntaje,
                "feedback_llm": feedback,
            })
            resultados_out.append(RespuestaCalificadaOut(
                pregunta_id=pid,
                tipo=tipo,
                enunciado=pregunta["enunciado"],
                respuesta_dada=respuesta_dada,
                puntaje_obtenido=puntaje,
                feedback_llm=feedback,
            ))
    except LLMError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"El asistente no está disponible: {e}")

    # Persistir respuestas
    supabase.table("respuesta_usuario").insert(filas_respuesta).execute()

    # Calcular puntaje total y cerrar intento
    consolidado = calcular_puntaje_total(puntajes)
    supabase.table("intento_evaluacion").update({
        "puntaje_total": consolidado.promedio,
        "completado_en": "now()",
    }).eq("id", intento_id).execute()

    # RF-33: Si es evaluación final de módulo y el usuario aprueba → marcar progreso
    if nivel_eval == "modulo" and modulo_id_eval and consolidado.aprobado:
        supabase.table("progreso_modulo").upsert(
            {
                "usuario_id": user_id,
                "modulo_id": modulo_id_eval,
                "completado": True,
                "completado_en": "now()",
            },
            on_conflict="usuario_id,modulo_id",
        ).execute()
        logger.info(
            "[EVAL] Módulo %s marcado como completado para user %s (nota=%.1f/20)",
            modulo_id_eval, user_id, consolidado.sobre_20,
        )

    return ResultadoIntentoResponse(
        intento_id=intento_id,
        evaluacion_id=evaluacion_id,
        puntaje_total=consolidado.promedio,
        sobre_20=consolidado.sobre_20,
        aprobado=consolidado.aprobado,
        completado_en=None,  # se acaba de completar; el cliente ya sabe
        respuestas=resultados_out,
    )


# ---------------------------------------------------------------------------
# GET /evaluaciones/intentos/{intento_id}
# ---------------------------------------------------------------------------

@router.get("/intentos/{intento_id}", response_model=ResultadoIntentoResponse)
async def obtener_resultado(
    intento_id: str,
    user_id: str = Depends(get_current_user_id),
):
    intento = _get_intento_propio(intento_id, user_id)

    resp = (
        supabase.table("respuesta_usuario")
        .select("pregunta_id, respuesta_dada, puntaje_obtenido, feedback_llm")
        .eq("intento_id", intento_id)
        .execute()
    )
    respuestas_bd = resp.data or []

    preguntas = _get_preguntas(intento["evaluacion_id"])
    pregunta_map = {p["id"]: p for p in preguntas}

    respuestas_out = [
        RespuestaCalificadaOut(
            pregunta_id=r["pregunta_id"],
            tipo=pregunta_map[r["pregunta_id"]]["tipo"],
            enunciado=pregunta_map[r["pregunta_id"]]["enunciado"],
            respuesta_dada=r["respuesta_dada"],
            puntaje_obtenido=float(r["puntaje_obtenido"] or 0),
            feedback_llm=r["feedback_llm"],
        )
        for r in respuestas_bd
        if r["pregunta_id"] in pregunta_map
    ]

    puntaje = intento["puntaje_total"]
    sobre_20 = round(float(puntaje) * 20, 2) if puntaje is not None else None
    aprobado = (sobre_20 >= 11.0) if sobre_20 is not None else None

    return ResultadoIntentoResponse(
        intento_id=intento_id,
        evaluacion_id=intento["evaluacion_id"],
        puntaje_total=float(puntaje) if puntaje is not None else None,
        sobre_20=sobre_20,
        aprobado=aprobado,
        completado_en=intento["completado_en"],
        respuestas=respuestas_out,
    )


# ---------------------------------------------------------------------------
# GET /evaluaciones/{evaluacion_id}/preguntas — fallback para la UI
# ---------------------------------------------------------------------------

@router.get("/{evaluacion_id}/preguntas", response_model=list[PreguntaOut])
async def obtener_preguntas(
    evaluacion_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    Devuelve las preguntas de una evaluación SIN respuesta_correcta.
    Solo accesible si el usuario tiene un intento para esa evaluación.
    Usado como fallback cuando sessionStorage no tiene las preguntas.
    """
    intento_resp = (
        supabase.table("intento_evaluacion")
        .select("id")
        .eq("usuario_id", user_id)
        .eq("evaluacion_id", evaluacion_id)
        .limit(1)
        .execute()
    )
    if not intento_resp.data:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés acceso a esta evaluación.")

    preguntas = _get_preguntas(evaluacion_id)
    if not preguntas:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La evaluación no tiene preguntas.")

    return [
        PreguntaOut(
            id=p["id"],
            tipo=p["tipo"],
            enunciado=p["enunciado"],
            opciones=p.get("opciones"),
        )
        for p in preguntas
    ]


# ---------------------------------------------------------------------------
# GET /evaluaciones/historial
# ---------------------------------------------------------------------------

@router.get("/historial", response_model=list[HistorialItemOut])
async def historial(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase.table("intento_evaluacion")
        .select("id, evaluacion_id, puntaje_total, completado_en, evaluacion(titulo)")
        .eq("usuario_id", user_id)
        .order("completado_en", desc=True, nullsfirst=False)
        .execute()
    )

    items = []
    for r in (resp.data or []):
        puntaje = r["puntaje_total"]
        sobre_20 = round(float(puntaje) * 20, 2) if puntaje is not None else None
        aprobado = (sobre_20 >= 11.0) if sobre_20 is not None else None
        titulo = (r.get("evaluacion") or {}).get("titulo")
        items.append(HistorialItemOut(
            intento_id=r["id"],
            evaluacion_id=r["evaluacion_id"],
            titulo_evaluacion=titulo,
            puntaje_total=float(puntaje) if puntaje is not None else None,
            sobre_20=sobre_20,
            aprobado=aprobado,
            completado_en=r["completado_en"],
        ))
    return items
