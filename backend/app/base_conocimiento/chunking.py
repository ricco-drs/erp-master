import re
from dataclasses import dataclass

# ~4 chars/token para español → 400 tokens ≈ 1600 chars, overlap 75 tokens ≈ 300 chars
CHUNK_TARGET_CHARS = 1600
OVERLAP_CHARS = 300

# Separadores de oración: punto, exclamación o interrogación seguidos de espacio o fin de línea
_RE_ORACION = re.compile(r'(?<=[.!?])\s+')


@dataclass
class Chunk:
    texto: str
    orden: int


def fragmentar_texto(texto: str) -> list[Chunk]:
    """
    Divide el texto en chunks de ~400 tokens con solapamiento de ~75 tokens.
    Corta preferentemente en límites de párrafo u oración, nunca a mitad de palabra.
    Devuelve lista de Chunk(texto, orden) con orden empezando en 1.
    """
    if not texto or not texto.strip():
        return []

    oraciones = _split_en_oraciones(texto)
    chunks: list[Chunk] = []
    buffer: list[str] = []
    buffer_chars = 0
    overlap_buffer: list[str] = []

    for oracion in oraciones:
        oracion = oracion.strip()
        if not oracion:
            continue

        buffer.append(oracion)
        buffer_chars += len(oracion) + 1  # +1 por el espacio entre oraciones

        if buffer_chars >= CHUNK_TARGET_CHARS:
            texto_chunk = " ".join(buffer)
            chunks.append(Chunk(texto=texto_chunk, orden=len(chunks) + 1))

            # Construir overlap: tomar oraciones del final del buffer hasta OVERLAP_CHARS
            overlap_buffer = _oraciones_para_overlap(buffer)
            buffer = list(overlap_buffer)
            buffer_chars = sum(len(o) + 1 for o in buffer)

    # Último chunk con lo que quede en el buffer
    if buffer:
        texto_chunk = " ".join(buffer)
        # Evitar duplicar si el overlap es prácticamente igual al chunk anterior
        if not chunks or texto_chunk != chunks[-1].texto:
            chunks.append(Chunk(texto=texto_chunk, orden=len(chunks) + 1))

    return chunks


def _split_en_oraciones(texto: str) -> list[str]:
    """
    Divide el texto en oraciones respetando párrafos primero,
    luego separadores de oración dentro de cada párrafo.
    Fragmentos demasiado largos (sin puntuación) se cortan por palabras.
    """
    oraciones: list[str] = []
    parrafos = re.split(r'\n{2,}', texto)
    for parrafo in parrafos:
        parrafo = parrafo.strip()
        if not parrafo:
            continue
        partes = _RE_ORACION.split(parrafo)
        for parte in partes:
            if len(parte) <= CHUNK_TARGET_CHARS:
                oraciones.append(parte)
            else:
                # Fallback: cortar por palabras en bloques de CHUNK_TARGET_CHARS
                oraciones.extend(_split_por_palabras(parte))
    return oraciones


def _split_por_palabras(texto: str) -> list[str]:
    """Divide un texto largo en fragmentos de CHUNK_TARGET_CHARS cortando en espacios."""
    palabras = texto.split()
    bloque: list[str] = []
    chars = 0
    resultado: list[str] = []
    for palabra in palabras:
        bloque.append(palabra)
        chars += len(palabra) + 1
        if chars >= CHUNK_TARGET_CHARS:
            resultado.append(" ".join(bloque))
            bloque = []
            chars = 0
    if bloque:
        resultado.append(" ".join(bloque))
    return resultado


def _oraciones_para_overlap(buffer: list[str]) -> list[str]:
    """
    Toma oraciones del final del buffer hasta acumular OVERLAP_CHARS caracteres.
    """
    overlap: list[str] = []
    chars = 0
    for oracion in reversed(buffer):
        chars += len(oracion) + 1
        overlap.insert(0, oracion)
        if chars >= OVERLAP_CHARS:
            break
    return overlap
