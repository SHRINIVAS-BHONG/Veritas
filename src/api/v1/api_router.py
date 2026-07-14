from fastapi import APIRouter
from src.api.v1.endpoints import auth, health, tasks, evaluations

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["Evaluations"])
