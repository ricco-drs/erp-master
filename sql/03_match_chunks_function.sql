-- ============================================================
-- Función de búsqueda vectorial por similitud coseno para RAG
--
-- Usar en: Supabase Dashboard → SQL Editor → New query
--
-- Parámetros:
--   query_embedding  : vector de 384 dimensiones de la pregunta del usuario
--   match_threshold  : umbral mínimo de similitud (0.0 – 1.0). Se filtra en Python,
--                      pero se pasa aquí para pre-filtrar y aliviar tráfico.
--   match_count      : número máximo de chunks a devolver (top_k)
--   p_tema_id        : UUID del tema activo (NULL = buscar en todos los temas aprobados)
--
-- Solo devuelve chunks de documentos con estado_moderacion = 'aprobado'.
-- Esto cubre: seed predefinido + documentos compartidos aprobados por moderación.
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding  vector(384),
  match_threshold  float,
  match_count      int,
  p_tema_id        uuid DEFAULT NULL
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
    d.estado_moderacion = 'aprobado'
    AND (p_tema_id IS NULL OR d.tema_id = p_tema_id)
    AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
