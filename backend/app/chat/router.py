from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.core.llm_provider import LLMError
from app.chat.service import procesar_mensaje, MensajeChat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# Schemas de request / response
# ---------------------------------------------------------------------------

class CrearSesionRequest(BaseModel):
    tema_id: str


class CrearSesionResponse(BaseModel):
    sesion_id: str
    tema_id: str
    iniciada_en: str


class EnviarMensajeRequest(BaseModel):
    contenido: str


class EnviarMensajeResponse(BaseModel):
    mensaje_id: str
    contenido: str
    fuera_de_alcance: bool
    chunks_usados: int


class MensajeOut(BaseModel):
    id: str
    rol_emisor: str
    contenido: str
    enviado_en: str


class SesionOut(BaseModel):
    id: str
    tema_id: str | None
    iniciada_en: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _verificar_sesion_propia(sesion_id: str, user_id: str) -> dict:
    """Devuelve la sesión si existe y pertenece al usuario; lanza 404/403 si no."""
    resp = (
        supabase.table("sesion_chat")
        .select("id, usuario_id, tema_id, iniciada_en")
        .eq("id", sesion_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    if resp.data["usuario_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenés acceso a esta sesión.")
    return resp.data


def _cargar_historial(sesion_id: str) -> list[MensajeChat]:
    """Carga todos los mensajes de la sesión ordenados por fecha."""
    resp = (
        supabase.table("mensaje")
        .select("rol_emisor, contenido")
        .eq("sesion_id", sesion_id)
        .order("enviado_en")
        .execute()
    )
    return [
        MensajeChat(rol=m["rol_emisor"], contenido=m["contenido"])
        for m in (resp.data or [])
    ]


# ---------------------------------------------------------------------------
# POST /chat/sesiones — crear sesión
# ---------------------------------------------------------------------------

@router.post("/sesiones", status_code=status.HTTP_201_CREATED, response_model=CrearSesionResponse)
async def crear_sesion(
    body: CrearSesionRequest,
    user_id: str = Depends(get_current_user_id),
):
    # Verificar que el tema existe
    tema_resp = (
        supabase.table("tema")
        .select("id")
        .eq("id", body.tema_id)
        .single()
        .execute()
    )
    if not tema_resp.data:
        raise HTTPException(status_code=422, detail="El tema indicado no existe.")

    sesion_id = str(uuid.uuid4())
    resp = supabase.table("sesion_chat").insert(
        {"id": sesion_id, "usuario_id": user_id, "tema_id": body.tema_id}
    ).execute()

    sesion = resp.data[0]
    return CrearSesionResponse(
        sesion_id=sesion["id"],
        tema_id=sesion["tema_id"],
        iniciada_en=sesion["iniciada_en"],
    )


# ---------------------------------------------------------------------------
# POST /chat/sesiones/{sesion_id}/mensajes — enviar mensaje (núcleo RAG)
# ---------------------------------------------------------------------------

@router.post(
    "/sesiones/{sesion_id}/mensajes",
    status_code=status.HTTP_201_CREATED,
    response_model=EnviarMensajeResponse,
)
async def enviar_mensaje(
    sesion_id: str,
    body: EnviarMensajeRequest,
    user_id: str = Depends(get_current_user_id),
):
    if not body.contenido.strip():
        raise HTTPException(status_code=422, detail="El mensaje no puede estar vacío.")

    # Verificar que la sesión pertenece al usuario
    sesion = _verificar_sesion_propia(sesion_id, user_id)
    tema_id: str | None = sesion["tema_id"]

    # Cargar historial previo de la sesión
    historial = _cargar_historial(sesion_id)

    # Ejecutar el pipeline RAG
    try:
        respuesta = procesar_mensaje(
            mensaje=body.contenido.strip(),
            tema_id=tema_id,
            historial=historial,
        )
    except LLMError as e:
        logger.error("LLMError en sesion %s: %s", sesion_id, e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"El asistente no está disponible en este momento: {e}",
        )

    # Persistir mensaje del usuario
    supabase.table("mensaje").insert({
        "sesion_id": sesion_id,
        "rol_emisor": "usuario",
        "contenido": body.contenido.strip(),
    }).execute()

    # Persistir respuesta del asistente
    resp_msg = supabase.table("mensaje").insert({
        "sesion_id": sesion_id,
        "rol_emisor": "asistente",
        "contenido": respuesta.contenido,
    }).execute()

    msg_id = resp_msg.data[0]["id"] if resp_msg.data else str(uuid.uuid4())

    return EnviarMensajeResponse(
        mensaje_id=msg_id,
        contenido=respuesta.contenido,
        fuera_de_alcance=respuesta.fuera_de_alcance,
        chunks_usados=respuesta.chunks_usados,
    )


# ---------------------------------------------------------------------------
# GET /chat/sesiones — listar sesiones del usuario
# ---------------------------------------------------------------------------

@router.get("/sesiones", response_model=list[SesionOut])
async def listar_sesiones(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase.table("sesion_chat")
        .select("id, tema_id, iniciada_en")
        .eq("usuario_id", user_id)
        .order("iniciada_en", desc=True)
        .execute()
    )
    return [
        SesionOut(id=s["id"], tema_id=s["tema_id"], iniciada_en=s["iniciada_en"])
        for s in (resp.data or [])
    ]


# ---------------------------------------------------------------------------
# GET /chat/sesiones/{sesion_id}/mensajes — historial de una sesión
# ---------------------------------------------------------------------------

@router.get("/sesiones/{sesion_id}/mensajes", response_model=list[MensajeOut])
async def obtener_mensajes(
    sesion_id: str,
    user_id: str = Depends(get_current_user_id),
):
    _verificar_sesion_propia(sesion_id, user_id)

    resp = (
        supabase.table("mensaje")
        .select("id, rol_emisor, contenido, enviado_en")
        .eq("sesion_id", sesion_id)
        .order("enviado_en")
        .execute()
    )
    return [
        MensajeOut(
            id=m["id"],
            rol_emisor=m["rol_emisor"],
            contenido=m["contenido"],
            enviado_en=m["enviado_en"],
        )
        for m in (resp.data or [])
    ]
