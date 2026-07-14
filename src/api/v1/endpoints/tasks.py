from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from src.api.dependencies import get_current_user
from src.models.user_model import User
from src.tasks.background_tasks import test_dummy_task
from celery.result import AsyncResult

router = APIRouter()

@router.post("/trigger-dummy", response_model=Dict[str, Any])
async def trigger_dummy_task(seconds: int = 5, current_user: User = Depends(get_current_user)):
    """
    Dispatches a dummy background task to Celery.
    """
    task = test_dummy_task.delay(seconds)
    return {"task_id": task.id, "status": "processing"}

class RepoAnalyzeRequest(BaseModel):
    repo_url: str

@router.post("/analyze-repo", response_model=Dict[str, Any])
async def trigger_analyze_repo(
    request: RepoAnalyzeRequest, 
    current_user: User = Depends(get_current_user)
):
    """
    Dispatches a background task to clone and statically analyze a repository.
    """
    from src.tasks.background_tasks import analyze_repository_task
    task = analyze_repository_task.delay(request.repo_url)
    return {"task_id": task.id, "status": "processing"}

@router.get("/status/{task_id}")
async def get_task_status(task_id: str, current_user: User = Depends(get_current_user)):
    """
    Check the status of a dispatched Celery task.
    """
    task_result = AsyncResult(task_id)
    result = {
        "task_id": task_id,
        "task_status": task_result.status,
        "task_result": task_result.result if task_result.ready() else None
    }
    return result
