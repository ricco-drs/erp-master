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
    Busca los top_k chunks más relevantes para `query` dentro del `tema_id`.

    Pasos:
    1. Genera el embedding de la pregunta del usuario.
    2. Llama a la función SQL `match_chunks` en Supabase (búsqueda HNSW coseno).
    3. Filtra por `umbral` de similitud (ya pre-filtrado en SQL para eficiencia).
    4. Devuelve lista ordenada de mayor a menor similitud.

    Si no hay ningún chunk que supere el umbral, devuelve lista vacía.
    Eso es lo que el servicio de chat usa para decidir si rechaza la pregunta
    por fuera de alcance, sin llamar al LLM.
    """
    # 1. Embedding de la query
    vector = generar_embedding(query)

    # 2. Búsqueda vectorial vía RPC (función SQL con índice HNSW)
    try:
        resp = supabase.rpc(
            "match_chunks",
            {
                "query_embedding": vector,
                "match_threshold": umbral,
                "match_count": top_k,
                "p_tema_id": tema_id,
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
        "Retriever: query=%r tema=%s → %d chunks (umbral=%.2f)",
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
