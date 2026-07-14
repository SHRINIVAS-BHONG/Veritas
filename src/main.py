from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from src.core.config import settings
from src.api.v1.api_router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Real-Time LLM Application Evaluation Platform API",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware is required for Authlib's OAuth implementation
app.add_middleware(SessionMiddleware, secret_key="starlette-session-secret-key-veritas")

# Include all API routes
app.include_router(api_router, prefix="/api/v1")
