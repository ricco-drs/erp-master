-- ============================================================
-- 1. Agrega columna `nombre` a sesion_chat para identificar chats
-- 2. Actualiza match_chunks para filtrar por usuario y excluir archivados/eliminados
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1. sesion_chat: columna nombre
--    Para subtemas: se asigna el nombre del subtema.
--    Para chats generales: se asigna la primera pregunta del usuario.
-- ------------------------------------------------------------
ALTER TABLE public.sesion_chat
  ADD COLUMN IF NOT EXISTS nombre text;

-- ------------------------------------------------------------
-- 2. match_chunks: filtra por usuario del documento + excluye archivados/eliminados
--    Ahora acepta p_usuario_id para retornar solo:
--      - Documentos propios del usuario (privados)
--      - Documentos compartidos y aprobados (seed + terceros)
--      - Excluye archivados (archivada_en) y eliminados (eliminada_en)
--    Cuando p_usuario_id es NULL, retorna solo documentos compartidos+aprobados.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding  vector(384),
  match_threshold  float,
  match_count      int,
  p_tema_id        uuid DEFAULT NULL,
  p_usuario_id     uuid DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  documento_id uuid,
  contenido    text,
  orden        int,
  similarity   float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.documento_id,
    c.contenido,
    c.orden,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM public.chunk c
  JOIN public.documento d ON d.id = c.documento_id
  WHERE
    -- Excluir archivados y eliminados
    d.eliminada_en IS NULL
    AND d.archivada_en IS NULL
    AND (
      -- Documentos propios del usuario: disponibles en CUALQUIER chat (sin filtro tema)
      (p_usuario_id IS NOT NULL AND d.usuario_id = p_usuario_id)
      OR
      -- Documentos compartidos/aprobados (seed + terceros): filtrados por tema
      (
        d.visibilidad = 'compartido' AND d.estado_moderacion = 'aprobado'
        AND (p_tema_id IS NULL OR d.tema_id = p_tema_id)
      )
    )
    AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
