# Implementaciones — Fase 6: Perfil y seguimiento de progreso

---

## Bloque 1 — Endpoints de perfil y progreso

### Archivos creados

**`backend/app/perfil/__init__.py`** *(nuevo módulo)*

**`backend/app/perfil/router.py`** *(nuevo)*

7 endpoints, todos JWT-protegidos con `Depends(get_current_user_id)`:

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/perfil`                        | Datos del usuario autenticado |
| `PATCH`  | `/perfil`                        | Actualizar nombre (único campo editable) |
| `GET`    | `/perfil/progreso`               | Resumen de actividad (temas, evaluaciones, puntajes) |
| `GET`    | `/perfil/sesiones`               | Historial de sesiones de chat con nombre de tema |
| `GET`    | `/perfil/evaluaciones`           | Historial de intentos completados con puntaje 0-20 |
| `GET`    | `/perfil/documentos`             | Documentos propios del usuario |
| `DELETE` | `/perfil/documentos/{id}`        | Eliminar documento propio (BD + Storage) |

**`backend/app/main.py`** — `perfil_router` registrado.

#### Decisiones de diseño

- `PATCH /perfil`: solo permite cambiar `nombre` — correo y rol no son editables desde el cliente. Validación de nombre vacío con 422.
- `GET /perfil/progreso`: calcula todo en Python sobre datos de Supabase (sin RPCs SQL). Join `sesion_chat → tema`, join `intento_evaluacion → evaluacion → tema`. `puntaje_total` interno (0-1) se convierte a escala /20 en el servicio.
- `GET /perfil/evaluaciones`: filtra `completado_en IS NOT NULL` — solo intentos terminados. `aprobado` recalculado en servidor con umbral 11/20 (igual que en evaluaciones/router).
- `DELETE /perfil/documentos/{id}`: elimina chunks explícitamente + registro en `documento` + archivo en Storage `"documentos"` bucket. Misma lógica que `DELETE /documentos/{id}` en base_conocimiento/router (no duplica el endpoint existente — este filtra solo documentos propios del usuario).
- Todos los queries filtran por `user_id` explícitamente (backend usa service_role que ignora RLS).

### Verificación

7 endpoints confirmados en OpenAPI spec (`GET /openapi.json`):
- `GET /perfil` ✅
- `PATCH /perfil` ✅
- `GET /perfil/progreso` ✅
- `GET /perfil/sesiones` ✅
- `GET /perfil/evaluaciones` ✅
- `GET /perfil/documentos` ✅
- `DELETE /perfil/documentos/{documento_id}` ✅
