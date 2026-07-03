# Registro de cambios - Ricco

Este documento detalla todos los cambios realizados sobre el proyecto ChatERP.
Todos los cambios son exclusivamente del lado del frontend (Next.js). No se modificó
el backend, la base de datos ni la lógica del servidor.

---

## 1. Cambio de paleta de colores (tema visual)

Se reemplazó el tema oscuro con acento verde por un tema claro con acento turquesa,
a pedido del cliente.

Archivo modificado: `frontend/app/globals.css`

Los colores se manejan de forma centralizada mediante variables CSS en el bloque
`:root`. Al cambiar esos valores, todo el proyecto se re-tematiza automáticamente,
porque los componentes usan las variables (por ejemplo `var(--accent)`) en lugar de
colores fijos.

Valores anteriores (tema oscuro):

- Fondo base: #0A0A0A (negro)
- Acento: #4ADE80 (verde)

Valores nuevos (tema claro con turquesa):

- `--bg-base`: #F6FAFB (fondo casi blanco)
- `--bg-surface`: #FFFFFF (tarjetas y paneles)
- `--bg-surface-hover`: #EDF6F7 (fondo al pasar el cursor)
- `--border`: #DCE8EA (bordes sutiles)
- `--border-strong`: #C2D6D9 (bordes marcados)
- `--text-primary`: #0E2C31 (texto principal, oscuro)
- `--text-secondary`: #52696E (texto secundario)
- `--text-muted`: #82999D (texto tenue)
- `--accent`: #22B1C2 (turquesa, color de marca)
- `--accent-hover`: #1C93A2 (turquesa al pasar el cursor)
- `--accent-muted`: #D6F0F3 (turquesa apagado para fondos)
- `--danger`: #EF4444 (rojo de error, sin cambios)

Nota: el color turquesa elegido es el "Turquoise Blue" (#22B1C2 / RGB 34, 177, 194).

---

## 2. Ajustes en la landing (pagina publica de inicio)

Archivo modificado: `frontend/app/page.tsx`

La landing tenia algunos colores oscuros escritos directamente en el codigo
(no leian las variables), por lo que no se adaptaban al nuevo tema claro. Se
corrigieron:

- Barra de navegacion superior: el fondo paso de `rgba(10,10,10,0.92)` (oscuro) a
  `rgba(255,255,255,0.85)` (blanco translucido), manteniendo el efecto de desenfoque.
- Degradados de los extremos del carrusel de miembros: pasaron de `#0A0A0A` (negro
  fijo) a `var(--bg-base)`, para que se fundan con el fondo y se adapten a cualquier
  tema.

---

## 3. Nueva funcionalidad: evaluaciones tipo encuesta (escala Likert)

Se reemplazo el sistema de evaluaciones. Antes, cada tema mostraba un boton que, al
presionarlo, pedia al modelo de lenguaje (LLM) que generara preguntas de forma
automatica. Ahora se muestran cuatro evaluaciones fijas, alineadas a las cuatro
variables de la investigacion, con preguntas predefinidas en escala Likert.

Esta funcionalidad es completamente del lado del frontend: no usa el backend, ni la
base de datos, ni el modelo de lenguaje. Todo (preguntas y calculo de resultados)
ocurre en el navegador.

### Archivos involucrados

- Archivo nuevo: `frontend/lib/encuestas-data.ts`
  Contiene las cuatro evaluaciones con sus 31 preguntas, organizadas por dimension,
  y toda la logica de calculo del perfil.

- Archivo reemplazado: `frontend/app/(protected)/evaluaciones/page.tsx`
  Antes mostraba la lista de temas obtenida del backend y generaba evaluaciones con
  el LLM. Ahora muestra unicamente cuatro tarjetas (una por variable), tomadas del
  archivo de datos local. Las aproximadamente 25 tarjetas anteriores quedaron ocultas.

- Archivo nuevo: `frontend/app/(protected)/evaluaciones/encuesta/[slug]/page.tsx`
  Es la pantalla que muestra las preguntas de la encuesta y, al terminar, el perfil
  de resultados. Responder y ver resultados ocurre en la misma pagina.

### Las cuatro evaluaciones y sus preguntas

1. Gestion del Cambio (9 preguntas)
   - Comunicacion (3), Capacitacion (3), Resistencia al cambio (3, invertidas)

2. Etica Profesional (6 preguntas)
   - Integridad (3), Transparencia (3)

3. Desempeno Operativo (8 preguntas)
   - Eficiencia (3), Adopcion del ERP (3), Cumplimiento de tiempos (2)

4. Confiabilidad de la Informacion (8 preguntas)
   - Exactitud (3), Seguridad (3), Consistencia (2)

Total: 31 preguntas.

Todas las preguntas se redactaron como afirmaciones (no como preguntas), que es el
formato correcto para una escala Likert. Cada una se responde con cinco opciones:

- Totalmente en desacuerdo
- En desacuerdo
- Neutral
- De acuerdo
- Totalmente de acuerdo

### Como se calculan los resultados (modo encuesta)

Al ser una encuesta de percepcion, no hay respuestas correctas o incorrectas. El
resultado es un perfil por dimension y por variable. El calculo es el siguiente:

1. Cada respuesta se convierte en un numero del 1 al 5 (Totalmente en desacuerdo = 1,
   Totalmente de acuerdo = 5).

2. Las preguntas redactadas en sentido negativo (donde estar de acuerdo es
   desfavorable) se recodifican con la formula `6 - valor`. Asi, un promedio alto
   siempre indica una percepcion favorable. Las preguntas invertidas son las numeros
   globales 7, 8, 9, 23, 26 y 31.

3. Se calcula el promedio de las preguntas de cada dimension.

4. Se calcula el promedio de las dimensiones para obtener el puntaje de la variable.
   Cada dimension pesa igual, sin importar cuantas preguntas tenga.

5. El promedio (escala 1 a 5) se traduce a un nivel cualitativo:
   - Mayor o igual a 3.7: Favorable (verde)
   - Mayor o igual a 2.4: Moderado (ambar)
   - Menor a 2.4: Desfavorable (rojo)

6. Tambien se muestra un porcentaje, con la formula `((promedio - 1) / 4) * 100`, que
   convierte la escala 1-5 a 0-100 por ciento.

El resultado en pantalla muestra el puntaje de la variable sobre 5, su nivel, y una
barra de progreso por cada dimension.

---

## 4. Ajustes visuales de la pagina de evaluaciones y de resultados

A pedido del cliente se simplifico la interfaz:

En la lista de evaluaciones (`frontend/app/(protected)/evaluaciones/page.tsx`):

- Se elimino el texto superior "Modulo de evaluacion".
- El titulo paso de "Evaluaciones por variable" a solo "Evaluaciones".
- Se elimino el subtitulo descriptivo.
- Se eliminaron las etiquetas de variable de cada tarjeta ("Variable Independiente 1",
  "Variable Independiente 2", "Variable Dependiente 1", "Variable Dependiente 2").
- Se elimino el texto "X dimensiones" del pie de cada tarjeta, dejando solo el numero
  de preguntas.

En la pantalla de resultados (`frontend/app/(protected)/evaluaciones/encuesta/[slug]/page.tsx`):

- Se elimino la etiqueta de variable que aparecia arriba del titulo.
- Se elimino el texto explicativo final sobre la escala Likert.

En el cuestionario:

- Se hizo que cada evaluacion numere sus preguntas empezando desde 1 (antes usaban la
  numeracion global 1 a 31). El calculo interno sigue usando el numero global, por lo
  que los resultados no se ven afectados.

---

## 5. Cambio temporal para previsualizacion local (YA REVERTIDO)

Archivo afectado en su momento: `frontend/app/(protected)/layout.tsx`

Durante el desarrollo se agrego de forma temporal un interruptor llamado
`PREVIEW_SIN_LOGIN`, puesto en `true`, que desactivaba la redireccion al login. Se
uso unicamente para poder ver las paginas internas en local sin iniciar sesion, ya
que no se contaba con acceso al backend en el entorno de desarrollo.

Este cambio ya fue revertido por completo. El archivo `layout.tsx` quedo identico al
original y la proteccion de sesion esta restaurada. No queda ningun rastro del
interruptor en el codigo.

---

## 6. Archivo de entorno local

Se creo el archivo `frontend/.env.local` con valores de relleno (placeholder) para que
la aplicacion pudiera arrancar en local. Este archivo esta ignorado por Git (por las
reglas `.env*` en los archivos `.gitignore`), por lo que no se sube al repositorio.

---

## Resumen de archivos afectados

Nuevos:

- `frontend/lib/encuestas-data.ts`
- `frontend/app/(protected)/evaluaciones/encuesta/[slug]/page.tsx`
- `frontend/.env.local` (ignorado por Git, no se sube)

Modificados:

- `frontend/app/globals.css`
- `frontend/app/page.tsx`
- `frontend/app/(protected)/evaluaciones/page.tsx`

Nota: el archivo `frontend/app/(protected)/layout.tsx` se modifico temporalmente
durante el desarrollo, pero ya fue revertido a su estado original (ver seccion 5).

---

## Pendientes antes de hacer commit

1. Verificar que el archivo `.env.local` no se incluya en el commit (ya esta ignorado
   por Git).
2. Agregar al commit unicamente los cambios de la carpeta `frontend`.
