"""
seed_temas.py — Puebla la base de conocimiento predefinida del ChatERP.

Ejecutar desde backend/ con el venv activo:
    python scripts/seed_temas.py

Qué hace:
1. Crea (o reutiliza) el usuario sistema@chaterp.local en Supabase Auth.
2. Inserta los temas predefinidos en la tabla `tema` (es_predefinido=true).
3. Procesa el PDF de investigación UNI mediante Gemini Vision.
4. Fragmenta el texto, genera embeddings y los inserta en Supabase.
"""

from __future__ import annotations

import sys
import os
import uuid
import time
from pathlib import Path

# Asegurar encoding UTF-8 en Windows
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

# Agregar backend/ al path para importar los módulos del proyecto
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.core.supabase_client import supabase
from app.base_conocimiento.extraccion import extraer_texto, ExtractionError
from app.base_conocimiento.chunking import fragmentar_texto
from app.base_conocimiento.embeddings import generar_embeddings

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

SISTEMA_EMAIL = "sistema@chaterp.local"
SISTEMA_PASSWORD = "SistemaChaterp2024!"  # contraseña ficticia — usuario no inicia sesión
SISTEMA_NOMBRE = "Sistema ChatERP"

PDF_PATH = Path(r"C:\Users\Personal\Downloads\Grupo 3 Avance 4.pdf")

BUCKET = "documentos"

# Temas predefinidos derivados del contenido del PDF de investigación UNI
# (Influencia de gestión del cambio y ética profesional en ERP)
TEMAS_PREDEFINIDOS = [
    {
        "nombre": "Fundamentos de Sistemas ERP",
        "descripcion": (
            "Conceptos básicos de los sistemas ERP: definición, historia, módulos principales, "
            "beneficios y riesgos de implementación en organizaciones."
        ),
    },
    {
        "nombre": "Gestión del Cambio Organizacional",
        "descripcion": (
            "Metodologías y estrategias para gestionar el cambio durante la implementación de un ERP: "
            "resistencia al cambio, comunicación, liderazgo y planificación de la transición."
        ),
    },
    {
        "nombre": "Implementación de ERP",
        "descripcion": (
            "Fases, factores críticos de éxito y metodologías para la implementación de sistemas ERP "
            "en organizaciones: planificación, configuración, migración de datos y puesta en marcha."
        ),
    },
    {
        "nombre": "Ética Profesional en TI",
        "descripcion": (
            "Principios de ética profesional aplicados a proyectos de tecnología de información: "
            "confidencialidad, integridad, responsabilidad y confiabilidad de la información."
        ),
    },
    {
        "nombre": "Capacitación y Desempeño Operativo",
        "descripcion": (
            "Estrategias de capacitación de usuarios en sistemas ERP, medición del desempeño operativo "
            "y evaluación del impacto en la productividad organizacional."
        ),
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def obtener_o_crear_usuario_sistema() -> str:
    """Retorna el UUID del usuario sistema. Lo crea si no existe."""
    log("Buscando usuario sistema en Supabase Auth...")

    # Buscar en la lista de usuarios del admin
    pagina = supabase.auth.admin.list_users()
    for user in pagina:
        if hasattr(user, 'email') and user.email == SISTEMA_EMAIL:
            log(f"  Usuario sistema ya existe: {user.id}")
            return user.id

    # No existe — crearlo
    log(f"  Creando usuario sistema ({SISTEMA_EMAIL})...")
    resp = supabase.auth.admin.create_user(
        {
            "email": SISTEMA_EMAIL,
            "password": SISTEMA_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"nombre": SISTEMA_NOMBRE},
        }
    )
    user_id = resp.user.id
    log(f"  Creado con ID: {user_id}")

    # El trigger handle_new_user debería insertar automáticamente en public.usuario
    # Verificar y crear manualmente si el trigger no disparó (entorno de test)
    time.sleep(1)  # dar tiempo al trigger
    check = supabase.table("usuario").select("id").eq("id", user_id).execute()
    if not check.data:
        log("  Trigger no disparó — insertando en public.usuario manualmente...")
        supabase.table("usuario").insert(
            {"id": user_id, "nombre": SISTEMA_NOMBRE, "correo": SISTEMA_EMAIL, "rol": "admin"}
        ).execute()

    return user_id


def insertar_temas() -> dict[str, str]:
    """
    Inserta los temas predefinidos si no existen.
    Retorna mapa nombre → id para usarlo al asociar documentos.
    """
    log("Verificando temas predefinidos...")

    existentes = supabase.table("tema").select("id, nombre").eq("es_predefinido", True).execute()
    mapa_existentes = {r["nombre"]: r["id"] for r in (existentes.data or [])}

    mapa_final: dict[str, str] = {}

    for tema in TEMAS_PREDEFINIDOS:
        nombre = tema["nombre"]
        if nombre in mapa_existentes:
            log(f"  [skip] '{nombre}' ya existe.")
            mapa_final[nombre] = mapa_existentes[nombre]
            continue

        tema_id = str(uuid.uuid4())
        supabase.table("tema").insert(
            {
                "id": tema_id,
                "nombre": nombre,
                "descripcion": tema["descripcion"],
                "es_predefinido": True,
            }
        ).execute()
        mapa_final[nombre] = tema_id
        log(f"  [ok] '{nombre}' insertado con id={tema_id[:8]}...")

    return mapa_final


def procesar_pdf(pdf_path: Path, usuario_id: str, tema_id: str) -> str:
    """
    Extrae texto del PDF, genera chunks y embeddings, e inserta todo en Supabase.
    Retorna el ID del documento creado.
    """
    nombre_archivo = pdf_path.name

    # Verificar si ya fue procesado (evitar duplicados en re-ejecuciones)
    check = (
        supabase.table("documento")
        .select("id")
        .eq("nombre_archivo", nombre_archivo)
        .eq("usuario_id", usuario_id)
        .execute()
    )
    if check.data:
        doc_id = check.data[0]["id"]
        log(f"  PDF ya procesado anteriormente (doc_id={doc_id[:8]}...), omitiendo.")
        return doc_id

    # --- Extracción ---
    log(f"  Extrayendo texto de '{nombre_archivo}' con Gemini Vision...")
    log(f"  (81 páginas — puede tomar 3-6 minutos)")
    t0 = time.time()
    try:
        texto = extraer_texto(pdf_path, "pdf")
    except ExtractionError as e:
        raise RuntimeError(f"Error extrayendo PDF: {e}") from e
    t1 = time.time()
    log(f"  Texto extraído: {len(texto):,} chars en {t1 - t0:.1f}s")

    # --- Chunking ---
    log("  Fragmentando texto...")
    chunks = fragmentar_texto(texto)
    log(f"  {len(chunks)} chunks generados.")

    # --- Embeddings ---
    log("  Generando embeddings (batch)...")
    t2 = time.time()
    textos = [c.texto for c in chunks]
    vectores = generar_embeddings(textos)
    t3 = time.time()
    log(f"  {len(vectores)} embeddings en {t3 - t2:.1f}s")

    # --- Insertar documento ---
    doc_id = str(uuid.uuid4())
    storage_path = f"{usuario_id}/{doc_id}.pdf"

    supabase.table("documento").insert(
        {
            "id": doc_id,
            "usuario_id": usuario_id,
            "tema_id": tema_id,
            "nombre_archivo": nombre_archivo,
            "formato": "pdf",
            "storage_path": storage_path,
            "visibilidad": "compartido",
            "estado_moderacion": "aprobado",
        }
    ).execute()
    log(f"  Documento insertado: {doc_id[:8]}...")

    # --- Subir archivo al bucket (opcional: si falla no bloquea el RAG) ---
    if pdf_path.exists():
        try:
            log("  Subiendo PDF original al bucket Storage...")
            contenido = pdf_path.read_bytes()
            supabase.storage.from_(BUCKET).upload(
                path=storage_path,
                file=contenido,
                file_options={"content-type": "application/pdf"},
            )
            log("  PDF subido al bucket.")
        except Exception as e:
            log(f"  [warning] No se pudo subir al bucket (RAG no se ve afectado): {e}")

    # --- Insertar chunks en lotes de 100 ---
    log("  Insertando chunks en Supabase...")
    chunk_rows = [
        {
            "documento_id": doc_id,
            "contenido": chunks[i].texto,
            "embedding": vectores[i],
            "orden": chunks[i].orden,
        }
        for i in range(len(chunks))
    ]
    LOTE = 100
    total_insertados = 0
    for inicio in range(0, len(chunk_rows), LOTE):
        lote = chunk_rows[inicio: inicio + LOTE]
        supabase.table("chunk").insert(lote).execute()
        total_insertados += len(lote)
        log(f"  Chunks insertados: {total_insertados}/{len(chunk_rows)}")

    log(f"  Proceso completado para '{nombre_archivo}'.")
    return doc_id


def verificar_rag(tema_id: str) -> None:
    """Verifica que los chunks sean consultables con una búsqueda de similitud."""
    log("\nVerificando RAG — búsqueda de similitud...")
    from app.base_conocimiento.embeddings import generar_embedding

    query = "¿Qué es un sistema ERP y cuáles son sus módulos principales?"
    vector = generar_embedding(query)

    try:
        resp = supabase.rpc(
            "match_chunks",
            {
                "query_embedding": vector,
                "match_threshold": 0.3,
                "match_count": 5,
                "p_tema_id": tema_id,
            },
        ).execute()
        resultados = resp.data or []
        log(f"  {len(resultados)} chunks encontrados.")
        for i, r in enumerate(resultados[:3], 1):
            preview = r.get("contenido", "")[:120].replace("\n", " ")
            similitud = r.get("similarity", r.get("score", "?"))
            log(f"  [{i}] sim={similitud:.3f}  {preview!r}")
    except Exception as e:
        log(f"  [info] Función match_chunks no disponible aún (se implementará en Fase 4): {e}")
        log("  Verificando conteo de chunks directamente...")
        resp2 = (
            supabase.table("chunk")
            .select("id", count="exact")
            .execute()
        )
        log(f"  Total chunks en BD: {resp2.count}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    log("=== ChatERP — Seed de base de conocimiento predefinida ===\n")

    # 1. Usuario sistema
    log("PASO 1: Usuario sistema")
    usuario_id = obtener_o_crear_usuario_sistema()
    log(f"Usuario sistema: {usuario_id}\n")

    # 2. Temas predefinidos
    log("PASO 2: Temas predefinidos")
    mapa_temas = insertar_temas()
    log(f"Temas disponibles: {list(mapa_temas.keys())}\n")

    # 3. Procesar PDF — asociar al tema "Fundamentos de Sistemas ERP" como tema principal
    #    (el PDF cubre todos los temas pero se registra bajo el de mayor peso)
    log("PASO 3: Procesamiento del PDF de investigación UNI")
    if not PDF_PATH.exists():
        log(f"[ERROR] PDF no encontrado en: {PDF_PATH}")
        log("Coloca 'Grupo 3 Avance 4.pdf' en C:/Users/Personal/Downloads/ y vuelve a ejecutar.")
        sys.exit(1)

    tema_principal = "Gestión del Cambio Organizacional"
    tema_id = mapa_temas[tema_principal]
    log(f"Tema asignado: '{tema_principal}' (id={tema_id[:8]}...)\n")

    doc_id = procesar_pdf(PDF_PATH, usuario_id, tema_id)

    # 4. Verificación
    log("\nPASO 4: Verificación")
    verificar_rag(tema_id)

    log("\n=== Seed completado exitosamente ===")
    log(f"  Temas insertados: {len(mapa_temas)}")
    log(f"  Documento seed: {doc_id[:8]}...")
    log("  Los chunks están disponibles para el pipeline RAG de Fase 4.\n")


if __name__ == "__main__":
    main()
