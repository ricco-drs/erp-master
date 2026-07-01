from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_REINTENTOS = 2
_BACKOFF_BASE = 2.0  # segundos: intento 1 → 2s, intento 2 → 4s


class LLMError(Exception):
    """Error del proveedor LLM: API caída, timeout, cuota agotada, etc."""


def completar(
    messages: list[dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> str:
    """
    Llama al LLM configurado (Groq o Ollama) con reintentos ante timeout.
    Registra en log: proveedor, tiempo de respuesta y tokens usados.
    Lanza LLMError si el proveedor no está disponible o falla tras MAX_REINTENTOS.
    """
    provider = settings.llm_provider.lower()
    ultimo_error: LLMError | None = None

    for intento in range(1, MAX_REINTENTOS + 2):  # intentos: 1, 2, 3
        t0 = time.monotonic()
        try:
            if provider == "groq":
                texto, tokens = _completar_groq(messages, temperature, max_tokens)
            elif provider == "ollama":
                texto, tokens = _completar_ollama(messages, temperature, max_tokens)
            else:
                raise LLMError(
                    f"LLM_PROVIDER inválido: '{settings.llm_provider}'. Valores aceptados: 'groq', 'ollama'."
                )

            elapsed = time.monotonic() - t0
            logger.info(
                "[LLM] proveedor=%s modelo=%s intento=%d tokens=%s tiempo=%.2fs",
                provider,
                settings.groq_model if provider == "groq" else settings.ollama_model,
                intento,
                tokens if tokens is not None else "n/a",
                elapsed,
            )
            return texto

        except LLMError as e:
            elapsed = time.monotonic() - t0
            es_timeout = "timeout" in str(e).lower() or "tiempo" in str(e).lower()

            logger.warning(
                "[LLM] proveedor=%s intento=%d/%d error=%r tiempo=%.2fs",
                provider,
                intento,
                MAX_REINTENTOS + 1,
                str(e)[:120],
                elapsed,
            )
            ultimo_error = e

            # Solo reintentar ante timeouts — cuota agotada y errores de auth son definitivos
            if not es_timeout or intento > MAX_REINTENTOS:
                break

            backoff = _BACKOFF_BASE ** intento
            logger.info("[LLM] Reintentando en %.0fs (intento %d/%d)...", backoff, intento + 1, MAX_REINTENTOS + 1)
            time.sleep(backoff)

    logger.error("[LLM] Todos los reintentos fallaron. Último error: %s", ultimo_error)
    raise LLMError(
        "El asistente no está disponible en este momento. Por favor, intentá de nuevo en unos segundos."
    ) from ultimo_error


def _completar_groq(
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> tuple[str, int | None]:
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
        texto = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else None
        return texto, tokens
    except Exception as e:
        msg = str(e)
        if "rate_limit" in msg.lower() or "429" in msg:
            raise LLMError("Cuota de Groq agotada. Reintentá en unos segundos.") from e
        if "401" in msg or "authentication" in msg.lower():
            raise LLMError("API key de Groq inválida. Verificá GROQ_API_KEY en el .env.") from e
        if "timeout" in msg.lower():
            raise LLMError(f"Timeout en Groq: {msg}") from e
        raise LLMError(f"Error de Groq: {msg}") from e


def _completar_ollama(
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> tuple[str, int | None]:
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
        data = resp.json()
        texto = data["message"]["content"]
        tokens = data.get("eval_count")  # tokens generados por Ollama
        return texto, tokens
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
