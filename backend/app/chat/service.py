from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from app.chat.retriever import recuperar_contexto, recuperar_contexto_caso, construir_contexto_texto
from app.core.llm_provider import completar, LLMError
from app.core.supabase_client import supabase

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

def _construir_system_prompt(nombre_tema: str | None = None) -> str:
    """
    Genera el system prompt del asistente.
    Si nombre_tema está definido, incluye el contexto del sub-tema activo
    para que el LLM sepa sobre qué debe responder y mantenga el foco.
    """
    contexto_tema = (
        f"\n\nEl usuario está estudiando el sub-tema: '{nombre_tema}'. "
        f"Enfoca tus respuestas en ese tema. Si el contexto de documentos "
        f"contiene información sobre '{nombre_tema}', priorízala y úsala "
        f"como base principal de tus respuestas."
    ) if nombre_tema else ""

    return (
        "Eres un asistente especializado en sistemas ERP (Enterprise Resource Planning), "
        "actuando como tutor de una plataforma de capacitación."
        + contexto_tema
        + "\n\nReglas:\n"
        "1. Si se proporciona contexto de documentos, priorízalo — es la fuente más "
        "actualizada y específica. Ceñite a lo que el contexto realmente dice.\n"
        "2. Si no hay contexto disponible, respondé desde tu conocimiento general sobre ERP, "
        "gestión empresarial y tecnología organizacional. Sé claro y útil.\n"
        "3. Solo rechazá preguntas que no tengan ninguna relación con sistemas ERP, tecnología "
        "empresarial o temas laborales/organizacionales. Rechazalas amablemente.\n"
        "4. Mantené un tono de tutor paciente y claro. Usá ejemplos concretos cuando sea posible.\n"
        "5. Respondé siempre en español, independientemente del idioma del usuario.\n"
        "6. No menciones que estás basándote en 'fragmentos' o 'chunks' — hablá naturalmente."
    )


@dataclass
class MensajeChat:
    rol: str   # "usuario" | "asistente"
    contenido: str


@dataclass
class RespuestaChat:
    contenido: str
    fuera_de_alcance: bool   # True si no hubo contexto relevante
    chunks_usados: int        # cuántos chunks alimentaron la respuesta


def _resolver_nombre_tema(tema_id: str | None) -> str | None:
    """Consulta la tabla `tema` para obtener el nombre del sub-tema activo."""
    if not tema_id:
        return None
    try:
        res = supabase.table("tema").select("nombre").eq("id", tema_id).single().execute()
        return res.data.get("nombre") if res.data else None
    except Exception as e:
        logger.warning("No se pudo resolver el nombre del tema %s: %s", tema_id, e)
        return None


def procesar_mensaje(
    mensaje: str,
    tema_id: str | None,
    historial: list[MensajeChat],
    user_id: str | None = None,
    documento_caso_id: str | None = None,
) -> RespuestaChat:
    """
    Orquesta el flujo completo de RAG para un turno de chat:

    1. Filtra intentos de prompt injection antes de tocar el LLM.
    2. Resuelve el nombre del sub-tema activo (para el system prompt).
    3. Recupera los chunks más relevantes para el mensaje en el tema activo.
    4. Construye el prompt con contexto y llama al LLM.
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

    # 2. Resolver nombre del sub-tema para el system prompt
    nombre_tema = _resolver_nombre_tema(tema_id)
    system_prompt = _construir_system_prompt(nombre_tema)

    # 3. Recuperar contexto — combinado para casos de empresa, filtrado por tema para chats normales
    if documento_caso_id:
        chunks = recuperar_contexto_caso(mensaje, documento_id=documento_caso_id, user_id=user_id)
    else:
        chunks = recuperar_contexto(mensaje, tema_id=tema_id, user_id=user_id)

    # 4. Armar mensajes — con contexto si hay chunks, sin contexto (conocimiento general) si no
    if chunks:
        contexto_texto = construir_contexto_texto(chunks)
        messages = _construir_messages(mensaje, contexto_texto, historial, system_prompt)
        logger.info(
            "Llamando LLM con contexto: tema=%s (%s) chunks=%d historial=%d turnos",
            tema_id, nombre_tema, len(chunks), len(historial),
        )
    else:
        messages = _construir_messages_sin_contexto(mensaje, historial, system_prompt)
        logger.info(
            "Llamando LLM sin contexto (conocimiento general): tema=%s (%s) historial=%d turnos",
            tema_id, nombre_tema, len(historial),
        )

    # 5. Llamar al LLM (puede lanzar LLMError)
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
    system_prompt: str,
) -> list[dict[str, str]]:
    """
    Construye la lista de mensajes en formato OpenAI-compatible:
    [system] + [historial reciente] + [user con contexto inyectado]

    El contexto se inyecta solo en el último mensaje del usuario,
    no en el historial — así el LLM siempre tiene el contexto fresco
    para la pregunta actual sin repetirlo en cada turno.
    """
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

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
    system_prompt: str,
) -> list[dict[str, str]]:
    """
    Construye los mensajes para el LLM cuando no hay contexto de documentos.
    El LLM responde desde su conocimiento general sobre ERP.
    Mismo formato que _construir_messages pero sin el bloque de contexto.
    """
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

    turnos_recientes = historial[-(MAX_TURNOS_HISTORIAL * 2):]
    for msg in turnos_recientes:
        role = "user" if msg.rol == "usuario" else "assistant"
        messages.append({"role": role, "content": msg.contenido})

    messages.append({"role": "user", "content": mensaje_usuario})

    return messages
