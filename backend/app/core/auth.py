from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client

from app.core.config import settings

_bearer = HTTPBearer()

# Cliente con anon key para validar JWTs de usuario
_auth_client = create_client(settings.supabase_url, settings.supabase_anon_key)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    token = credentials.credentials
    try:
        response = _auth_client.auth.get_user(token)
        return response.user.id
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        )
