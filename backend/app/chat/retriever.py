from __future__ import annotations

import logging
from dataclasses import dataclass

from app.core.supabase_client import supabase
from app.base_conocimiento.embeddings import generar_embedding

logger = logging.getLogger(__name__)

# Umbral mínimo de similitud coseno (0.0 – 1.0).
# Por debajo de este valor, el chunk no se considera relevante para la pregunta.
# Bajado a 0.45 para capturar más contexto relevante del sub-tema específico.
UMBRAL_SIMILITUD = 0.45


@dataclass
class ChunkRecuperado:
    id: str
    documento_id: str
    contenido: str
    orden: int
    similitud: float


def recuperar_contexto(
    query: str,
    tema_id: str | None,
    user_id: str | None = None,
    top_k: int = 6,
    umbral: float = UMBRAL_SIMILITUD,
) -> list[ChunkRecuperado]:
    """
    Busca los top_k chunks más relevantes para `query` en la base de conocimiento.

    Estrategia con tema_id:
    - Si tema_id está definido: busca PRIMERO en chunks vinculados a ese tema
      específico. Si no encuentra suficientes resultados (< 2 chunks),
      hace fallback al corpus completo aprobado y fusiona los resultados.
    - Si tema_id es None: busca directamente en todos los documentos aprobados.

    Filtra por user_id para que cada usuario solo vea:
      - Sus propios documentos (privados)
      - Documentos compartidos y aprobados (seed + terceros)
    Excluye documentos archivados o eliminados.

    Esto garantiza que el chatbot usa el material del sub-tema seleccionado
    cuando hay contenido disponible para él.

    Pasos:
    1. Genera el embedding de la pregunta del usuario.
    2. Si hay tema_id: llama a match_chunks filtrando por ese tema.
    3. Si no hay chunks suficientes (fallback): llama sin filtro de tema.
    4. Devuelve lista fusionada y ordenada de mayor a menor similitud.
    """
    vector = generar_embedding(query)
    chunks: list[ChunkRecuperado] = []

    # Parámetros base para la RPC (incluye usuario si está disponible)
    rpc_params_base = {
        "query_embedding": vector,
        "match_threshold": umbral,
        "match_count": top_k,
    }
    if user_id:
        rpc_params_base["p_usuario_id"] = user_id

    # Paso 1: Búsqueda filtrada por tema_id cuando hay sub-tema seleccionado
    if tema_id:
        try:
            params = {**rpc_params_base, "p_tema_id": tema_id}
            resp_tema = supabase.rpc("match_chunks", params).execute()
            chunks = _mapear_chunks(resp_tema.data or [])
            logger.info(
                "Retriever (tema=%s): query=%r → %d chunks (umbral=%.2f)",
                tema_id, query[:60], len(chunks), umbral,
            )
        except Exception as e:
            logger.error("Error en búsqueda vectorial por tema %s: %s", tema_id, e)

    # Paso 2: Fallback al corpus completo si no hay suficientes chunks del tema
    # También corre cuando tema_id es None (chat general)
    if len(chunks) < 2:
        try:
            params = {**rpc_params_base, "p_tema_id": None}
            resp_all = supabase.rpc("match_chunks", params).execute()
            chunks_all = _mapear_chunks(resp_all.data or [])

            if tema_id and chunks_all:
                logger.info(
                    "Retriever fallback corpus completo: tema=%s query=%r → %d chunks adicionales",
                    tema_id, query[:60], len(chunks_all),
                )

            # Fusionar: chunks del tema van primero (mayor prioridad), luego el corpus general
            vistos = {c.id for c in chunks}
            for c in chunks_all:
                if c.id not in vistos:
                    chunks.append(c)
                    vistos.add(c.id)

        except Exception as e:
            logger.error("Error en búsqueda vectorial corpus completo: %s", e)

    # Ordenar por similitud descendente y limitar a top_k
    chunks.sort(key=lambda c: c.similitud, reverse=True)
    return chunks[:top_k]


def _mapear_chunks(rows: list[dict]) -> list[ChunkRecuperado]:
    """Convierte las filas de la RPC en objetos ChunkRecuperado."""
    return [
        ChunkRecuperado(
            id=row["id"],
            documento_id=row["documento_id"],
            contenido=row["contenido"],
            orden=row["orden"],
            similitud=float(row["similarity"]),
        )
        for row in rows
    ]


def recuperar_contexto_caso(
    query: str,
    documento_id: str,
    user_id: str | None = None,
    top_k: int = 6,
    umbral: float = UMBRAL_SIMILITUD,
) -> list[ChunkRecuperado]:
    """
    Recupera contexto combinado para el chat de un caso de empresa:
    - Busca en el documento específico del caso (sin filtro de moderación).
    - Busca en el corpus general aprobado (igual que recuperar_contexto).
    - Fusiona resultados deduplicando por id, priorizando chunks del documento del caso.
    """
    vector = generar_embedding(query)

    # 1. Chunks del documento específico del caso (sin filtro de estado_moderacion)
    chunks_caso: list[ChunkRecuperado] = []
    try:
        resp_caso = supabase.rpc(
            "match_chunks_by_documento",
            {
                "query_embedding": vector,
                "p_documento_id": documento_id,
                "match_threshold": max(umbral - 0.10, 0.20),  # umbral más bajo para el doc propio
                "match_count": top_k,
            },
        ).execute()
        chunks_caso = _mapear_chunks(resp_caso.data or [])
    except Exception as e:
        logger.error("Error buscando en documento del caso %s: %s", documento_id, e)

    # 2. Corpus general aprobado
    chunks_generales = recuperar_contexto(query, tema_id=None, user_id=user_id, top_k=top_k, umbral=umbral)

    # 3. Fusión — los chunks del caso van primero (mayor prioridad en el contexto)
    vistos: set[str] = set()
    resultado: list[ChunkRecuperado] = []
    for c in chunks_caso:
        if c.id not in vistos:
            resultado.append(c)
            vistos.add(c.id)
    for c in chunks_generales:
        if c.id not in vistos:
            resultado.append(c)
            vistos.add(c.id)

    logger.info(
        "Retriever caso: documento=%s → %d chunks (caso=%d, general=%d)",
        documento_id, len(resultado), len(chunks_caso), len(chunks_generales),
    )
    return resultado


def construir_contexto_texto(chunks: list[ChunkRecuperado], max_chars: int = 6000) -> str:
    """
    Concatena los chunks recuperados en un bloque de texto para el prompt.
    Respeta un límite de caracteres para no exceder el context window del LLM.
    Cada chunk va separado con un divisor claro para que el LLM los distinga.
    """
    partes: list[str] = []
    total = 0

    for i, chunk in enumerate(chunks, 1):
        bloque = f"[Fragmento {i}]\n{chunk.contenido.strip()}"
        if total + len(bloque) > max_chars:
            break
        partes.append(bloque)
        total += len(bloque)

    return "\n\n".join(partes)
