import time
import tempfile
import subprocess
import subprocess
import asyncio
from src.tasks.celery_app import celery_app
from src.services.ast_analyzer import analyze_directory
from src.services.playwright_evaluator import run_playwright_evaluation_sync
from src.services.adversary import AdversaryEngine
from src.db.session import AsyncSessionLocal
from src.models.test_result_model import TestResult

import docker

@celery_app.task(bind=True, name="analyze_repository_task")
def analyze_repository_task(self, repo_url: str):
    """
    Clones a GitHub repository inside an ephemeral Docker container and runs AST analyzer.
    """
    if self.request.id:
        self.update_state(state='PROGRESS', meta={'status': 'Provisioning secure Sandbox...'})
    
    script = """
import os, ast, subprocess, json

res = subprocess.run(["git", "clone", "--depth", "1", "REPO_URL", "/repo"], capture_output=True)
if res.returncode != 0:
    print("VERITAS_ERROR::" + res.stderr.decode('utf-8', errors='ignore'))
    exit(1)

LLM_LIBRARIES = {"langchain", "langchain_core", "openai", "google.generativeai", "google", "anthropic", "chromadb", "pinecone", "transformers", "qdrant_client", "llama_index", "cohere", "tiktoken"}

class LLMImportVisitor(ast.NodeVisitor):
    def __init__(self):
        self.detected = set()
    def visit_Import(self, node):
        for alias in node.names:
            base = alias.name.split('.')[0]
            if base in LLM_LIBRARIES or alias.name in LLM_LIBRARIES:
                self.detected.add(alias.name)
        self.generic_visit(node)
    def visit_ImportFrom(self, node):
        if node.module:
            base = node.module.split('.')[0]
            if base in LLM_LIBRARIES or node.module in LLM_LIBRARIES:
                self.detected.add(node.module)
        self.generic_visit(node)

results = {}
IGNORED_DIRS = {".git", "venv", ".venv", "env", ".env", "node_modules", "__pycache__", ".mypy_cache"}

for root, dirs, files in os.walk("/repo"):
    dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read(), filename=path)
                    v = LLMImportVisitor()
                    v.visit(tree)
                    if v.detected:
                        rel = os.path.relpath(path, "/repo")
                        results[rel] = list(v.detected)
            except Exception:
                pass
print("VERITAS_RESULT::" + json.dumps(results))
"""
    script = script.replace("REPO_URL", repo_url)
    
    try:
        client = docker.from_env()
        if self.request.id:
            self.update_state(state='PROGRESS', meta={'status': 'Running AST static analysis in Sandbox...'})
        
        container_output = client.containers.run(
            "python:3.10-slim",
            command=["sh", "-c", "apt-get update && apt-get install -y git && echo \"$VERITAS_SCRIPT\" | python"],
            environment={"VERITAS_SCRIPT": script},
            remove=True,
            network_mode="bridge",
            stdout=True,
            stderr=True
        )
        
        output = container_output.decode('utf-8')
        
        for line in output.splitlines():
            if line.startswith("VERITAS_ERROR::"):
                return {"status": "failed", "error": line.split("VERITAS_ERROR::")[1]}
            if line.startswith("VERITAS_RESULT::"):
                data = json.loads(line.split("VERITAS_RESULT::")[1])
                return {
                    "status": "completed",
                    "repo": repo_url,
                    "detected_llm_usage": data,
                    "is_llm_app": len(data) > 0
                }
        
        return {"status": "failed", "error": f"Sandbox output invalid: {output[:100]}"}
        
    except Exception as e:
        return {"status": "failed", "error": f"Docker Sandbox error: {str(e)}"}

@celery_app.task(bind=True, name="dynamic_ui_evaluation_task")
def dynamic_ui_evaluation_task(self, target_url: str):
    """
    Executes a headless browser evaluation against a target URL.
    """
    self.update_state(state='PROGRESS', meta={'status': f'Launching isolated browsers against {target_url}...'})
    
    try:
        results = run_playwright_evaluation_sync(target_url)
        return {
            "status": "completed",
            "target": target_url,
            "results": results
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}

from sqlalchemy import select

async def save_test_result_to_db(task_id: str, target_url: str, attack_type: str, payload: str, system_response: dict, status: str):
    async with AsyncSessionLocal() as session:
        # Check if record already exists
        result = await session.execute(select(TestResult).where(TestResult.task_id == task_id))
        existing_record = result.scalars().first()
        
        if existing_record:
            existing_record.target_url = target_url
            existing_record.attack_type = attack_type
            existing_record.payload = payload
            existing_record.system_response = system_response
            existing_record.status = status
        else:
            new_record = TestResult(
                task_id=task_id,
                target_url=target_url,
                attack_type=attack_type,
                payload=payload,
                system_response=system_response,
                status=status
            )
            session.add(new_record)
        await session.commit()

import json
import redis
from src.core.config import settings

def broadcast_update(task_id: str, step: str, status: str, extra: dict = None):
    try:
        r = redis.from_url(settings.REDIS_URL)
        message = {
            "step": step,
            "status": status,
        }
        if extra:
            message.update(extra)
        r.publish(f"task_updates:{task_id}", json.dumps(message))
    except Exception as e:
        print(f"Redis broadcast failed: {e}")

@celery_app.task(bind=True, name="master_evaluation_task")
def master_evaluation_task(self, github_repo_url: str, target_app_url: str, attack_type: str):
    """
    End-to-End master orchestration task: AST -> Playwright -> Adversary -> DB Log.
    """
    task_id = self.request.id or "sync-test-id"
    self.update_state(state='PROGRESS', meta={'step': '1/3', 'status': 'Running Static AST Analysis'})
    broadcast_update(task_id, "1/3", "Running Static AST Analysis")
    
    # 1. Static AST Analysis
    ast_task = analyze_repository_task(github_repo_url)
    if ast_task.get("status") == "failed":
        error_msg = ast_task.get("error")
        broadcast_update(task_id, "1/3", "failed", {"error": error_msg})
        return {"status": "failed", "step": "ast_analysis", "error": error_msg}
        
    is_llm_app = ast_task.get("is_llm_app", False)
    ast_results = ast_task.get("detected_llm_usage", {})
    broadcast_update(task_id, "1/3", "completed", {"is_llm_app": is_llm_app})
    
    if not is_llm_app:
        broadcast_update(task_id, "halted", "Target repository does not appear to integrate LLMs")
        return {
            "status": "completed",
            "message": "Target repository does not appear to integrate LLMs. Halting evaluation.",
            "ast_results": ast_results
        }
        
    # 2. UI Isolation Test
    self.update_state(state='PROGRESS', meta={'step': '2/3', 'status': 'Evaluating Multi-Tenant Isolation via Playwright'})
    broadcast_update(task_id, "2/3", "Evaluating Multi-Tenant Isolation via Playwright")
    isolation_results = run_playwright_evaluation_sync(target_app_url)
    
    # 3. Threat Simulation & Adversary Injection
    self.update_state(state='PROGRESS', meta={'step': '3/3', 'status': 'Injecting Adversarial Payloads'})
    broadcast_update(task_id, "3/3", "Injecting Adversarial Payloads")
    
    adversary = AdversaryEngine(target_app_url)
    attack_result = adversary.execute_simulation(attack_type)
    broadcast_update(task_id, "3/3", "completed", {"attack_status": attack_result["status"]})
    
    # 4. Save results to DB
    self.update_state(state='PROGRESS', meta={'step': 'Saving', 'status': 'Persisting findings to database'})
    broadcast_update(task_id, "Saving", "Persisting findings to database")
    
    asyncio.run(save_test_result_to_db(
        task_id=task_id,
        target_url=target_app_url,
        attack_type=attack_result["attack_type"],
        payload=attack_result["payload"],
        system_response=attack_result["system_response"],
        status=attack_result["status"]
    ))
    
    final_res = {
        "status": "completed",
        "ast_analysis": ast_results,
        "isolation_test": isolation_results,
        "adversarial_simulation": attack_result,
        "recommendation": "Vulnerability detected. Immediate remediation required." if attack_result["status"] == "success" else "System secure against evaluated payloads."
    }
    broadcast_update(task_id, "Done", "completed", final_res)
    return final_res
