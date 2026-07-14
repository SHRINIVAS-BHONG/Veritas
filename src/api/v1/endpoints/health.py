from fastapi import APIRouter
from src.core.config import settings

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Basic health check endpoint to verify the API gateway is operational.
    """
    return {"status": "ok", "service": settings.PROJECT_NAME}
