from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import settings

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

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Basic health check endpoint to verify the API gateway is operational.
    """
    return {"status": "ok", "service": settings.PROJECT_NAME}
