from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from app.chat.retriever import recuperar_contexto, construir_contexto_texto
from app.core.llm_provider import completar, LLMError

logger = logging.getLogger(__name__)

# Patrones de prompt injection — detección básica (RNF-06 / seguridad)
_INJECTION_PATTERNS = re.compile(
    r"ignora\s+(todas\s+)?las?\s+instrucciones"
    r"|olvida\s+(todo|las?\s+instrucciones)"
    r"|ignore\s+(all\s+)?(previous\s+)?instructions"
    r"|disregard\s+(all\s+)?previous"
    r"|you\s+are\s+now\s+(?!an?\s+ERP)"   # "you are now [something else]"
    r"|ahora\s+eres\s+(?!un\s+asistente)"
    r"|actúa\s+como\s+(?!un\s+asistente)"
    r"|pretend\s+(you\s+are|to\s+be)"
    r"|system\s*:\s*"                       # intento de inyectar un turno system
    r"|<\s*/?system\s*>",                  # variante con tags
    re.IGNORECASE,
)

_RESPUESTA_INJECTION = (
    "No puedo procesar ese mensaje. Si tenés alguna pregunta sobre ERP, "
    "con gusto te ayudo."
)

# Número máximo de turnos del historial que se incluyen en el prompt.
# Cada turno son 2 mensajes (usuario + asistente). 6 turnos = 12 mensajes.
MAX_TURNOS_HISTORIAL = 6

# System prompt del asistente — instruye al LLM sobre su rol y límites.
_SYSTEM_PROMPT = """\
Eres un asistente especializado en sistemas ERP (Enterprise Resource Planning).
Responde usando el contexto de documentos provisto si está disponible. Si no hay contexto
específico, usa tu conocimiento general sobre ERP para ayudar al usuario.

Reglas:
1. Si se proporciona contexto de documentos, priorízalo — es la fuente más actualizada y
   específica para el tema. Ceñite a lo que el contexto realmente dice.
2. Si no hay contexto disponible, respondé desde tu conocimiento general sobre ERP,
   gestión empresarial y tecnología organizacional. Sé claro y útil.
3. Solo rechazá preguntas que no tengan ninguna relación con sistemas ERP, tecnología
   empresarial o temas laborales/organizacionales. Rechazalas amablemente.
4. Mantené un tono de tutor paciente y claro. Usá ejemplos concretos cuando sea posible.
5. Respondé siempre en español, independientemente del idioma del usuario.
6. No menciones que estás basándote en "fragmentos" o "chunks" — hablá naturalmente.\
"""


@dataclass
class MensajeChat:
    rol: str   # "usuario" | "asistente"
    contenido: str


@dataclass
class RespuestaChat:
    contenido: str
    fuera_de_alcance: bool   # True si no hubo contexto relevante
    chunks_usados: int        # cuántos chunks alimentaron la respuesta


def procesar_mensaje(
    mensaje: str,
    tema_id: str | None,
    historial: list[MensajeChat],
) -> RespuestaChat:
    """
    Orquesta el flujo completo de RAG para un turno de chat:

    1. Filtra intentos de prompt injection antes de tocar el LLM.
    2. Recupera los chunks más relevantes para el mensaje en el tema activo.
    3. Si no hay contexto (pregunta fuera de alcance): devuelve rechazo sin llamar al LLM.
    4. Si hay contexto: construye el prompt y llama al LLM.
    5. Devuelve la respuesta con metadata de trazabilidad.

    Lanza LLMError si el proveedor falla (el router lo convierte en HTTP 503).
    """
    # 1. Filtro de prompt injection
    if _INJECTION_PATTERNS.search(mensaje):
        logger.warning("[seguridad] Intento de prompt injection bloqueado: %r", mensaje[:120])
        return RespuestaChat(
            contenido=_RESPUESTA_INJECTION,
            fuera_de_alcance=True,
            chunks_usados=0,
        )

    # 2. Recuperar contexto
    chunks = recuperar_contexto(mensaje, tema_id=tema_id)

    # 3. Armar mensajes — con contexto si hay chunks, sin contexto (conocimiento general) si no
    if chunks:
        contexto_texto = construir_contexto_texto(chunks)
        messages = _construir_messages(mensaje, contexto_texto, historial)
        logger.info(
            "Llamando LLM con contexto: tema=%s chunks=%d historial=%d turnos",
            tema_id, len(chunks), len(historial),
        )
    else:
        messages = _construir_messages_sin_contexto(mensaje, historial)
        logger.info(
            "Llamando LLM sin contexto (conocimiento general): tema=%s historial=%d turnos",
            tema_id, len(historial),
        )

    # 4. Llamar al LLM (puede lanzar LLMError)
    respuesta_texto = completar(messages, temperature=0.3, max_tokens=1024)

    return RespuestaChat(
        contenido=respuesta_texto,
        fuera_de_alcance=False,
        chunks_usados=len(chunks),
    )


def _construir_messages(
    mensaje_usuario: str,
    contexto: str,
    historial: list[MensajeChat],
) -> list[dict[str, str]]:
    """
    Construye la lista de mensajes en formato OpenAI-compatible:
    [system] + [historial reciente] + [user con contexto inyectado]

    El contexto se inyecta solo en el último mensaje del usuario,
    no en el historial — así el LLM siempre tiene el contexto fresco
    para la pregunta actual sin repetirlo en cada turno.
    """
    messages: list[dict[str, str]] = [{"role": "system", "content": _SYSTEM_PROMPT}]

    # Historial reciente (últimos MAX_TURNOS_HISTORIAL turnos)
    turnos_recientes = historial[-(MAX_TURNOS_HISTORIAL * 2):]
    for msg in turnos_recientes:
        role = "user" if msg.rol == "usuario" else "assistant"
        messages.append({"role": role, "content": msg.contenido})

    # Mensaje actual del usuario con el contexto inyectado
    prompt_usuario = (
        f"Contexto de documentos relevantes:\n"
        f"---\n{contexto}\n---\n\n"
        f"Pregunta: {mensaje_usuario}"
    )
    messages.append({"role": "user", "content": prompt_usuario})

    return messages


def _construir_messages_sin_contexto(
    mensaje_usuario: str,
    historial: list[MensajeChat],
) -> list[dict[str, str]]:
    """
    Construye los mensajes para el LLM cuando no hay contexto de documentos.
    El LLM responde desde su conocimiento general sobre ERP.
    Mismo formato que _construir_messages pero sin el bloque de contexto.
    """
    messages: list[dict[str, str]] = [{"role": "system", "content": _SYSTEM_PROMPT}]

    turnos_recientes = historial[-(MAX_TURNOS_HISTORIAL * 2):]
    for msg in turnos_recientes:
        role = "user" if msg.rol == "usuario" else "assistant"
        messages.append({"role": role, "content": msg.contenido})

    messages.append({"role": "user", "content": mensaje_usuario})

    return messages
