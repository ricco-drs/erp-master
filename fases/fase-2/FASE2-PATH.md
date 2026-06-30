# Fase 2 — Backend base y autenticación

Desglose de tareas para llevar el proyecto desde el esqueleto inicial (Fase 1) hasta tener autenticación funcionando de extremo a extremo: usuario se registra, inicia sesión, y el backend reconoce su sesión en un endpoint protegido.

Checklist pensado para ejecutarse en orden — cada bloque depende del anterior.

---

## 1. Configuración base del backend (FastAPI)

- [ ] Escribir `app/core/config.py`: clase de configuración con Pydantic `BaseSettings` que lea las variables de entorno (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_PROVIDER`, `GROQ_API_KEY`, `OLLAMA_BASE_URL`, `EMBEDDING_MODEL`).
- [ ] Validar que `config.py` falle de forma clara (no en silencio) si falta una variable obligatoria al arrancar.
- [ ] Escribir `app/core/supabase_client.py`: inicializar el cliente de Supabase usando el `service_role key`, exportar una función/instancia reutilizable para los módulos.
- [ ] Escribir `app/main.py`: instancia de FastAPI, configuración de CORS (permitir el origen del frontend, `http://localhost:3000` en desarrollo), endpoint `GET /health` que responda `{"status": "ok"}`.
- [ ] Levantar el servidor (`uvicorn app.main:app --reload --port 8000`) y verificar `http://localhost:8000/health` y `http://localhost:8000/docs`.

**Verificación de bloque:** el backend levanta sin errores y `/health` responde correctamente.

---

## 2. Autenticación en el frontend (Supabase Auth)

- [ ] Escribir `lib/supabase/client.ts`: inicializar el cliente de Supabase en el frontend usando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Confirmar en el dashboard de Supabase que el proveedor "Email" está habilitado y que la confirmación de correo está desactivada (ya definido en conversaciones previas).
- [ ] Construir la pantalla de registro (`app/(auth)/registro`): formulario con nombre, correo, contraseña; llamada a `supabase.auth.signUp()` pasando `nombre` en `options.data` para que el trigger `handle_new_user` lo capture.
- [ ] Construir la pantalla de login (`app/(auth)/login`): formulario con correo y contraseña; llamada a `supabase.auth.signInWithPassword()`.
- [ ] Manejo de errores visibles al usuario (correo ya registrado, credenciales inválidas) — sin mostrar errores técnicos crudos (RNF-10).
- [ ] Aplicar el design system (`docs/design-system.md`) a ambas pantallas: paleta oscura, bordes finos, radios bajos, tipografía Inter.
- [ ] Redirección tras login/registro exitoso hacia una ruta protegida de prueba (por ejemplo, una página vacía `/dashboard`).

**Verificación de bloque:** un usuario puede registrarse desde la UI y aparece tanto en `auth.users` como en `public.usuario` (gracias al trigger).

---

## 3. Persistencia y estado de sesión en el frontend

- [ ] Implementar un contexto/provider de sesión (`SupabaseProvider` o equivalente) que envuelva la app y exponga el usuario actual.
- [ ] Suscribirse a `supabase.auth.onAuthStateChange()` para reaccionar a login/logout en tiempo real sin recargar la página.
- [ ] Implementar botón/acción de logout (`supabase.auth.signOut()`).
- [ ] Proteger rutas del lado del cliente: si no hay sesión activa, redirigir a `/login` al intentar acceder a rutas protegidas (`/chat`, `/evaluaciones`, `/perfil`).
- [ ] Verificar que al refrescar la página (F5) la sesión persiste (el SDK de Supabase debe recuperarla automáticamente desde el storage del navegador).

**Verificación de bloque:** cerrar sesión, refrescar, volver a iniciar sesión — el estado se comporta de forma consistente en todos los casos.

---

## 4. Validación de sesión en el backend

- [ ] Escribir una dependencia de FastAPI (`app/core/auth.py` o similar) que extraiga el JWT del header `Authorization: Bearer <token>` de cada request.
- [ ] Validar el JWT contra Supabase (usando el cliente con `anon key` o verificando la firma con el JWT secret del proyecto, según el método que ofrezca `supabase-py`).
- [ ] Si el token es inválido o falta, devolver `401 Unauthorized` con un mensaje claro.
- [ ] Si el token es válido, extraer el `user_id` y dejarlo disponible para el endpoint (inyectado vía `Depends()`).
- [ ] Crear un endpoint protegido de prueba, por ejemplo `GET /me`, que devuelva los datos del usuario autenticado consultando la tabla `public.usuario`.

**Verificación de bloque:** llamar a `GET /me` sin token devuelve 401; llamando con el token de una sesión real devuelve los datos correctos del usuario.

---

## 5. Conexión frontend → backend autenticado

- [ ] En el frontend, crear una función/utilidad (`lib/api.ts` o similar) que arme las llamadas al backend (`NEXT_PUBLIC_API_URL`) incluyendo automáticamente el JWT de la sesión activa en el header `Authorization`.
- [ ] Probar la llamada a `GET /me` desde el frontend tras iniciar sesión, mostrando el resultado en la pantalla de prueba (`/dashboard`).
- [ ] Confirmar que, si la sesión expira o no existe, la llamada al backend falla de forma controlada y redirige al login (no debe quedar la UI colgada o mostrando un error crudo).

**Verificación de bloque:** flujo completo end-to-end — registro → login → el frontend llama al backend autenticado → el backend responde con los datos correctos del usuario.

---

## 6. Cierre de la fase

- [ ] Revisar que ninguna clave sensible (`service_role key`, JWT secret) esté expuesta en código de frontend o en el repositorio (RNF-05).
- [ ] Confirmar que las políticas RLS de la tabla `usuario` siguen activas y correctas (cada quien solo ve/edita su propio perfil).
- [ ] Actualizar `docs/fases-proyecto.md` marcando la Fase 2 como completada.
- [ ] Commit y push de todo lo desarrollado en esta fase, con mensajes de commit descriptivos (idealmente uno por bloque de tareas, no un solo commit gigante).

**Condición de salida de la fase:** un usuario puede registrarse, iniciar sesión, refrescar la página sin perder sesión, cerrar sesión, y el backend reconoce y valida correctamente su sesión en un endpoint protegido — todo con el diseño visual ya aplicado y sin credenciales expuestas.
