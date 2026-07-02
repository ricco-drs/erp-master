from __future__ import annotations

import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.base_conocimiento.extraccion import extraer_texto, ExtractionError
from app.base_conocimiento.chunking import fragmentar_texto
from app.base_conocimiento.embeddings import generar_embeddings
from app.base_conocimiento.moderacion import moderar_documento

router = APIRouter(prefix="/documentos", tags=["documentos"])

FORMATOS_PERMITIDOS = {"pdf", "docx", "txt", "md"}
TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10 MB (RNF-08)
BUCKET = "documentos"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_doc_propio(documento_id: str, user_id: str) -> dict:
    """Obtiene un documento verificando que pertenece al usuario. Lanza 404/403."""
    doc_resp = (
        supabase.table("documento")
        .select("id, storage_path, usuario_id, eliminada_en")
        .eq("id", documento_id)
        .single()
        .execute()
    )
    if not doc_resp.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    if doc_resp.data["usuario_id"] != user_id:
        raise HTTPException(status_code=403, detail="No tenés permiso para modificar este documento.")
    return doc_resp.data


# ---------------------------------------------------------------------------
# POST /documentos — subida y procesamiento completo
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
async def subir_documento(
    archivo: UploadFile = File(...),
    tema_id: str = Form(...),
    visibilidad: str = Form(...),
    user_id: str = Depends(get_current_user_id),
):
    if visibilidad not in ("privado", "compartido"):
        raise HTTPException(status_code=422, detail="Visibilidad debe ser 'privado' o 'compartido'.")

    nombre = archivo.filename or ""
    formato = Path(nombre).suffix.lstrip(".").lower()
    if formato not in FORMATOS_PERMITIDOS:
        raise HTTPException(
            status_code=422,
            detail=f"Formato '{formato}' no soportado. Se aceptan: PDF, DOCX, TXT, MD.",
        )

    contenido = await archivo.read()
    if len(contenido) > TAMANO_MAXIMO_BYTES:
        raise HTTPException(status_code=422, detail="El archivo supera el tamaño máximo permitido de 10 MB.")

    with tempfile.NamedTemporaryFile(suffix=f".{formato}", delete=False) as tmp:
        tmp.write(contenido)
        tmp_path = Path(tmp.name)

    try:
        texto = extraer_texto(tmp_path, formato)
    except ExtractionError as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    chunks = fragmentar_texto(texto)
    if not chunks:
        raise HTTPException(status_code=422, detail="No se pudo extraer contenido del archivo.")

    textos_chunks = [c.texto for c in chunks]
    vectores = generar_embeddings(textos_chunks)

    doc_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{doc_id}.{formato}"

    if visibilidad == "compartido":
        resultado = moderar_documento(texto)
        estado_moderacion = "aprobado" if resultado.aprobado else "rechazado"
        motivo_rechazo = None if resultado.aprobado else resultado.motivo
    else:
        estado_moderacion = "aprobado"
        motivo_rechazo = None

    doc_data = {
        "id": doc_id,
        "usuario_id": user_id,
        "tema_id": tema_id,
        "nombre_archivo": nombre,
        "formato": formato,
        "storage_path": storage_path,
        "visibilidad": visibilidad,
        "estado_moderacion": estado_moderacion,
        "motivo_rechazo": motivo_rechazo,
    }

    doc_resp = supabase.table("documento").insert(doc_data).execute()
    if not doc_resp.data:
        raise HTTPException(status_code=500, detail="Error al guardar el documento.")

    supabase.storage.from_(BUCKET).upload(
        path=storage_path,
        file=contenido,
        file_options={"content-type": archivo.content_type or "application/octet-stream"},
    )

    chunk_rows = [
        {
            "documento_id": doc_id,
            "contenido": chunks[i].texto,
            "embedding": vectores[i],
            "orden": chunks[i].orden,
        }
        for i in range(len(chunks))
    ]
    LOTE = 100
    for inicio in range(0, len(chunk_rows), LOTE):
        supabase.table("chunk").insert(chunk_rows[inicio : inicio + LOTE]).execute()

    return {
        "id": doc_id,
        "nombre_archivo": nombre,
        "formato": formato,
        "visibilidad": visibilidad,
        "estado_moderacion": estado_moderacion,
        "motivo_rechazo": motivo_rechazo,
        "chunks_generados": len(chunks),
    }


# ---------------------------------------------------------------------------
# GET /documentos — listado de documentos activos (no archivados, no eliminados)
# ---------------------------------------------------------------------------

@router.get("")
async def listar_documentos(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase.table("documento")
        .select("id, nombre_archivo, formato, visibilidad, estado_moderacion, motivo_rechazo, subido_en, tema_id, archivada_en, eliminada_en")
        .eq("usuario_id", user_id)
        .is_("eliminada_en", "null")
        .is_("archivada_en", "null")
        .order("subido_en", desc=True)
        .execute()
    )
    return resp.data


# ---------------------------------------------------------------------------
# GET /documentos/papelera — documentos archivados y eliminados (soft)
# ---------------------------------------------------------------------------

@router.get("/papelera")
async def listar_papelera(user_id: str = Depends(get_current_user_id)):
    """Devuelve los documentos propios del usuario que están archivados o en papelera."""
    resp = (
        supabase.table("documento")
        .select("id, nombre_archivo, formato, visibilidad, estado_moderacion, subido_en, tema_id, archivada_en, eliminada_en")
        .eq("usuario_id", user_id)
        .filter("eliminada_en", "not.is", "null")
        .order("eliminada_en", desc=True)
        .execute()
    )
    eliminados = resp.data or []

    resp2 = (
        supabase.table("documento")
        .select("id, nombre_archivo, formato, visibilidad, estado_moderacion, subido_en, tema_id, archivada_en, eliminada_en")
        .eq("usuario_id", user_id)
        .filter("archivada_en", "not.is", "null")
        .is_("eliminada_en", "null")
        .order("archivada_en", desc=True)
        .execute()
    )
    archivados = resp2.data or []

    return {"archivados": archivados, "eliminados": eliminados}


# ---------------------------------------------------------------------------
# PATCH /documentos/{id}/archivar — archivar (soft)
# ---------------------------------------------------------------------------

@router.patch("/{documento_id}/archivar", status_code=status.HTTP_200_OK)
async def archivar_documento(
    documento_id: str,
    user_id: str = Depends(get_current_user_id),
):
    _get_doc_propio(documento_id, user_id)
    supabase.table("documento").update({"archivada_en": _now_iso()}).eq("id", documento_id).execute()
    return {"ok": True}


# ---------------------------------------------------------------------------
# PATCH /documentos/{id}/restaurar — quitar de archivo o papelera → activo
# ---------------------------------------------------------------------------

@router.patch("/{documento_id}/restaurar", status_code=status.HTTP_200_OK)
async def restaurar_documento(
    documento_id: str,
    user_id: str = Depends(get_current_user_id),
):
    _get_doc_propio(documento_id, user_id)
    supabase.table("documento").update({"archivada_en": None, "eliminada_en": None}).eq("id", documento_id).execute()
    return {"ok": True}


# ---------------------------------------------------------------------------
# DELETE /documentos/{id} — soft-delete (mover a papelera)
# ---------------------------------------------------------------------------

@router.delete("/{documento_id}", status_code=status.HTTP_200_OK)
async def eliminar_documento(
    documento_id: str,
    user_id: str = Depends(get_current_user_id),
):
    doc = _get_doc_propio(documento_id, user_id)

    if doc.get("eliminada_en"):
        # Ya está en papelera → eliminación permanente
        supabase.table("chunk").delete().eq("documento_id", documento_id).execute()
        supabase.table("documento").delete().eq("id", documento_id).execute()
        supabase.storage.from_(BUCKET).remove([doc["storage_path"]])
        return {"ok": True, "permanente": True}

    # Primera vez → soft-delete (mover a papelera)
    supabase.table("documento").update({"eliminada_en": _now_iso(), "archivada_en": None}).eq("id", documento_id).execute()
    return {"ok": True, "permanente": False}
