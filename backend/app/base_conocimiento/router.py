from __future__ import annotations

import tempfile
import uuid
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
    # --- Validar visibilidad ---
    if visibilidad not in ("privado", "compartido"):
        raise HTTPException(status_code=422, detail="Visibilidad debe ser 'privado' o 'compartido'.")

    # --- Validar formato ---
    nombre = archivo.filename or ""
    formato = Path(nombre).suffix.lstrip(".").lower()
    if formato not in FORMATOS_PERMITIDOS:
        raise HTTPException(
            status_code=422,
            detail=f"Formato '{formato}' no soportado. Se aceptan: PDF, DOCX, TXT, MD.",
        )

    # --- Leer y validar tamaño ---
    contenido = await archivo.read()
    if len(contenido) > TAMANO_MAXIMO_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"El archivo supera el tamaño máximo permitido de 10 MB.",
        )

    # --- Extraer texto ---
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

    # --- Chunking + embeddings ---
    chunks = fragmentar_texto(texto)
    if not chunks:
        raise HTTPException(status_code=422, detail="No se pudo extraer contenido del archivo.")

    textos_chunks = [c.texto for c in chunks]
    vectores = generar_embeddings(textos_chunks)

    # --- Crear registro de documento en BD ---
    doc_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{doc_id}.{formato}"

    # Moderación (solo documentos compartidos — RF-08)
    if visibilidad == "compartido":
        resultado = moderar_documento(texto)
        estado_moderacion = "aprobado" if resultado.aprobado else "rechazado"
        motivo_rechazo = None if resultado.aprobado else resultado.motivo
    else:
        # Documentos privados no requieren moderación
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

    # --- Subir archivo original a Storage ---
    supabase.storage.from_(BUCKET).upload(
        path=storage_path,
        file=contenido,
        file_options={"content-type": archivo.content_type or "application/octet-stream"},
    )

    # --- Insertar chunks con embeddings ---
    chunk_rows = [
        {
            "documento_id": doc_id,
            "contenido": chunks[i].texto,
            "embedding": vectores[i],
            "orden": chunks[i].orden,
        }
        for i in range(len(chunks))
    ]
    # Insertar en lotes de 100 para no exceder límites de PostgREST
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
# GET /documentos — listado
# ---------------------------------------------------------------------------

@router.get("")
async def listar_documentos(user_id: str = Depends(get_current_user_id)):
    """
    Devuelve los documentos propios del usuario más los compartidos+aprobados de otros.
    La RLS de Supabase aplica esta regla, pero el service_role key la omite —
    por eso filtramos explícitamente en la query.
    """
    resp = (
        supabase.table("documento")
        .select("id, nombre_archivo, formato, visibilidad, estado_moderacion, motivo_rechazo, subido_en, tema_id, usuario_id")
        .or_(
            f"usuario_id.eq.{user_id},"
            "and(visibilidad.eq.compartido,estado_moderacion.eq.aprobado)"
        )
        .order("subido_en", desc=True)
        .execute()
    )
    return resp.data


# ---------------------------------------------------------------------------
# DELETE /documentos/{id}
# ---------------------------------------------------------------------------

@router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_documento(
    documento_id: str,
    user_id: str = Depends(get_current_user_id),
):
    # Verificar que el documento existe y pertenece al usuario (RF-23)
    doc_resp = (
        supabase.table("documento")
        .select("id, storage_path, usuario_id")
        .eq("id", documento_id)
        .single()
        .execute()
    )

    if not doc_resp.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    if doc_resp.data["usuario_id"] != user_id:
        raise HTTPException(status_code=403, detail="No tenés permiso para eliminar este documento.")

    storage_path = doc_resp.data["storage_path"]

    # Eliminar chunks (cascada por FK, pero lo hacemos explícito para claridad)
    supabase.table("chunk").delete().eq("documento_id", documento_id).execute()

    # Eliminar registro de documento (chunks ya eliminados)
    supabase.table("documento").delete().eq("id", documento_id).execute()

    # Eliminar archivo original del Storage
    supabase.storage.from_(BUCKET).remove([storage_path])
