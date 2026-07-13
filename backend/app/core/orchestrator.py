import redis  # type: ignore
from rq import Queue  # type: ignore
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models.evaluation import EvaluationRun as DBEvaluationRun

def get_redis_connection():
    """Tries to connect to Redis, returning connection object or None if offline."""
    try:
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        return r
    except Exception:
        return None

def run_evaluation_job(run_id: int):
    """Background runner execution logic (compatible with both RQ worker and FastAPI threads)."""
    db = SessionLocal()
    try:
        # Import evaluation logic locally to prevent circular dependencies
        from backend.app.api.evaluation import run_evaluation_sync
        
        # run_evaluation_sync will run retrieval, generation, deterministic scoring,
        # and (in Week 3) the LLM-as-judge evaluations.
        run_evaluation_sync(run_id, db)
    finally:
        db.close()

def enqueue_evaluation_run(run_id: int, background_tasks: BackgroundTasks, db: Session):
    """Enqueues the evaluation run.
    
    If Redis is online, uses RQ task queuing.
    If Redis is offline, uses FastAPI BackgroundTasks in-process.
    """
    redis_conn = get_redis_connection()
    run = db.query(DBEvaluationRun).filter(DBEvaluationRun.id == run_id).first()
    if not run:
        return
        
    if redis_conn:
        print(f"Redis is online. Enqueueing evaluation run {run_id} via RQ...")
        queue = Queue("veritas_evals", connection=redis_conn)
        queue.enqueue(run_evaluation_job, run_id)
        run.status = "QUEUED"
        db.commit()
    else:
        print(f"Redis is offline. Falling back to FastAPI BackgroundTasks for run {run_id}...")
        background_tasks.add_task(run_evaluation_job, run_id)
        run.status = "PENDING"
        db.commit()
