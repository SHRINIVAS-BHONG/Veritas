from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.models.dataset import Dataset, TestCase
from backend.app.models.evaluation import EvaluationRun, EvaluationResult
from backend.app.models.annotation import Annotation
from backend.app.api.dataset import router as dataset_router
from backend.app.api.evaluation import router as evaluation_router
from backend.app.api.annotation import router as annotation_router

# Create database tables (SQLite default, PostgreSQL handled via migration or docker compose)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Automated evaluation and observability platform for RAG systems",
    version="0.1.0"
)

# Set up CORS middleware for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(dataset_router)
app.include_router(evaluation_router)
app.include_router(annotation_router)

@app.get("/")
def read_root():
    return {"status": "ok", "project": settings.PROJECT_NAME}
