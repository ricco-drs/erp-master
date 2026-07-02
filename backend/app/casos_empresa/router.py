from __future__ import annotations

import logging
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.base_conocimiento.extraccion import extraer_texto, ExtractionError
from app.base_conocimiento.chunking import fragmentar_texto
from app.base_conocimiento.embeddings import generar_embeddings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/casos-empresa", tags=["casos-empresa"])

FORMATOS_PERMITIDOS = {"pdf", "docx", "txt", "md"}
TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10 MB
BUCKET = "documentos"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CrearCasoRequest(BaseModel):
    nombre: str
    descripcion: str | None = None
    modulo_id: str | None = None
    documento_id: str | None = None


class CasoOut(BaseModel):
    id: str
    nombre: str
    descripcion: str | None
    modulo_id: str | None
    documento_id: str | None
    creado_en: str


# ---------------------------------------------------------------------------
# POST /casos-empresa — crear un caso de empresa
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED, response_model=CasoOut)
async def crear_caso(
    body: CrearCasoRequest,
    user_id: str = Depends(get_current_user_id),
):
    if not body.nombre.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El nombre no puede estar vacío.")

    if body.modulo_id:
        mod_resp = (
            supabase.table("modulo")
            .select("id")
            .eq("id", body.modulo_id)
            .single()
            .execute()
        )
        if not mod_resp.data:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El módulo indicado no existe.")

    if body.documento_id:
        doc_resp = (
            supabase.table("documento")
            .select("id, usuario_id")
            .eq("id", body.documento_id)
            .single()
            .execute()
        )
        if not doc_resp.data:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El documento indicado no existe.")
        if doc_resp.data["usuario_id"] != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés acceso a ese documento.")

    resp = supabase.table("caso_empresa").insert({
        "usuario_id": user_id,
        "nombre": body.nombre.strip(),
        "descripcion": body.descripcion,
        "modulo_id": body.modulo_id,
        "documento_id": body.documento_id,
    }).execute()

    caso = resp.data[0]
    logger.info("[CASOS] Caso %s creado por user %s", caso["id"], user_id)
    return CasoOut(
        id=caso["id"],
        nombre=caso["nombre"],
        descripcion=caso["descripcion"],
        modulo_id=caso["modulo_id"],
        documento_id=caso["documento_id"],
        creado_en=caso["creado_en"],
    )


# ---------------------------------------------------------------------------
# GET /casos-empresa — lista los casos del usuario
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CasoOut])
async def listar_casos(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase.table("caso_empresa")
        .select("id, nombre, descripcion, modulo_id, documento_id, creado_en")
        .eq("usuario_id", user_id)
        .order("creado_en", desc=True)
        .execute()
    )
    return [
        CasoOut(
            id=c["id"],
            nombre=c["nombre"],
            descripcion=c["descripcion"],
            modulo_id=c["modulo_id"],
            documento_id=c["documento_id"],
            creado_en=c["creado_en"],
        )
        for c in (resp.data or [])
    ]


# ---------------------------------------------------------------------------
# GET /casos-empresa/{caso_id} — detalle de un caso
# ---------------------------------------------------------------------------

@router.get("/{caso_id}", response_model=CasoOut)
async def obtener_caso(
    caso_id: str,
    user_id: str = Depends(get_current_user_id),
):
    resp = (
        supabase.table("caso_empresa")
        .select("id, nombre, descripcion, modulo_id, documento_id, creado_en, usuario_id")
        .eq("id", caso_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Caso de empresa no encontrado.")
    if resp.data["usuario_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés acceso a este caso.")

    c = resp.data
    return CasoOut(
        id=c["id"],
        nombre=c["nombre"],
        descripcion=c["descripcion"],
        modulo_id=c["modulo_id"],
        documento_id=c["documento_id"],
        creado_en=c["creado_en"],
    )


# ---------------------------------------------------------------------------
# DELETE /casos-empresa/{caso_id} — eliminar un caso
# ---------------------------------------------------------------------------

@router.delete("/{caso_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_caso(
    caso_id: str,
    user_id: str = Depends(get_current_user_id),
):
    resp = (
        supabase.table("caso_empresa")
        .select("id, usuario_id")
        .eq("id", caso_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Caso de empresa no encontrado.")
    if resp.data["usuario_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés acceso a este caso.")

    supabase.table("caso_empresa").delete().eq("id", caso_id).execute()
    logger.info("[CASOS] Caso %s eliminado por user %s", caso_id, user_id)


# ---------------------------------------------------------------------------
# POST /casos-empresa/{caso_id}/documentos — subir archivo al caso
# ---------------------------------------------------------------------------

@router.post("/{caso_id}/documentos", status_code=status.HTTP_201_CREATED)
async def subir_documento_caso(
    caso_id: str,
    archivo: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    Sube un archivo (.txt, .md, .pdf, .docx) al caso de empresa.
    Ejecuta el pipeline completo: extracción → chunking → embeddings → BD.
    Vincula el documento creado al caso_empresa.documento_id.
    El documento se crea como privado y aprobado (no requiere moderación).
    """
    # 1. Verificar que el caso existe y pertenece al usuario
    caso_resp = (
        supabase.table("caso_empresa")
        .select("id, usuario_id, documento_id")
        .eq("id", caso_id)
        .single()
        .execute()
    )
    if not caso_resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Caso de empresa no encontrado.")
    if caso_resp.data["usuario_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés acceso a este caso.")

    # 2. Validar formato y tamaño
    nombre = archivo.filename or ""
    formato = Path(nombre).suffix.lstrip(".").lower()
    if formato not in FORMATOS_PERMITIDOS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Formato '{formato}' no soportado. Se aceptan: PDF, DOCX, TXT, MD.",
        )

    contenido = await archivo.read()
    if len(contenido) > TAMANO_MAXIMO_BYTES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "El archivo supera el tamaño máximo permitido de 10 MB.",
        )

    # 3. Extraer texto
    with tempfile.NamedTemporaryFile(suffix=f".{formato}", delete=False) as tmp:
        tmp.write(contenido)
        tmp_path = Path(tmp.name)

    try:
        texto = extraer_texto(tmp_path, formato)
    except ExtractionError as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    # 4. Chunking + embeddings
    chunks = fragmentar_texto(texto)
    if not chunks:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No se pudo extraer contenido del archivo.",
        )

    textos_chunks = [c.texto for c in chunks]
    vectores = generar_embeddings(textos_chunks)

    # 5. Si el caso ya tiene un documento anterior, eliminar sus chunks y el registro
    doc_anterior_id = caso_resp.data.get("documento_id")
    if doc_anterior_id:
        supabase.table("chunk").delete().eq("documento_id", doc_anterior_id).execute()
        doc_ant = (
            supabase.table("documento")
            .select("storage_path")
            .eq("id", doc_anterior_id)
            .single()
            .execute()
        )
        supabase.table("documento").delete().eq("id", doc_anterior_id).execute()
        if doc_ant.data and doc_ant.data.get("storage_path"):
            try:
                supabase.storage.from_(BUCKET).remove([doc_ant.data["storage_path"]])
            except Exception:
                pass  # Si el archivo no existía en Storage, ignorar

    # 6. Insertar documento en BD
    doc_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{doc_id}.{formato}"

    supabase.table("documento").insert({
        "id": doc_id,
        "usuario_id": user_id,
        "tema_id": None,           # documentos de casos no tienen tema_id
        "nombre_archivo": nombre,
        "formato": formato,
        "storage_path": storage_path,
        "visibilidad": "privado",
        "estado_moderacion": "aprobado",  # privado → no requiere moderación
    }).execute()

    # 7. Subir archivo a Storage
    try:
        supabase.storage.from_(BUCKET).upload(
            path=storage_path,
            file=contenido,
            file_options={"content-type": archivo.content_type or "application/octet-stream"},
        )
    except Exception as e:
        logger.warning("[CASOS] No se pudo subir a Storage: %s", e)
        # No falla el endpoint — el contenido ya está en BD como chunks

    # 8. Insertar chunks
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
        supabase.table("chunk").insert(chunk_rows[inicio: inicio + LOTE]).execute()

    # 9. Vincular documento al caso
    supabase.table("caso_empresa").update({"documento_id": doc_id}).eq("id", caso_id).execute()

    logger.info(
        "[CASOS] Documento %s (%s, %d chunks) vinculado al caso %s por user %s",
        doc_id, formato, len(chunks), caso_id, user_id,
    )

    return {
        "documento_id": doc_id,
        "nombre_archivo": nombre,
        "formato": formato,
        "chunks_generados": len(chunks),
    }
