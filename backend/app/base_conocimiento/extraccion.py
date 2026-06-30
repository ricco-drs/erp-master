from __future__ import annotations

import logging
from pathlib import Path

import fitz  # pymupdf
import pypdf
from docx import Document
from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

PROMPT_OCR = (
    "Extrae todo el texto visible en esta imagen de una página de documento. "
    "Devuelve únicamente el texto, preservando la estructura con saltos de línea "
    "y usando markdown simple para títulos y listas si corresponde. "
    "No agregues comentarios, descripciones ni explicaciones."
)


class ExtractionError(Exception):
    pass


def extraer_texto(ruta: str | Path, formato: str) -> str:
    """
    Extrae texto plano de un archivo según su formato.
    - PDF: Gemini Vision página por página, con fallback a pypdf si Gemini no está disponible.
    - DOCX: python-docx (extracción nativa).
    - TXT / MD: lectura directa.
    Lanza ExtractionError si el archivo es ilegible o corrupto.
    """
    ruta = Path(ruta)
    fmt = formato.lower().lstrip(".")

    try:
        if fmt == "pdf":
            return _extraer_pdf(ruta)
        elif fmt in ("docx", "doc"):
            return _extraer_docx(ruta)
        elif fmt in ("txt", "md"):
            return _extraer_texto_plano(ruta)
        else:
            raise ExtractionError(
                f"Formato no soportado: '{formato}'. Se aceptan PDF, DOCX, TXT y MD."
            )
    except ExtractionError:
        raise
    except Exception as e:
        raise ExtractionError(
            f"No se pudo leer el archivo '{ruta.name}': {e}"
        ) from e


# ---------------------------------------------------------------------------
# PDF — Gemini Vision con fallback a pypdf
# ---------------------------------------------------------------------------

def _extraer_pdf(ruta: Path) -> str:
    if settings.gemini_api_key:
        try:
            return _extraer_pdf_gemini(ruta)
        except ExtractionError:
            raise
        except Exception as e:
            logger.warning(
                "Gemini Vision falló para '%s' (%s). Usando fallback pypdf.", ruta.name, e
            )
    return _extraer_pdf_fallback(ruta)


def _extraer_pdf_gemini(ruta: Path) -> str:
    """Rasteriza cada página con pymupdf y extrae texto con Gemini Vision."""
    client = genai.Client(api_key=settings.gemini_api_key)

    try:
        doc = fitz.open(str(ruta))
    except Exception as e:
        raise ExtractionError(f"No se pudo abrir el PDF '{ruta.name}': {e}") from e

    if len(doc) == 0:
        doc.close()
        raise ExtractionError(f"El PDF '{ruta.name}' no contiene páginas.")

    paginas: list[str] = []
    try:
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")

            try:
                resp = client.models.generate_content(
                    model=settings.gemini_model,
                    contents=[
                        types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                        PROMPT_OCR,
                    ],
                )
                paginas.append(resp.text or "")
            except Exception as e:
                logger.warning("Gemini falló en página %d de '%s': %s", i + 1, ruta.name, e)
                # Intentar con pypdf para esta página individual
                paginas.append(_texto_pagina_pypdf(ruta, i))
    finally:
        doc.close()

    texto = "\n\n".join(p for p in paginas if p.strip())
    if not texto.strip():
        raise ExtractionError(
            f"No se pudo extraer texto del PDF '{ruta.name}'."
        )
    return texto


def _texto_pagina_pypdf(ruta: Path, indice: int) -> str:
    """Extrae texto de una página específica con pypdf (fallback por página)."""
    try:
        reader = pypdf.PdfReader(str(ruta))
        return reader.pages[indice].extract_text() or ""
    except Exception:
        return ""


def _extraer_pdf_fallback(ruta: Path) -> str:
    """Fallback completo con pypdf cuando Gemini no está disponible."""
    try:
        reader = pypdf.PdfReader(str(ruta))
    except Exception as e:
        raise ExtractionError(f"No se pudo abrir el PDF '{ruta.name}': {e}") from e

    if reader.is_encrypted:
        raise ExtractionError(
            f"El PDF '{ruta.name}' está protegido con contraseña y no puede procesarse."
        )
    if len(reader.pages) == 0:
        raise ExtractionError(f"El PDF '{ruta.name}' no contiene páginas.")

    partes = [page.extract_text() or "" for page in reader.pages]
    texto = "\n".join(partes).strip()
    if not texto:
        raise ExtractionError(
            f"El PDF '{ruta.name}' no contiene texto extraíble. "
            "Puede ser un PDF de imágenes sin clave GEMINI_API_KEY configurada."
        )
    return texto


# ---------------------------------------------------------------------------
# DOCX
# ---------------------------------------------------------------------------

def _extraer_docx(ruta: Path) -> str:
    doc = Document(str(ruta))
    parrafos = [p.text for p in doc.paragraphs if p.text.strip()]
    if not parrafos:
        raise ExtractionError(f"El documento Word '{ruta.name}' no contiene texto.")
    return "\n".join(parrafos)


# ---------------------------------------------------------------------------
# TXT / MD
# ---------------------------------------------------------------------------

def _extraer_texto_plano(ruta: Path) -> str:
    texto = ruta.read_text(encoding="utf-8", errors="replace").strip()
    if not texto:
        raise ExtractionError(f"El archivo '{ruta.name}' está vacío.")
    return texto
