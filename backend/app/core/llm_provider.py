from __future__ import annotations

import logging
from typing import Any

import httpx
from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Error del proveedor LLM: API caída, timeout, cuota agotada, etc."""


def completar(
    messages: list[dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> str:
    """
    Llama al LLM configurado (Groq o Ollama) y devuelve el texto generado.
    Interfaz unificada: el resto del código no necesita saber qué proveedor está activo.

    Lanza LLMError si el proveedor no está disponible o falla.
    """
    provider = settings.llm_provider.lower()

    if provider == "groq":
        return _completar_groq(messages, temperature, max_tokens)
    elif provider == "ollama":
        return _completar_ollama(messages, temperature, max_tokens)
    else:
        raise LLMError(
            f"LLM_PROVIDER inválido: '{settings.llm_provider}'. Valores aceptados: 'groq', 'ollama'."
        )


def _completar_groq(
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> str:
    if not settings.groq_api_key:
        raise LLMError(
            "GROQ_API_KEY no configurada. Agrega la clave en el .env o cambia LLM_PROVIDER=ollama."
        )
    try:
        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        msg = str(e)
        if "rate_limit" in msg.lower() or "429" in msg:
            raise LLMError("Cuota de Groq agotada. Reintentá en unos segundos.") from e
        if "401" in msg or "authentication" in msg.lower():
            raise LLMError("API key de Groq inválida. Verificá GROQ_API_KEY en el .env.") from e
        raise LLMError(f"Error de Groq: {msg}") from e


def _completar_ollama(
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> str:
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    payload: dict[str, Any] = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    try:
        resp = httpx.post(url, json=payload, timeout=60.0)
        resp.raise_for_status()
        return resp.json()["message"]["content"]
    except httpx.ConnectError:
        raise LLMError(
            f"No se puede conectar a Ollama en {settings.ollama_base_url}. "
            "Verificá que Ollama esté corriendo (`ollama serve`)."
        )
    except httpx.TimeoutException:
        raise LLMError("Ollama no respondió a tiempo (timeout 60s). El modelo puede estar cargando.")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise LLMError(
                f"Modelo '{settings.ollama_model}' no encontrado en Ollama. "
                f"Descargalo con `ollama pull {settings.ollama_model}`."
            )
        raise LLMError(f"Error de Ollama ({e.response.status_code}): {e.response.text}") from e
    except Exception as e:
        raise LLMError(f"Error inesperado con Ollama: {e}") from e
