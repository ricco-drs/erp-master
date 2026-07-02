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
    tema_id: str | None = None
    caso_empresa_id: str | None = None
    nombre: str | None = None


class CrearSesionResponse(BaseModel):
    sesion_id: str
    tema_id: str | None
    caso_empresa_id: str | None
    nombre: str | None = None
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
    caso_empresa_id: str | None = None
    nombre: str | None = None
    iniciada_en: str
    archivada: bool = False


class ArchivarSesionRequest(BaseModel):
    archivada: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _verificar_sesion_propia(
    sesion_id: str,
    user_id: str,
    *,
    permitir_eliminada: bool = False,
) -> dict:
    """Devuelve la sesión si existe y pertenece al usuario; lanza 404/403 si no.
    Por defecto bloquea sesiones con eliminada_en != NULL."""
    resp = (
        supabase.table("sesion_chat")
        .select("id, usuario_id, tema_id, caso_empresa_id, nombre, iniciada_en, archivada, eliminada_en")
        .eq("id", sesion_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    if resp.data["usuario_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenés acceso a esta sesión.")
    if not permitir_eliminada and resp.data.get("eliminada_en"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
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
    if body.tema_id is not None and body.caso_empresa_id is not None:
        raise HTTPException(status_code=422, detail="No podés especificar tema_id y caso_empresa_id a la vez.")

    if body.tema_id is not None:
        tema_resp = (
            supabase.table("tema")
            .select("id")
            .eq("id", body.tema_id)
            .single()
            .execute()
        )
        if not tema_resp.data:
            raise HTTPException(status_code=422, detail="El tema indicado no existe.")

    if body.caso_empresa_id is not None:
        caso_resp = (
            supabase.table("caso_empresa")
            .select("id, usuario_id")
            .eq("id", body.caso_empresa_id)
            .single()
            .execute()
        )
        if not caso_resp.data:
            raise HTTPException(status_code=422, detail="El caso de empresa indicado no existe.")
        if caso_resp.data["usuario_id"] != user_id:
            raise HTTPException(status_code=403, detail="No tenés acceso a ese caso de empresa.")

    # Resolver nombre del chat
    nombre_chat = body.nombre
    if not nombre_chat and body.tema_id:
        # Si no se pasó nombre explícito pero hay tema_id, resolver desde la BD
        try:
            tema_res = supabase.table("tema").select("nombre").eq("id", body.tema_id).single().execute()
            if tema_res.data:
                nombre_chat = tema_res.data["nombre"]
        except Exception:
            pass

    sesion_id = str(uuid.uuid4())
    insert_data = {
        "id": sesion_id,
        "usuario_id": user_id,
        "tema_id": body.tema_id,
        "caso_empresa_id": body.caso_empresa_id,
    }
    if nombre_chat:
        insert_data["nombre"] = nombre_chat

    resp = supabase.table("sesion_chat").insert(insert_data).execute()

    sesion = resp.data[0]
    return CrearSesionResponse(
        sesion_id=sesion["id"],
        tema_id=sesion["tema_id"],
        caso_empresa_id=sesion.get("caso_empresa_id"),
        nombre=sesion.get("nombre"),
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
    caso_empresa_id: str | None = sesion.get("caso_empresa_id")

    # Si es sesión de caso de empresa, resolver el documento_id del caso
    documento_caso_id: str | None = None
    if caso_empresa_id:
        caso_resp = (
            supabase.table("caso_empresa")
            .select("documento_id")
            .eq("id", caso_empresa_id)
            .single()
            .execute()
        )
        if caso_resp.data:
            documento_caso_id = caso_resp.data.get("documento_id")

    # Cargar historial previo de la sesión
    historial = _cargar_historial(sesion_id)

    # Ejecutar el pipeline RAG
    try:
        respuesta = procesar_mensaje(
            mensaje=body.contenido.strip(),
            tema_id=tema_id,
            historial=historial,
            user_id=user_id,
            documento_caso_id=documento_caso_id,
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

    # Si la sesión no tiene nombre (chat general), asignar la primera pregunta como nombre
    if not sesion.get("nombre"):
        nombre_primer_msg = body.contenido.strip()[:80]
        if nombre_primer_msg:
            supabase.table("sesion_chat").update({"nombre": nombre_primer_msg}).eq("id", sesion_id).execute()

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
# GET /chat/sesiones/{sesion_id} — obtener una sesión
# ---------------------------------------------------------------------------

@router.get("/sesiones/{sesion_id}", response_model=SesionOut)
async def obtener_sesion(
    sesion_id: str,
    user_id: str = Depends(get_current_user_id),
):
    sesion = _verificar_sesion_propia(sesion_id, user_id)
    return SesionOut(
        id=sesion["id"],
        tema_id=sesion["tema_id"],
        caso_empresa_id=sesion.get("caso_empresa_id"),
        nombre=sesion.get("nombre"),
        iniciada_en=sesion["iniciada_en"],
        archivada=sesion.get("archivada", False),
    )


# ---------------------------------------------------------------------------
# GET /chat/sesiones — listar sesiones del usuario
# ---------------------------------------------------------------------------

@router.get("/sesiones", response_model=list[SesionOut])
async def listar_sesiones(
    user_id: str = Depends(get_current_user_id),
    archivadas: bool = False,
    eliminadas: bool = False,
):
    q = (
        supabase.table("sesion_chat")
        .select("id, tema_id, caso_empresa_id, nombre, iniciada_en, archivada")
        .eq("usuario_id", user_id)
    )
    if eliminadas:
        q = q.filter("eliminada_en", "not.is", "null")
    else:
        q = q.is_("eliminada_en", "null").eq("archivada", archivadas)
    resp = q.order("iniciada_en", desc=True).execute()
    return [
        SesionOut(
            id=s["id"],
            tema_id=s["tema_id"],
            caso_empresa_id=s.get("caso_empresa_id"),
            nombre=s.get("nombre"),
            iniciada_en=s["iniciada_en"],
            archivada=s.get("archivada", False),
        )
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


# ---------------------------------------------------------------------------
# PATCH /chat/sesiones/{sesion_id}/archivar — archivar / desarchivar
# ---------------------------------------------------------------------------

@router.patch("/sesiones/{sesion_id}/archivar", status_code=status.HTTP_200_OK)
async def archivar_sesion(
    sesion_id: str,
    body: ArchivarSesionRequest,
    user_id: str = Depends(get_current_user_id),
):
    _verificar_sesion_propia(sesion_id, user_id)
    supabase.table("sesion_chat").update({"archivada": body.archivada}).eq("id", sesion_id).execute()
    return {"archivada": body.archivada}


# ---------------------------------------------------------------------------
# DELETE /chat/sesiones/{sesion_id} — eliminación suave (soft-delete)
# ---------------------------------------------------------------------------

@router.delete("/sesiones/{sesion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_sesion(
    sesion_id: str,
    user_id: str = Depends(get_current_user_id),
):
    _verificar_sesion_propia(sesion_id, user_id)
    supabase.table("sesion_chat").update({"eliminada_en": "now()"}).eq("id", sesion_id).execute()
    logger.info("Sesion %s eliminada (soft-delete) por user %s", sesion_id, user_id)


# ---------------------------------------------------------------------------
# PATCH /chat/sesiones/{sesion_id}/restaurar — restaurar desde papelera
# ---------------------------------------------------------------------------

@router.patch("/sesiones/{sesion_id}/restaurar", status_code=status.HTTP_200_OK)
async def restaurar_sesion(
    sesion_id: str,
    user_id: str = Depends(get_current_user_id),
):
    sesion = _verificar_sesion_propia(sesion_id, user_id, permitir_eliminada=True)
    if not sesion.get("eliminada_en"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La sesión no está en la papelera.")
    supabase.table("sesion_chat").update({"eliminada_en": None, "archivada": False}).eq("id", sesion_id).execute()
    logger.info("Sesion %s restaurada por user %s", sesion_id, user_id)
    return {"restaurada": True}


# ---------------------------------------------------------------------------
# DELETE /chat/sesiones/{sesion_id}/permanente — eliminación definitiva
# ---------------------------------------------------------------------------

@router.delete("/sesiones/{sesion_id}/permanente", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_permanente(
    sesion_id: str,
    user_id: str = Depends(get_current_user_id),
):
    _verificar_sesion_propia(sesion_id, user_id, permitir_eliminada=True)
    supabase.table("sesion_chat").delete().eq("id", sesion_id).execute()
    logger.info("Sesion %s eliminada permanentemente por user %s", sesion_id, user_id)
