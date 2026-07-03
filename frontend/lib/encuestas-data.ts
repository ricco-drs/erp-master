// ============================================================
// Encuestas de percepción (escala Likert) por variable de investigación.
// Modo encuesta: NO hay respuesta correcta; se calcula un perfil por
// dimensión y variable a partir del promedio de las respuestas (1-5).
//
// Todo vive en el frontend — no depende del backend ni de la base de datos.
// ============================================================

export interface PreguntaLikert {
  /** Número correlativo global (1-31), útil para trazabilidad. */
  n: number;
  texto: string;
  /**
   * Pregunta redactada "en negativo": estar de acuerdo es desfavorable.
   * Su valor se invierte (6 - valor) al calcular el perfil.
   */
  invertida?: boolean;
}

export interface DimensionLikert {
  nombre: string;
  preguntas: PreguntaLikert[];
}

export interface Encuesta {
  slug: string;
  etiquetaVariable: string; // "Variable Independiente 1", etc.
  titulo: string;
  descripcion: string;
  dimensiones: DimensionLikert[];
}

// Las 5 opciones de la escala Likert, con su valor numérico.
export const OPCIONES_LIKERT = [
  { valor: 1, label: "Totalmente en desacuerdo" },
  { valor: 2, label: "En desacuerdo" },
  { valor: 3, label: "Neutral" },
  { valor: 4, label: "De acuerdo" },
  { valor: 5, label: "Totalmente de acuerdo" },
] as const;

export const ENCUESTAS: Encuesta[] = [
  {
    slug: "gestion-cambio",
    etiquetaVariable: "Variable Independiente 1",
    titulo: "Gestión del Cambio",
    descripcion:
      "Comunicación, capacitación y resistencia durante la transición al ERP.",
    dimensiones: [
      {
        nombre: "Comunicación",
        preguntas: [
          { n: 1, texto: "Recibo información de forma frecuente y periódica sobre los avances del proyecto ERP." },
          { n: 2, texto: "Los mensajes sobre el ERP son claros y fáciles de entender para todos los niveles de la organización." },
          { n: 3, texto: "Existen canales formales (correos, reuniones, carteleras) para informar sobre los cambios del ERP." },
        ],
      },
      {
        nombre: "Capacitación",
        preguntas: [
          { n: 4, texto: "La capacitación que recibí fue suficiente para usar el ERP sin necesitar ayuda constante." },
          { n: 5, texto: "La capacitación incluyó práctica con casos reales de mi área de trabajo." },
          { n: 6, texto: "He recibido capacitación de actualización sobre las nuevas funcionalidades del ERP." },
        ],
      },
      {
        nombre: "Resistencia al cambio",
        preguntas: [
          { n: 7, texto: "Siento temor o incertidumbre al usar el ERP en lugar de los métodos anteriores.", invertida: true },
          { n: 8, texto: "Considero que el ERP complica más mi trabajo en lugar de facilitarlo.", invertida: true },
          { n: 9, texto: "Preferiría volver al sistema anterior antes que seguir usando el ERP.", invertida: true },
        ],
      },
    ],
  },
  {
    slug: "etica-profesional",
    etiquetaVariable: "Variable Independiente 2",
    titulo: "Ética Profesional",
    descripcion:
      "Integridad y transparencia en el manejo de la información del ERP.",
    dimensiones: [
      {
        nombre: "Integridad",
        preguntas: [
          { n: 10, texto: "Conozco el código de conducta para el manejo de datos en el ERP." },
          { n: 11, texto: "Los colaboradores registran la información con honestidad y sin manipulaciones." },
          { n: 12, texto: "Existen consecuencias claras para quienes manipulan información en el ERP." },
        ],
      },
      {
        nombre: "Transparencia",
        preguntas: [
          { n: 13, texto: "Los registros en el ERP son verificables y auditables en cualquier momento." },
          { n: 14, texto: "Se informa a los usuarios sobre quién accede y modifica los datos en el ERP." },
          { n: 15, texto: "Existen políticas claras sobre la confidencialidad de la información en el ERP." },
        ],
      },
    ],
  },
  {
    slug: "desempeno-operativo",
    etiquetaVariable: "Variable Dependiente 1",
    titulo: "Desempeño Operativo",
    descripcion:
      "Eficiencia, adopción y cumplimiento de tiempos con el ERP.",
    dimensiones: [
      {
        nombre: "Eficiencia",
        preguntas: [
          { n: 16, texto: "El ERP ha reducido el tiempo que tardo en realizar mis tareas diarias." },
          { n: 17, texto: "El ERP me permite realizar más tareas en el mismo tiempo que antes." },
          { n: 18, texto: "El ERP ha reducido la cantidad de errores en mis procesos operativos." },
        ],
      },
      {
        nombre: "Adopción del ERP",
        preguntas: [
          { n: 19, texto: "Utilizo el ERP a diario como parte fundamental de mi trabajo." },
          { n: 20, texto: "He integrado el ERP en todas las tareas donde es aplicable." },
          { n: 21, texto: "Recomendaría el uso del ERP a compañeros de otras áreas." },
        ],
      },
      {
        nombre: "Cumplimiento de tiempos",
        preguntas: [
          { n: 22, texto: "El proyecto ERP se ha desarrollado dentro de los plazos establecidos." },
          { n: 23, texto: "La resistencia al cambio ha generado retrasos en la implementación.", invertida: true },
        ],
      },
    ],
  },
  {
    slug: "confiabilidad-informacion",
    etiquetaVariable: "Variable Dependiente 2",
    titulo: "Confiabilidad de la Información",
    descripcion:
      "Exactitud, seguridad y consistencia de los datos del ERP.",
    dimensiones: [
      {
        nombre: "Exactitud",
        preguntas: [
          { n: 24, texto: "La información que genera el ERP es precisa y sin errores significativos." },
          { n: 25, texto: "Confío en los datos del ERP para tomar decisiones importantes." },
          { n: 26, texto: "He encontrado discrepancias entre los datos del ERP y la realidad operativa.", invertida: true },
        ],
      },
      {
        nombre: "Seguridad",
        preguntas: [
          { n: 27, texto: "El sistema ERP cuenta con controles de acceso que protegen la información sensible." },
          { n: 28, texto: "Los datos del ERP están protegidos contra accesos no autorizados." },
          { n: 29, texto: "Se realizan auditorías periódicas de los accesos al ERP." },
        ],
      },
      {
        nombre: "Consistencia",
        preguntas: [
          { n: 30, texto: "Los datos registrados en los diferentes módulos del ERP son coherentes entre sí." },
          { n: 31, texto: "He encontrado información contradictoria entre diferentes reportes del ERP.", invertida: true },
        ],
      },
    ],
  },
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

export function getEncuesta(slug: string): Encuesta | undefined {
  return ENCUESTAS.find((e) => e.slug === slug);
}

export function preguntasDeEncuesta(e: Encuesta): PreguntaLikert[] {
  return e.dimensiones.flatMap((d) => d.preguntas);
}

export function totalPreguntas(e: Encuesta): number {
  return preguntasDeEncuesta(e).length;
}

// ------------------------------------------------------------
// Cálculo del perfil (modo encuesta — Opción 1)
// ------------------------------------------------------------

export interface ResultadoDimension {
  nombre: string;
  promedio: number; // 1.0 – 5.0
}

export interface ResultadoEncuesta {
  promedioVariable: number; // 1.0 – 5.0
  dimensiones: ResultadoDimension[];
}

/**
 * Calcula el perfil a partir de las respuestas (n° de pregunta → valor 1-5).
 * Las preguntas invertidas se recodifican (6 - valor) para que un promedio
 * alto siempre signifique una percepción favorable.
 */
export function calcularResultado(
  encuesta: Encuesta,
  respuestas: Record<number, number>,
): ResultadoEncuesta {
  const dimensiones: ResultadoDimension[] = encuesta.dimensiones.map((dim) => {
    const valores = dim.preguntas.map((p) => {
      const bruto = respuestas[p.n] ?? 0;
      return p.invertida ? 6 - bruto : bruto;
    });
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    return { nombre: dim.nombre, promedio };
  });

  const promedioVariable =
    dimensiones.reduce((a, d) => a + d.promedio, 0) / dimensiones.length;

  return { promedioVariable, dimensiones };
}

export interface NivelPercepcion {
  label: string;
  color: string;
  emoji: string;
}

/** Traduce un promedio (1-5) a un nivel cualitativo con color. */
export function nivelPercepcion(promedio: number): NivelPercepcion {
  if (promedio >= 3.7) return { label: "Favorable", color: "#22C55E", emoji: "🟢" };
  if (promedio >= 2.4) return { label: "Moderado", color: "#F59E0B", emoji: "🟡" };
  return { label: "Desfavorable", color: "var(--danger)", emoji: "🔴" };
}
