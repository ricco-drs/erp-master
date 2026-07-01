from __future__ import annotations

import logging
from dataclasses import dataclass

from app.chat.retriever import recuperar_contexto, construir_contexto_texto
from app.core.llm_provider import completar, LLMError

logger = logging.getLogger(__name__)

# Número máximo de turnos del historial que se incluyen en el prompt.
# Cada turno son 2 mensajes (usuario + asistente). 6 turnos = 12 mensajes.
MAX_TURNOS_HISTORIAL = 6

# System prompt del asistente — instruye al LLM sobre su rol y límites.
_SYSTEM_PROMPT = """\
Eres un asistente de capacitación especializado en sistemas ERP (Enterprise Resource Planning).
Tu función es ayudar a los usuarios a aprender sobre ERP basándote EXCLUSIVAMENTE en el contexto
de documentos que se te proporcionarán en cada pregunta.

Reglas que DEBES seguir sin excepción:
1. Responde ÚNICAMENTE usando la información del contexto proporcionado. Si la respuesta no
   está en ese contexto, dilo claramente — no inventes ni uses conocimiento externo.
2. Si el usuario pregunta algo ajeno a ERP, gestión empresarial o temas relacionados,
   responde amablemente que estás especializado solo en ERP y no puedes ayudar con eso.
3. Mantén un tono de tutor paciente y claro. Usa ejemplos concretos cuando el contexto lo permita.
4. Si el contexto no tiene suficiente información para responder con certeza, dilo y sugiere
   al usuario consultar la documentación del sistema ERP específico que esté utilizando.
5. Responde siempre en español, independientemente del idioma del usuario.
6. No menciones que estás basándote en "fragmentos" o "chunks" — habla naturalmente como
   si el conocimiento fuera tuyo, pero ceñido a lo que el contexto realmente dice.\
"""

# Mensaje de rechazo cuando no hay contexto relevante.
_RESPUESTA_SIN_CONTEXTO = (
    "No encontré información relevante sobre esa pregunta en la base de conocimiento "
    "del tema seleccionado. Intentá reformular la pregunta usando términos más específicos "
    "de ERP, o seleccioná un tema diferente que se relacione mejor con lo que querés aprender."
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


def procesar_mensaje(
    mensaje: str,
    tema_id: str | None,
    historial: list[MensajeChat],
) -> RespuestaChat:
    """
    Orquesta el flujo completo de RAG para un turno de chat:

    1. Recupera los chunks más relevantes para el mensaje en el tema activo.
    2. Si no hay contexto (pregunta fuera de alcance): devuelve rechazo sin llamar al LLM.
    3. Si hay contexto: construye el prompt y llama al LLM.
    4. Devuelve la respuesta con metadata de trazabilidad.

    Lanza LLMError si el proveedor falla (el router lo convierte en HTTP 503).
    """
    # 1. Recuperar contexto
    chunks = recuperar_contexto(mensaje, tema_id=tema_id)

    if not chunks:
        logger.info(
            "[RAG] Rechazada por alcance — llamada al LLM omitida. query=%r tema=%s",
            mensaje[:60],
            tema_id,
        )
        return RespuestaChat(
            contenido=_RESPUESTA_SIN_CONTEXTO,
            fuera_de_alcance=True,
            chunks_usados=0,
        )

    # 2. Construir el bloque de contexto
    contexto_texto = construir_contexto_texto(chunks)

    # 3. Armar los mensajes para el LLM
    messages = _construir_messages(mensaje, contexto_texto, historial)

    # 4. Llamar al LLM (puede lanzar LLMError)
    logger.info(
        "Llamando LLM: tema=%s chunks=%d historial=%d turnos",
        tema_id,
        len(chunks),
        len(historial),
    )
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
