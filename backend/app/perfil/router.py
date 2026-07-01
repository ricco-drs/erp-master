from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase

router = APIRouter(prefix="/perfil", tags=["perfil"])

BUCKET = "documentos"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PerfilOut(BaseModel):
    id: str
    nombre: str
    correo: str
    rol: str
    creado_en: str


class ActualizarNombreRequest(BaseModel):
    nombre: str


class ProgresoOut(BaseModel):
    temas_estudiados: int
    evaluaciones_realizadas: int
    puntaje_promedio_20: float | None
    mejor_puntaje_20: float | None
    mejor_puntaje_tema: str | None
    ultima_sesion_fecha: str | None
    ultima_sesion_tema: str | None
    ultima_evaluacion_fecha: str | None
    ultima_evaluacion_tema: str | None
    ultima_evaluacion_puntaje: float | None


class SesionHistorialOut(BaseModel):
    id: str
    tema_id: str | None
    tema_nombre: str | None
    iniciada_en: str


class EvaluacionHistorialOut(BaseModel):
    intento_id: str
    evaluacion_id: str
    titulo_evaluacion: str | None
    tema_nombre: str | None
    puntaje_total: float | None
    sobre_20: float | None
    aprobado: bool | None
    completado_en: str | None


class DocumentoOut(BaseModel):
    id: str
    nombre_archivo: str
    formato: str
    visibilidad: str
    estado_moderacion: str
    motivo_rechazo: str | None
    subido_en: str
    tema_id: str | None


# ---------------------------------------------------------------------------
# GET /perfil
# ---------------------------------------------------------------------------

@router.get("", response_model=PerfilOut)
async def obtener_perfil(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase.table("usuario")
        .select("id, nombre, correo, rol, creado_en")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado.")
    return resp.data


# ---------------------------------------------------------------------------
# PATCH /perfil
# ---------------------------------------------------------------------------

@router.patch("", response_model=PerfilOut)
async def actualizar_perfil(
    body: ActualizarNombreRequest,
    user_id: str = Depends(get_current_user_id),
):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El nombre no puede estar vacío.")

    resp = (
        supabase.table("usuario")
        .update({"nombre": nombre})
        .eq("id", user_id)
        .select("id, nombre, correo, rol, creado_en")
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado.")
    return resp.data


# ---------------------------------------------------------------------------
# GET /perfil/progreso
# ---------------------------------------------------------------------------

@router.get("/progreso", response_model=ProgresoOut)
async def obtener_progreso(user_id: str = Depends(get_current_user_id)):
    # Temas únicos con al menos una sesión del usuario
    sesiones_resp = (
        supabase.table("sesion_chat")
        .select("tema_id, iniciada_en, tema(nombre)")
        .eq("usuario_id", user_id)
        .order("iniciada_en", desc=True)
        .execute()
    )
    sesiones = sesiones_resp.data or []
    temas_ids = {s["tema_id"] for s in sesiones if s.get("tema_id")}
    temas_estudiados = len(temas_ids)

    ultima_sesion = sesiones[0] if sesiones else None
    ultima_sesion_fecha = ultima_sesion["iniciada_en"] if ultima_sesion else None
    ultima_sesion_tema = (
        ultima_sesion["tema"]["nombre"]
        if ultima_sesion and ultima_sesion.get("tema")
        else None
    )

    # Intentos completados del usuario
    intentos_resp = (
        supabase.table("intento_evaluacion")
        .select("id, puntaje_total, completado_en, evaluacion(titulo, tema(nombre))")
        .eq("usuario_id", user_id)
        .not_.is_("completado_en", "null")
        .order("completado_en", desc=True)
        .execute()
    )
    intentos = intentos_resp.data or []
    evaluaciones_realizadas = len(intentos)

    puntajes = [
        float(i["puntaje_total"]) * 20
        for i in intentos
        if i.get("puntaje_total") is not None
    ]
    puntaje_promedio_20 = round(sum(puntajes) / len(puntajes), 2) if puntajes else None
    mejor_puntaje_20 = round(max(puntajes), 2) if puntajes else None

    # Tema del mejor puntaje
    mejor_puntaje_tema: str | None = None
    if puntajes:
        idx_mejor = puntajes.index(max(puntajes))
        ev_mejor = intentos[idx_mejor].get("evaluacion") or {}
        tema_mejor = ev_mejor.get("tema") or {}
        mejor_puntaje_tema = tema_mejor.get("nombre")

    # Última evaluación
    ultimo_intento = intentos[0] if intentos else None
    ultima_evaluacion_fecha = ultimo_intento["completado_en"] if ultimo_intento else None
    if ultimo_intento:
        ev_ult = ultimo_intento.get("evaluacion") or {}
        tema_ult = ev_ult.get("tema") or {}
        ultima_evaluacion_tema = tema_ult.get("nombre")
        pt = ultimo_intento.get("puntaje_total")
        ultima_evaluacion_puntaje = round(float(pt) * 20, 2) if pt is not None else None
    else:
        ultima_evaluacion_tema = None
        ultima_evaluacion_puntaje = None

    return ProgresoOut(
        temas_estudiados=temas_estudiados,
        evaluaciones_realizadas=evaluaciones_realizadas,
        puntaje_promedio_20=puntaje_promedio_20,
        mejor_puntaje_20=mejor_puntaje_20,
        mejor_puntaje_tema=mejor_puntaje_tema,
        ultima_sesion_fecha=ultima_sesion_fecha,
        ultima_sesion_tema=ultima_sesion_tema,
        ultima_evaluacion_fecha=ultima_evaluacion_fecha,
        ultima_evaluacion_tema=ultima_evaluacion_tema,
        ultima_evaluacion_puntaje=ultima_evaluacion_puntaje,
    )


# ---------------------------------------------------------------------------
# GET /perfil/sesiones
# ---------------------------------------------------------------------------

@router.get("/sesiones", response_model=list[SesionHistorialOut])
async def historial_sesiones(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase.table("sesion_chat")
        .select("id, tema_id, iniciada_en, tema(nombre)")
        .eq("usuario_id", user_id)
        .order("iniciada_en", desc=True)
        .execute()
    )
    rows = resp.data or []
    return [
        SesionHistorialOut(
            id=r["id"],
            tema_id=r.get("tema_id"),
            tema_nombre=r["tema"]["nombre"] if r.get("tema") else None,
            iniciada_en=r["iniciada_en"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /perfil/evaluaciones
# ---------------------------------------------------------------------------

@router.get("/evaluaciones", response_model=list[EvaluacionHistorialOut])
async def historial_evaluaciones(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase.table("intento_evaluacion")
        .select("id, evaluacion_id, puntaje_total, completado_en, evaluacion(titulo, tema(nombre))")
        .eq("usuario_id", user_id)
        .not_.is_("completado_en", "null")
        .order("completado_en", desc=True)
        .execute()
    )
    rows = resp.data or []
    result = []
    for r in rows:
        ev = r.get("evaluacion") or {}
        tema = ev.get("tema") or {}
        pt = r.get("puntaje_total")
        sobre_20 = round(float(pt) * 20, 2) if pt is not None else None
        result.append(
            EvaluacionHistorialOut(
                intento_id=r["id"],
                evaluacion_id=r["evaluacion_id"],
                titulo_evaluacion=ev.get("titulo"),
                tema_nombre=tema.get("nombre"),
                puntaje_total=float(pt) if pt is not None else None,
                sobre_20=sobre_20,
                aprobado=(sobre_20 >= 11) if sobre_20 is not None else None,
                completado_en=r.get("completado_en"),
            )
        )
    return result


# ---------------------------------------------------------------------------
# GET /perfil/documentos
# ---------------------------------------------------------------------------

@router.get("/documentos", response_model=list[DocumentoOut])
async def listar_documentos_propios(user_id: str = Depends(get_current_user_id)):
    resp = (
        supabase.table("documento")
        .select("id, nombre_archivo, formato, visibilidad, estado_moderacion, motivo_rechazo, subido_en, tema_id")
        .eq("usuario_id", user_id)
        .order("subido_en", desc=True)
        .execute()
    )
    return resp.data or []


# ---------------------------------------------------------------------------
# DELETE /perfil/documentos/{id}
# ---------------------------------------------------------------------------

@router.delete("/documentos/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_documento_propio(
    documento_id: str,
    user_id: str = Depends(get_current_user_id),
):
    doc_resp = (
        supabase.table("documento")
        .select("id, storage_path, usuario_id")
        .eq("id", documento_id)
        .single()
        .execute()
    )
    if not doc_resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado.")
    if doc_resp.data["usuario_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés permiso para eliminar este documento.")

    storage_path = doc_resp.data["storage_path"]

    # chunks se eliminan por cascada FK, pero lo hacemos explícito
    supabase.table("chunk").delete().eq("documento_id", documento_id).execute()
    supabase.table("documento").delete().eq("id", documento_id).execute()
    supabase.storage.from_(BUCKET).remove([storage_path])
