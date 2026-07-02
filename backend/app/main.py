import logging
import logging.config

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.core.config import settings
from app.base_conocimiento.router import router as documentos_router
from app.temas.router import router as temas_router
from app.chat.router import router as chat_router
from app.evaluaciones.router import router as evaluaciones_router
from app.perfil.router import router as perfil_router
from app.modulos.router import router as modulos_router
from app.casos_empresa.router import router as casos_empresa_router

# Logging centralizado: formato legible + nivel INFO por defecto.
# Uvicorn ya captura stdout, así que esto se ve en los logs de Render/Railway.
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)-8s %(name)s — %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        }
    },
    "root": {"level": "INFO", "handlers": ["console"]},
    # Silenciar librerías verbosas que no aportan
    "loggers": {
        "httpx": {"level": "WARNING"},
        "httpcore": {"level": "WARNING"},
        "sentence_transformers": {"level": "WARNING"},
    },
})

logger = logging.getLogger(__name__)

app = FastAPI(title="ChatERP API")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Error no manejado en %s %s: %r", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "El servicio no está disponible en este momento. Intentá de nuevo en unos segundos."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(documentos_router)
app.include_router(temas_router)
app.include_router(modulos_router)
app.include_router(casos_empresa_router)
app.include_router(chat_router)
app.include_router(evaluaciones_router)
app.include_router(perfil_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/me")
async def me(user_id: str = Depends(get_current_user_id)):
    result = (
        supabase.table("usuario")
        .select("id, nombre, email, created_at")
        .eq("id", user_id)
        .single()
        .execute()
    )
    return result.data
