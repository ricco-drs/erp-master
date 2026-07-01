from __future__ import annotations

import logging
from dataclasses import dataclass

from app.core.supabase_client import supabase
from app.base_conocimiento.embeddings import generar_embedding

logger = logging.getLogger(__name__)

# Umbral mínimo de similitud coseno (0.0 – 1.0).
# Por debajo de este valor, el chunk no se considera relevante para la pregunta.
# Un valor de 0.0 devuelve todo; 1.0 solo devuelve coincidencias exactas.
UMBRAL_SIMILITUD = 0.50


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
    top_k: int = 5,
    umbral: float = UMBRAL_SIMILITUD,
) -> list[ChunkRecuperado]:
    """
    Busca los top_k chunks más relevantes para `query` en la base de conocimiento.

    Estrategia A: busca en TODOS los documentos con estado_moderacion='aprobado',
    sin filtrar por tema_id. Esto permite que el corpus compartido/predefinido
    esté disponible para todos los temas, aunque el documento haya sido indexado
    bajo un único tema_id.

    El parámetro tema_id se conserva en la firma para trazabilidad en los logs
    y para futura implementación de la Estrategia B (filtro por tema).

    Pasos:
    1. Genera el embedding de la pregunta del usuario.
    2. Llama a match_chunks con p_tema_id=None (todos los docs aprobados).
    3. Devuelve lista ordenada de mayor a menor similitud.
    """
    # 1. Embedding de la query
    vector = generar_embedding(query)

    # 2. Búsqueda vectorial vía RPC — p_tema_id=None para buscar en todo el corpus aprobado
    try:
        resp = supabase.rpc(
            "match_chunks",
            {
                "query_embedding": vector,
                "match_threshold": umbral,
                "match_count": top_k,
                "p_tema_id": None,
            },
        ).execute()
    except Exception as e:
        logger.error("Error en búsqueda vectorial (match_chunks): %s", e)
        return []

    if not resp.data:
        return []

    # 3. Mapear a dataclass y ordenar por similitud descendente
    chunks = [
        ChunkRecuperado(
            id=row["id"],
            documento_id=row["documento_id"],
            contenido=row["contenido"],
            orden=row["orden"],
            similitud=float(row["similarity"]),
        )
        for row in resp.data
    ]
    chunks.sort(key=lambda c: c.similitud, reverse=True)

    logger.info(
        "Retriever: query=%r tema=%s (sin filtro tema) → %d chunks (umbral=%.2f)",
        query[:60],
        tema_id,
        len(chunks),
        umbral,
    )

    return chunks


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
