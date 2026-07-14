from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
from authlib.integrations.starlette_client import OAuth
from src.core.config import settings

# JWT Setup
ALGORITHM = "HS256"
# In a real application, inject this from config/env
SECRET_KEY = "super-secret-key-for-jwt-generation-veritas"

def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# OAuth Setup
oauth = OAuth()
oauth.register(
    name='github',
    client_id=settings.GITHUB_CLIENT_ID or "dummy",
    client_secret=settings.GITHUB_CLIENT_SECRET or "dummy",
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'},
)
