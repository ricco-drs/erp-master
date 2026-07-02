"""
Seed de contenido educativo para los Módulos 1-5 del ERP-Chatbot.

Lee los archivos Markdown de contenido/modulo_*/,  los fragmenta, genera
embeddings locales (all-MiniLM-L6-v2 / 384 dims) y los inserta en Supabase
como documentos aprobados y compartidos, vinculados al tema correspondiente.

PREREQUISITOS:
  - El schema de Supabase debe estar aplicado (incluyendo 07 y 08).
  - Variables de entorno en backend/.env:
      SUPABASE_URL
      SUPABASE_SERVICE_ROLE_KEY
      EMBEDDING_MODEL  (opcional, default: all-MiniLM-L6-v2)

USO:
  cd backend
  python ../scripts/seed_modulos_1_2.py

  # Con un usuario específico como propietario de los documentos:
  SEED_USER_ID=<uuid> python ../scripts/seed_modulos_1_2.py

El script es idempotente: si ya existe un documento con el mismo
storage_path para el mismo tema, lo omite y continúa.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv
load_dotenv(ROOT / "backend" / ".env")

from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SEED_USER_ID = os.environ.get("SEED_USER_ID", "")

supabase: Client = create_client(SUPABASE_URL, SERVICE_KEY)

EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# ── Catálogo de contenido ─────────────────────────────────────────────────────
# Estructura: list de módulos, cada uno con su nombre y sub-temas.
# El campo "archivo" es relativo a ROOT/contenido/.
# "nombre_bd" es el nombre EXACTO como está en la tabla `tema` de Supabase.

MODULOS = [
    {
        "nombre": "Fundamentos de Sistemas ERP",
        "descripcion": (
            "Introducción a los sistemas ERP: qué son, cómo evolucionaron, "
            "sus módulos principales, beneficios, riesgos y comparativa con "
            "soluciones tradicionales."
        ),
        "orden": 1,
        "subtemas": [
            {
                "nombre_bd": "Qué es un ERP y evolución histórica",
                "nombre_seed": "Qué es un ERP y su evolución histórica",
                "descripcion": (
                    "Definición de ERP, el problema que resuelve, y la "
                    "evolución desde los sistemas de inventario de los 60 "
                    "hasta los ERP con IA de los 2020s."
                ),
                "orden": 1,
                "archivo": "modulo_1_fundamentos/01_que_es_erp_y_evolucion.md",
            },
            {
                "nombre_bd": "Módulos típicos de un ERP",
                "nombre_seed": "Módulos típicos de un ERP",
                "descripcion": (
                    "Descripción de los módulos estándar: Finanzas, Compras, "
                    "Inventario, Ventas, Producción, RRHH, Proyectos, CRM y BI. "
                    "Flujos de integración entre módulos."
                ),
                "orden": 2,
                "archivo": "modulo_1_fundamentos/02_modulos_tipicos.md",
            },
            {
                "nombre_bd": "Beneficios y riesgos de adopción",
                "nombre_seed": "Beneficios y riesgos de adopción de un ERP",
                "descripcion": (
                    "Beneficios operativos y estratégicos de implementar un ERP. "
                    "Principales riesgos: resistencia al cambio, sobrecostos, "
                    "calidad de datos, vendor lock-in y factores de éxito."
                ),
                "orden": 3,
                "archivo": "modulo_1_fundamentos/03_beneficios_y_riesgos.md",
            },
            {
                "nombre_bd": "ERP vs. software de gestión tradicional",
                "nombre_seed": "ERP vs. software de gestión tradicional",
                "descripcion": (
                    "Comparativa entre ERP y sistemas en silos: integración, "
                    "fuente única de verdad, automatización, reportes en tiempo "
                    "real, control y escalabilidad."
                ),
                "orden": 4,
                "archivo": "modulo_1_fundamentos/04_erp_vs_tradicional.md",
            },
        ],
    },
    {
        "nombre": "Implementación de ERP",
        "descripcion": (
            "Metodología y prácticas para implementar un ERP con éxito: fases "
            "del proyecto, factores críticos, migración de datos y errores "
            "frecuentes a evitar."
        ),
        "orden": 2,
        "subtemas": [
            {
                "nombre_bd": "Fases de un proyecto de implementación",
                "nombre_seed": "Fases de un proyecto de implementación ERP",
                "descripcion": (
                    "Las 7 fases estándar: planificación, análisis y diseño "
                    "(Blueprint/Fit-Gap), configuración y desarrollo, pruebas, "
                    "capacitación, go-live y estabilización, y cierre."
                ),
                "orden": 1,
                "archivo": "modulo_2_implementacion/01_fases_implementacion.md",
            },
            {
                "nombre_bd": "Factores críticos de éxito",
                "nombre_seed": "Factores críticos de éxito en una implementación ERP",
                "descripcion": (
                    "Los 8 factores determinantes: compromiso ejecutivo, "
                    "usuarios clave empoderados, alcance definido, calidad de "
                    "datos, gestión del cambio, metodología rigurosa, selección "
                    "del partner y soporte post-go-live."
                ),
                "orden": 2,
                "archivo": "modulo_2_implementacion/02_factores_criticos.md",
            },
            {
                "nombre_bd": "Migración de datos",
                "nombre_seed": "Migración de datos en proyectos ERP",
                "descripcion": (
                    "Tipos de datos (maestros vs. transaccionales de apertura), "
                    "etapas de migración (inventario, mapeo, extracción, limpieza, "
                    "cargas de prueba, reconciliación y cutover) y herramientas."
                ),
                "orden": 3,
                "archivo": "modulo_2_implementacion/03_migracion_datos.md",
            },
            {
                "nombre_bd": "Errores comunes en la puesta en marcha",
                "nombre_seed": "Errores comunes en implementaciones ERP y cómo evitarlos",
                "descripcion": (
                    "Los errores más frecuentes por fase: selección incorrecta, "
                    "subestimación del esfuerzo, sobre-personalización, pruebas "
                    "insuficientes, capacitación tardía y soporte post-go-live "
                    "inadecuado."
                ),
                "orden": 4,
                "archivo": "modulo_2_implementacion/04_errores_comunes.md",
            },
        ],
    },
    {
        "nombre": "Gestión del Cambio Organizacional",
        "descripcion": (
            "Factores humanos y organizacionales en la adopción de un ERP: "
            "resistencia al cambio, comunicación, liderazgo y modelos de gestión."
        ),
        "orden": 3,
        "subtemas": [
            {
                "nombre_bd": "Qué es la resistencia al cambio y por qué ocurre",
                "nombre_seed": "Qué es la resistencia al cambio y por qué ocurre",
                "descripcion": "Factores humanos y organizacionales que generan resistencia ante la adopción de un nuevo sistema ERP.",
                "orden": 1,
                "archivo": None,  # Cubierto por el PDF de la tesis
            },
            {
                "nombre_bd": "Estrategias de comunicación durante la transición",
                "nombre_seed": "Estrategias de comunicación durante la transición",
                "descripcion": "Planes de comunicación, mensajes clave y canales para acompañar el proceso de cambio tecnológico.",
                "orden": 2,
                "archivo": None,
            },
            {
                "nombre_bd": "Rol del liderazgo en la adopción",
                "nombre_seed": "Rol del liderazgo en la adopción",
                "descripcion": "Cómo los líderes de proyecto y directivos facilitan u obstaculizan la adopción del ERP.",
                "orden": 3,
                "archivo": None,
            },
            {
                "nombre_bd": "Modelos de gestión del cambio",
                "nombre_seed": "Modelos de gestión del cambio",
                "descripcion": "Marcos de referencia aplicados a proyectos ERP: modelo ADKAR, los 8 pasos de Kotter y otros enfoques.",
                "orden": 4,
                "archivo": None,
            },
        ],
    },
    {
        "nombre": "Ética Profesional en TI",
        "descripcion": "Obligaciones éticas del profesional TI en proyectos ERP: confidencialidad, integridad y responsabilidad.",
        "orden": 4,
        "subtemas": [
            {
                "nombre_bd": "Confidencialidad y manejo de datos sensibles",
                "nombre_seed": "Confidencialidad y manejo de datos sensibles",
                "descripcion": "Obligaciones éticas y legales del profesional TI al trabajar con información organizacional crítica.",
                "orden": 1,
                "archivo": None,
            },
            {
                "nombre_bd": "Integridad en el registro de información",
                "nombre_seed": "Integridad en el registro de información",
                "descripcion": "Responsabilidad sobre la exactitud, completitud y trazabilidad de los datos en un sistema ERP.",
                "orden": 2,
                "archivo": None,
            },
            {
                "nombre_bd": "Responsabilidad profesional del implementador",
                "nombre_seed": "Responsabilidad profesional del implementador",
                "descripcion": "Alcance de las obligaciones del consultor o técnico frente al cliente durante y después del proyecto.",
                "orden": 3,
                "archivo": None,
            },
            {
                "nombre_bd": "Dilemas éticos comunes en proyectos ERP",
                "nombre_seed": "Dilemas éticos comunes en proyectos ERP",
                "descripcion": "Situaciones de conflicto de interés, presión de plazos y sesgos en la toma de decisiones técnicas.",
                "orden": 4,
                "archivo": None,
            },
        ],
    },
    {
        "nombre": "Capacitación y Desempeño Operativo",
        "descripcion": "Diseño de programas de formación, medición del desempeño post-implementación y mejora continua del uso del ERP.",
        "orden": 5,
        "subtemas": [
            {
                "nombre_bd": "Diseño de programas de capacitación de usuarios",
                "nombre_seed": "Diseño de programas de capacitación de usuarios",
                "descripcion": "Metodologías para estructurar un plan de formación de usuarios finales antes y después del go-live.",
                "orden": 1,
                "archivo": None,
            },
            {
                "nombre_bd": "Medición del desempeño post-implementación",
                "nombre_seed": "Medición del desempeño post-implementación",
                "descripcion": "Indicadores clave (KPIs) para evaluar si el ERP está generando el valor esperado en la operación.",
                "orden": 2,
                "archivo": None,
            },
            {
                "nombre_bd": "Indicadores de adopción tecnológica",
                "nombre_seed": "Indicadores de adopción tecnológica",
                "descripcion": "Métricas de uso del sistema: tasa de adopción, errores de ingreso, tiempos de proceso y satisfacción del usuario.",
                "orden": 3,
                "archivo": None,
            },
            {
                "nombre_bd": "Mejora continua del uso del sistema",
                "nombre_seed": "Mejora continua del uso del sistema",
                "descripcion": "Ciclos de retroalimentación, actualizaciones y re-capacitación para maximizar el retorno del ERP.",
                "orden": 4,
                "archivo": None,
            },
        ],
    },
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def cargar_modelo_embeddings():
    """Importa sentence-transformers y retorna el modelo cargado."""
    try:
        from sentence_transformers import SentenceTransformer
        print(f"  Cargando modelo de embeddings: {EMBEDDING_MODEL} ...")
        model = SentenceTransformer(EMBEDDING_MODEL)
        print("  Modelo cargado.")
        return model
    except ImportError:
        print("ERROR: sentence-transformers no está instalado.")
        print("  Ejecutá: pip install sentence-transformers")
        sys.exit(1)


def generar_embeddings_batch(model, textos: list[str]) -> list[list[float]]:
    vectores = model.encode(textos, convert_to_numpy=True, batch_size=32, show_progress_bar=False)
    return vectores.tolist()


def fragmentar_texto(texto: str) -> list[str]:
    """Importa el chunker del backend para consistencia con el pipeline principal."""
    from app.base_conocimiento.chunking import fragmentar_texto as _fragmentar
    chunks = _fragmentar(texto)
    return [c.texto for c in chunks]


def get_or_create_seed_user() -> str:
    """
    Obtiene un usuario válido para asociar los documentos semilla.
    Prioridad: SEED_USER_ID env var → primer usuario en auth.users → error.
    """
    if SEED_USER_ID:
        print(f"  Usando SEED_USER_ID: {SEED_USER_ID}")
        return SEED_USER_ID

    users = supabase.auth.admin.list_users()
    if users:
        uid = users[0].id
        print(f"  SEED_USER_ID no definido. Usando primer usuario existente: {uid}")
        return uid

    print("ERROR: No hay usuarios en la base de datos y SEED_USER_ID no está definido.")
    print("  Creá un usuario primero o exportá SEED_USER_ID=<uuid>.")
    sys.exit(1)


def get_or_create_modulo(nombre: str, descripcion: str, orden: int) -> str:
    """Retorna el id del módulo, creándolo si no existe."""
    res = supabase.table("modulo").select("id").eq("nombre", nombre).execute()
    if res.data:
        return res.data[0]["id"]

    modulo_id = str(uuid.uuid4())
    supabase.table("modulo").insert({
        "id": modulo_id,
        "nombre": nombre,
        "descripcion": descripcion,
        "orden": orden,
    }).execute()
    print(f"    Módulo creado: '{nombre}' ({modulo_id})")
    return modulo_id


def get_or_create_tema(nombre_bd: str, nombre_seed: str, descripcion: str, orden: int, modulo_id: str) -> str:
    """
    Busca el tema por nombre_bd (nombre exacto en la BD) dentro del módulo.
    Si no existe con ese nombre, lo busca por nombre_seed.
    Si tampoco existe, lo crea con nombre_bd.
    """
    # Intento 1: buscar por nombre_bd (nombre tal como está en la BD)
    res = (
        supabase.table("tema")
        .select("id")
        .eq("nombre", nombre_bd)
        .eq("modulo_id", modulo_id)
        .execute()
    )
    if res.data:
        return res.data[0]["id"]

    # Intento 2: buscar por nombre_seed (nombre alternativo usado en el seed)
    if nombre_seed != nombre_bd:
        res2 = (
            supabase.table("tema")
            .select("id")
            .eq("nombre", nombre_seed)
            .eq("modulo_id", modulo_id)
            .execute()
        )
        if res2.data:
            return res2.data[0]["id"]

    # No existe: crear con nombre_bd
    tema_id = str(uuid.uuid4())
    supabase.table("tema").insert({
        "id": tema_id,
        "nombre": nombre_bd,
        "descripcion": descripcion,
        "orden": orden,
        "modulo_id": modulo_id,
        "es_predefinido": True,
    }).execute()
    print(f"      Sub-tema creado: '{nombre_bd}' ({tema_id})")
    return tema_id


def documento_ya_existe(storage_path: str, tema_id: str) -> bool:
    """Verifica si ya existe un documento con el mismo storage_path para el tema."""
    res = (
        supabase.table("documento")
        .select("id")
        .eq("storage_path", storage_path)
        .eq("tema_id", tema_id)
        .execute()
    )
    return bool(res.data)


def seed_subtema(
    model,
    user_id: str,
    subtema: dict,
    tema_id: str,
) -> None:
    """Procesa un sub-tema: lee el MD, fragmenta, genera embeddings e inserta en `chunk`."""
    archivo_rel = subtema.get("archivo")
    if not archivo_rel:
        print(f"      Sin archivo de contenido para este sub-tema — saltando inserción de chunks.")
        return

    archivo_path = ROOT / "contenido" / archivo_rel
    storage_path = f"seed/{archivo_rel}"

    if not archivo_path.exists():
        print(f"      ADVERTENCIA: archivo no encontrado: {archivo_path}")
        return

    if documento_ya_existe(storage_path, tema_id):
        print(f"      Ya existe, omitiendo: {storage_path}")
        return

    # Leer contenido
    texto = archivo_path.read_text(encoding="utf-8")
    print(f"      Leyendo: {archivo_rel} ({len(texto):,} chars)")

    # Fragmentar
    chunks_texto = fragmentar_texto(texto)
    print(f"      Fragmentos: {len(chunks_texto)}")

    if not chunks_texto:
        print(f"      ADVERTENCIA: el archivo está vacío o no generó chunks.")
        return

    # Generar embeddings en batch
    embeddings = generar_embeddings_batch(model, chunks_texto)

    # Insertar documento en tabla `documento` (esquema correcto)
    doc_id = str(uuid.uuid4())
    supabase.table("documento").insert({
        "id": doc_id,
        "usuario_id": user_id,
        "tema_id": tema_id,
        "nombre_archivo": archivo_path.name,
        "formato": "md",                      # campo requerido por el schema
        "storage_path": storage_path,
        "visibilidad": "compartido",
        "estado_moderacion": "aprobado",
    }).execute()

    # Insertar chunks en tabla `chunk` (NO chunk_documento) con columna `contenido`
    filas_chunks = [
        {
            "documento_id": doc_id,
            "contenido": chunk_texto,           # columna correcta según schema
            "embedding": embedding,
            "orden": i + 1,
        }
        for i, (chunk_texto, embedding) in enumerate(zip(chunks_texto, embeddings))
    ]

    # Insertar en lotes de 50 para evitar límites de tamaño de request
    BATCH = 50
    total_insertados = 0
    for start in range(0, len(filas_chunks), BATCH):
        supabase.table("chunk").insert(filas_chunks[start:start + BATCH]).execute()
        total_insertados += len(filas_chunks[start:start + BATCH])

    print(f"      [OK] Insertado: documento {doc_id} con {total_insertados} chunks en tabla `chunk`")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("\n=== Seed de contenido educativo — Módulos 1–5 ===\n")

    # Cargar modelo de embeddings primero (tarda ~2-5s la primera vez)
    model = cargar_modelo_embeddings()

    # Obtener usuario propietario de los documentos
    print("\n[1] Resolviendo usuario propietario de documentos...")
    user_id = get_or_create_seed_user()

    total_docs = 0
    total_omitidos = 0

    print("\n[2] Procesando módulos y sub-temas...\n")
    for modulo_data in MODULOS:
        print(f"  Módulo {modulo_data['orden']}: {modulo_data['nombre']}")

        modulo_id = get_or_create_modulo(
            nombre=modulo_data["nombre"],
            descripcion=modulo_data["descripcion"],
            orden=modulo_data["orden"],
        )

        for subtema_data in modulo_data["subtemas"]:
            print(f"    Sub-tema {subtema_data['orden']}: {subtema_data['nombre_bd']}")

            tema_id = get_or_create_tema(
                nombre_bd=subtema_data["nombre_bd"],
                nombre_seed=subtema_data["nombre_seed"],
                descripcion=subtema_data["descripcion"],
                orden=subtema_data["orden"],
                modulo_id=modulo_id,
            )

            if subtema_data.get("archivo"):
                seed_subtema(
                    model=model,
                    user_id=user_id,
                    subtema=subtema_data,
                    tema_id=tema_id,
                )
                total_docs += 1
            else:
                print(f"      (sin archivo .md — sub-tema usa corpus general del PDF)")
                total_omitidos += 1

        print()

    print(f"\n=== Seed completado ===")
    print(f"  Módulos procesados    : {len(MODULOS)}")
    print(f"  Sub-temas con archivo : {total_docs}")
    print(f"  Sub-temas sin archivo : {total_omitidos} (usarán corpus general)")
    print()
    print("Próximos pasos:")
    print("  1. Verificar en Supabase Dashboard que la tabla `chunk` tiene filas nuevas.")
    print("  2. Reiniciar el backend para que el retriever use los nuevos chunks.")
    print("  3. Probar el chat desde un sub-tema de Módulo 1 o 2.")
    print()


if __name__ == "__main__":
    main()
