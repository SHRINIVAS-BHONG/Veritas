from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any

from src.api.dependencies import get_current_user
from src.models.user_model import User
from celery.result import AsyncResult  # type: ignore

router = APIRouter()

class EvaluationRequest(BaseModel):
    github_repo_url: str
    target_app_url: str
    attack_type: str = "prompt_injection"

@router.post("/run", response_model=Dict[str, Any])
async def trigger_evaluation(
    request: EvaluationRequest, 
    current_user: User = Depends(get_current_user)
):
    """
    Triggers a full end-to-end evaluation: 
    AST Static Analysis -> Dynamic UI Execution -> Threat Injection -> Logging.
    """
    from src.tasks.background_tasks import master_evaluation_task
    task = master_evaluation_task.delay(
        request.github_repo_url, 
        request.target_app_url,
        request.attack_type
    )
    return {"evaluation_task_id": task.id, "status": "processing"}

@router.get("/report/{task_id}")
async def get_evaluation_report(task_id: str, current_user: User = Depends(get_current_user)):
    """
    Retrieves the comprehensive security evaluation report.
    """
    task_result = AsyncResult(task_id)
    if not task_result.ready():
        return {"task_id": task_id, "status": task_result.status}
    
    return {
        "task_id": task_id,
        "status": task_result.status,
        "report": task_result.result
    }

from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import redis.asyncio as redis
from src.core.config import settings

@router.websocket("/ws/evaluation/{task_id}")
async def websocket_evaluation_logs(websocket: WebSocket, task_id: str):
    """
    WebSocket endpoint for real-time evaluation logs and results.
    Subscribes to a Redis PubSub channel specific to the task.
    """
    await websocket.accept()
    
    # Initialize async Redis connection
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    
    channel_name = f"task_updates:{task_id}"
    await pubsub.subscribe(channel_name)
    
    try:
        # Initial connection message
        await websocket.send_json({"status": "connected", "message": f"Subscribed to logs for task {task_id}"})
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                await websocket.send_text(data)
                
                # Check for termination sequence (e.g. if the task completed or failed)
                if '"status": "completed"' in data or '"status": "failed"' in data:
                    break
                    
    except WebSocketDisconnect:
        print(f"Client disconnected from task {task_id}")
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        await pubsub.unsubscribe(channel_name)
        await redis_client.aclose()
