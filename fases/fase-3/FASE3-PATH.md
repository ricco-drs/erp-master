# Fase 3 — Base de conocimiento (ingesta de documentos)

Desglose de tareas para llevar el proyecto desde autenticación funcional (Fase 2) hasta tener un pipeline completo de ingesta de documentos: extracción de texto, fragmentación, generación de embeddings, moderación automática, y almacenamiento en Supabase (base de datos + Storage).

Checklist pensado para ejecutarse en orden — cada bloque depende del anterior. Cubre RF-05 a RF-10 y RF-23.

---

## 1. Extracción de texto

- [ ] Escribir `app/base_conocimiento/extraccion.py` con una función `extraer_texto(archivo, formato)` que reciba el archivo y su formato y devuelva texto plano.
- [ ] Implementar extracción para PDF (usando `pypdf` o `pdfplumber`).
- [ ] Implementar extracción para Word (usando `python-docx`).
- [ ] Implementar lectura directa para `.txt` y `.md`.
- [ ] Manejar errores de archivo corrupto o ilegible, devolviendo un error claro (no un crash silencioso) — conecta con RNF-10.
- [ ] Probar con un archivo de cada formato (PDF, DOCX, TXT, MD) y confirmar que el texto extraído es legible y completo.

**Verificación de bloque:** los 4 formatos extraen texto correctamente; un archivo corrupto devuelve un error manejado, no una excepción sin capturar.

---

## 2. Fragmentación (chunking)

- [ ] Escribir `app/base_conocimiento/chunking.py` con una función `fragmentar_texto(texto)` que divida el texto en chunks de tamaño razonable (por ejemplo, 300-500 tokens por chunk, con solapamiento de 50-100 tokens entre chunks consecutivos para no perder contexto en los bordes).
- [ ] Definir la estrategia de corte: preferir cortar en límites de oración o párrafo en vez de cortar a mitad de palabra/oración.
- [ ] Cada chunk debe llevar un número de `orden` para mantener la secuencia original del documento.
- [ ] Probar con un documento largo (10+ páginas) y confirmar que los chunks resultantes tienen tamaño consistente y no pierden información en los cortes.

**Verificación de bloque:** un PDF de prueba de varias páginas se fragmenta en chunks coherentes, ordenados, sin texto cortado de forma ilegible.

---

## 3. Generación de embeddings

- [ ] Escribir `app/base_conocimiento/embeddings.py`: cargar el modelo `all-MiniLM-L6-v2` de `sentence-transformers` una sola vez (no recargar en cada llamada — usar un singleton o cargar al iniciar la app).
- [ ] Función `generar_embedding(texto)` que devuelva un vector de 384 dimensiones.
- [ ] Función batch `generar_embeddings(lista_de_chunks)` para procesar todos los chunks de un documento en una sola pasada (más eficiente que uno por uno).
- [ ] Validar que la dimensión del vector generado coincide exactamente con la columna `vector(384)` de la tabla `chunk` en Supabase.
- [ ] Medir el tiempo de procesamiento para un PDF de 20 páginas y confirmar que se mantiene dentro de los 30 segundos definidos en RNF-03.

**Verificación de bloque:** generar embeddings para un documento de prueba completo sin errores, dentro del tiempo límite, con la dimensión correcta.

---

## 4. Moderación automática (documentos compartidos)

- [ ] Escribir `app/base_conocimiento/moderacion.py`: función `moderar_documento(texto_extraido)` que use el LLM (vía `llm_provider.py`, ya definido en Fase 2) para evaluar si el contenido es relevante a ERP y no contiene material inapropiado.
- [ ] Diseñar el prompt de moderación con cuidado: debe devolver una respuesta estructurada y parseable (por ejemplo JSON con `{"aprobado": true/false, "motivo": "..."}"`), no texto libre ambiguo.
- [ ] Manejar el caso de que el LLM devuelva una respuesta mal formada (reintento limitado, o fallback a estado "pendiente" para revisión, nunca aprobar por defecto ante una respuesta ambigua).
- [ ] Solo ejecutar la moderación cuando `visibilidad = 'compartido'`; los documentos privados se saltan este paso (RF-08).
- [ ] Si el documento es rechazado, guardar el motivo en `documento.motivo_rechazo` y notificar al usuario (RF-09).
- [ ] Probar con tres casos: un documento claramente relacionado a ERP (debe aprobar), uno claramente no relacionado (debe rechazar), y uno ambiguo/borderline (revisar el comportamiento y ajustar el prompt si es necesario).

**Verificación de bloque:** los tres casos de prueba se comportan según lo esperado, y el motivo de rechazo queda registrado de forma legible para el usuario.

---

## 5. Endpoints de subida, listado y eliminación

- [ ] Endpoint `POST /documentos`: recibe el archivo (multipart/form-data), `tema_id`, `visibilidad`; ejecuta el pipeline completo (extracción → chunking → embeddings → moderación si aplica) y persiste en Supabase.
- [ ] Validar tipo de archivo (solo PDF, DOCX, TXT, MD) y tamaño máximo (10MB, según RNF-08) antes de procesar.
- [ ] Subir el archivo original a Supabase Storage (bucket `documentos`, ruta `{usuario_id}/{documento_id}.{formato}`) y guardar `storage_path` en la tabla `documento`.
- [ ] Insertar los chunks generados (con sus embeddings) en la tabla `chunk`, asociados al `documento_id`.
- [ ] Endpoint `GET /documentos`: lista los documentos del usuario autenticado (propios) más los compartidos y aprobados de otros usuarios.
- [ ] Endpoint `DELETE /documentos/{id}`: elimina el documento (cascada a sus chunks por la FK), valida que solo el dueño pueda eliminarlo (RF-23).
- [ ] Mostrar indicador de progreso en el endpoint de subida (RNF-03) — considerar respuesta asíncrona o polling de estado si el procesamiento toma varios segundos.

**Verificación de bloque:** subir, listar y eliminar un documento funciona de extremo a extremo vía API (probado con `/docs` de FastAPI o un cliente HTTP).

---

## 6. Carga de la base de conocimiento predefinida

- [ ] Definir los temas base (módulos, buenas prácticas, terminología, capacitación, ética, gestión del cambio) como entradas en la tabla `tema` con `es_predefinido = true`.
- [ ] Preparar el contenido fuente para cada tema (puede basarse en el marco teórico del trabajo de investigación — `Grupo_3_Avance_4.pdf` ya tiene contenido aprovechable sobre ERP, gestión del cambio y capacitación).
- [ ] Escribir un script de carga inicial (`scripts/seed_temas.py` o similar) que tome ese contenido, lo pase por el mismo pipeline (chunking + embeddings) y lo inserte como documentos base asociados a cada tema.
- [ ] Ejecutar el script y confirmar que los temas predefinidos quedan con contenido consultable en la base de conocimiento.

**Verificación de bloque:** al menos 3-4 temas predefinidos tienen contenido real cargado y disponible para ser consultado (esto habilita poder empezar a probar el RAG en la Fase 4 sin depender de que un usuario suba documentos primero).

---

## 7. Frontend: pantalla de gestión de documentos

- [ ] Pantalla de subida de documentos: selector de archivo, selector de tema, toggle de visibilidad (privado/compartido), aplicando el design system (`docs/design-system.md`).
- [ ] Indicador de carga/progreso durante el procesamiento (RNF-11).
- [ ] Listado de documentos propios con su estado de moderación visible (badge: pendiente / aprobado / rechazado, según los colores definidos en el design system).
- [ ] Mostrar el motivo de rechazo cuando aplique.
- [ ] Acción de eliminar documento desde la UI, con confirmación antes de borrar.
- [ ] Manejo de errores visibles (archivo muy grande, formato no soportado, fallo de red) sin mostrar errores técnicos crudos.

**Verificación de bloque:** un usuario puede subir un documento desde la UI, ver su estado de moderación actualizarse, y eliminarlo si lo desea — todo con el estilo visual ya aplicado.

---

## 8. Cierre de la fase

- [ ] Revisar que las políticas RLS de `documento` y `chunk` siguen funcionando correctamente con el flujo real (un usuario no puede ver documentos privados de otro).
- [ ] Revisar que las políticas de Storage funcionan igual (un usuario no puede acceder al archivo original de un documento privado ajeno).
- [ ] Confirmar que ningún paso del pipeline expone el `service_role key` al frontend.
- [ ] Actualizar `docs/fases-proyecto.md` marcando la Fase 3 como completada.
- [ ] Commit y push de todo lo desarrollado en esta fase, en commits separados por bloque cuando tenga sentido.

**Condición de salida de la fase:** subir un PDF de prueba se procesa correctamente, se genera contenido consultable; los temas predefinidos ya tienen contenido cargado; el sistema de moderación distingue correctamente contenido relevante de no relevante; toda la gestión de documentos (subida, listado, eliminación) funciona desde la UI con el diseño aplicado.
