from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.base_conocimiento.router import router as documentos_router
from app.temas.router import router as temas_router
from app.chat.router import router as chat_router
from app.evaluaciones.router import router as evaluaciones_router

app = FastAPI(title="ChatERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(documentos_router)
app.include_router(temas_router)
app.include_router(chat_router)
app.include_router(evaluaciones_router)


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
