-- ============================================================
-- Verificación y documentación de políticas RLS — Fase 5
-- Tablas: evaluacion, pregunta, intento_evaluacion, respuesta_usuario
--
-- Estas políticas ya están incluidas en 01_schema_chatbot_erp.sql.
-- Este archivo sirve para RE-APLICAR en entornos limpios o verificar
-- que las políticas existen y son correctas.
--
-- Aplicar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- EVALUACION: lectura pública a autenticados (plantilla compartida)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "evaluacion_select_autenticados" ON public.evaluacion;

CREATE POLICY "evaluacion_select_autenticados" ON public.evaluacion
  FOR SELECT USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- PREGUNTA: lectura pública a autenticados
-- NOTA: respuesta_correcta está en la fila pero NUNCA se selecciona
--       desde el frontend. El backend usa service_role para leerla
--       durante la corrección. La política no puede ocultar columnas —
--       el filtrado se hace en el schema Pydantic (PreguntaOut).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "pregunta_select_autenticados" ON public.pregunta;

CREATE POLICY "pregunta_select_autenticados" ON public.pregunta
  FOR SELECT USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- INTENTO_EVALUACION: acceso estrictamente privado al dueño
-- Un usuario solo ve/escribe sus propios intentos.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "intento_evaluacion_propio" ON public.intento_evaluacion;

CREATE POLICY "intento_evaluacion_propio" ON public.intento_evaluacion
  FOR ALL USING (usuario_id = auth.uid());

-- ------------------------------------------------------------
-- RESPUESTA_USUARIO: acceso a través del intento del dueño
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "respuesta_usuario_segun_intento_propio" ON public.respuesta_usuario;

CREATE POLICY "respuesta_usuario_segun_intento_propio" ON public.respuesta_usuario
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.intento_evaluacion i
      WHERE i.id = respuesta_usuario.intento_id
        AND i.usuario_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Verificación (ejecutar luego del CREATE POLICY)
-- Devuelve las políticas activas sobre las 4 tablas.
-- ------------------------------------------------------------
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN (
  'evaluacion', 'pregunta', 'intento_evaluacion', 'respuesta_usuario'
)
ORDER BY tablename, policyname;
