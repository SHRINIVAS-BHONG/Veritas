from celery import Celery
from src.core.config import settings

celery_app = Celery(
    "veritas_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["src.tasks.background_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
