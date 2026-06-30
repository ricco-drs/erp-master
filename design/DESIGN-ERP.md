# Design system — ChatERP

Sistema de diseño extraído de referencias visuales reales (hackO.dev, Vercel dashboard, Workly, y otros paneles minimalistas). Este documento es la fuente de verdad para cualquier decisión de UI en el frontend — no improvisar estilos distintos a mitad de desarrollo.

## Principios

- Modo oscuro único, siempre. No se implementa modo claro.
- Bajo contraste entre superficies: el fondo y las cards casi se confunden hasta que hay interacción o jerarquía que resaltar.
- Bordes finos (1px) en vez de sombras para separar regiones. Nada de `box-shadow` difuso decorativo.
- Esquinas casi rectas. Nada de cards muy redondeadas.
- Espacio negativo generoso. La densidad de información se logra con grid y jerarquía tipográfica, no con relleno decorativo.
- Un solo color de acento. Nunca paletas multicolor tipo SaaS genérico.
- Sin gradientes decorativos de fondo, sin iconos coloridos, sin ilustraciones 3D.

## Paleta de colores

| Token | Valor | Uso |
|---|---|---|
| `--bg-base` | `#0A0A0A` | Fondo general de la aplicación |
| `--bg-surface` | `#121212` | Cards, paneles, sidebar |
| `--bg-surface-hover` | `#1A1A1A` | Estado hover sobre cards/items |
| `--border` | `#262626` | Bordes finos entre regiones (1px) |
| `--border-strong` | `#3A3A3A` | Bordes con más énfasis (inputs activos, foco) |
| `--text-primary` | `#FAFAFA` | Texto principal |
| `--text-secondary` | `#A1A1A1` | Texto secundario, descripciones |
| `--text-muted` | `#6B6B6B` | Labels de sección, hints, placeholders |
| `--accent` | `#4ADE80` | Verde menta — único color de acento (botones primarios, estados activos, highlights, links) |
| `--accent-hover` | `#3FCB72` | Hover sobre elementos con acento |
| `--accent-muted` | `#1A2E22` | Fondo sutil para badges/estados con tono de acento |
| `--danger` | `#EF4444` | Errores, validaciones fallidas (uso puntual, no decorativo) |

No se agregan colores adicionales fuera de esta tabla sin justificación explícita.

## Tipografía

Familia: **Inter** (alternativas aceptadas si no está disponible: Poppins, League Spartan — siempre sans-serif geométrica/neo-grotesque, nunca serif, nunca fuentes con personalidad decorativa).

| Uso | Tamaño | Peso |
|---|---|---|
| Título principal (hero) | 36–40px | 600 |
| Título de sección (h2) | 22–24px | 600 |
| Título de card (h3) | 16–18px | 500 |
| Cuerpo de texto | 14–15px | 400 |
| Texto secundario / descripciones | 13px | 400 |
| Labels de sección (mayúsculas, sidebar) | 11px | 500, letter-spacing ampliado |

Nada de tamaños tipo "hero agresivo" (60px+). Los títulos son grandes pero contenidos.

## Bordes y radios

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 4px | Botones, badges, inputs |
| `--radius-md` | 6px | Cards |
| `--radius-lg` | 8px | Contenedores grandes (modales, paneles) — techo máximo, no se usa nada mayor |

Nunca usar radios de 12px+ salvo excepción justificada explícitamente.

## Bordes vs. sombras

Separar regiones con `border: 1px solid var(--border)`, no con `box-shadow`. Las sombras solo se permiten en casos puntuales de elevación real (un dropdown o modal flotando sobre contenido), nunca como decoración de cards en reposo.

## Espaciado

Sistema de 4px base: `4, 8, 12, 16, 24, 32, 48, 64`. Preferir espacio generoso entre secciones (32–48px) sobre relleno decorativo dentro de los componentes.

## Componentes — patrones de referencia

### Sidebar de navegación
- Fondo `--bg-surface`, separado del contenido principal con `border-right: 1px solid var(--border)`.
- Items de navegación con icono + label, radio `--radius-sm`, fondo `--bg-surface-hover` solo en el item activo.
- Agrupación de items bajo labels de sección en mayúsculas pequeñas (`--text-muted`), como "OTHER" en la referencia de Workly.

### Cards de estadísticas / métricas
- Borde fino `1px solid var(--border)`, sin sombra.
- Número grande (24–32px, peso 600) + label pequeño debajo (`--text-secondary`).
- Sin iconos decorativos coloridos — si llevan icono, en `--text-muted` o `--accent`, nunca multicolor.

### Botones
- Primario: fondo `--accent`, texto `--bg-base` (texto oscuro sobre verde, no blanco), radio `--radius-sm`, sin gradiente.
- Secundario: fondo transparente, borde `1px solid var(--border-strong)`, texto `--text-primary`.
- Nunca gradientes decorativos en botones (excepción: si en algún punto se justifica un único CTA premium destacado, podría llevar un degradado sutil, pero no es el patrón por defecto del proyecto).

### Inputs
- Fondo `--bg-surface`, borde `1px solid var(--border)`, foco con `border-color: var(--accent)`.
- Radio `--radius-sm`. Placeholder en `--text-muted`.

### Tablas / listas densas
- Filas separadas por `border-bottom: 1px solid var(--border)`, sin fondo alternado (zebra striping) salvo que la densidad de datos lo requiera.
- Texto de filas en `--text-primary`, metadata secundaria en `--text-secondary`.

## Aplicación específica al chatbot ERP

- **Pantalla de chat**: burbujas de mensaje del usuario con fondo `--bg-surface-hover`, respuestas del asistente sin burbuja (texto directo sobre `--bg-base`, como una conversación tipo terminal/editorial, no estilo WhatsApp con burbujas redondeadas).
- **Selector de tema/módulo**: cards con borde fino, radio `--radius-md`, estado activo con `border-color: var(--accent)`.
- **Indicadores de progreso/carga**: usar `--accent` para barras de progreso y spinners, nunca colores multicolor.
- **Resultados de evaluación**: usar `--accent` para respuestas correctas, `--danger` (uso puntual) para incorrectas — sin íconos de colorido excesivo, solo check/x minimalistas en esos dos colores.
- **Badges de estado** (documento pendiente/aprobado/rechazado): fondo `--accent-muted` + texto `--accent` para aprobado; tonos de `--text-muted` para pendiente; `--danger` con opacidad reducida para rechazado.

## Lo que se descarta explícitamente

- Gradientes decorativos de fondo.
- Sombras difusas en cards de reposo.
- Iconos coloridos o ilustraciones 3D.
- Cards con radio mayor a 8px.
- Paletas multicolor (más de un color de acento).
- Tamaños de título "hero" agresivos (60px+).
- Modo claro.
