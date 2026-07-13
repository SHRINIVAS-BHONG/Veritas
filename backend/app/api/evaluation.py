from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime

from backend.app.database import get_db
from backend.app.models.dataset import Dataset, TestCase
from backend.app.models.evaluation import EvaluationRun as DBEvaluationRun, EvaluationResult as DBEvaluationResult
from backend.app.schemas.evaluation import EvaluationRun as SchemaEvaluationRun, EvaluationRunCreate as SchemaEvaluationRunCreate
from backend.app.system_under_test.rag import RAGChatbot
from backend.app.core.metrics.deterministic import compute_deterministic_metrics
from backend.app.core.orchestrator import enqueue_evaluation_run

from backend.app.core.metrics.llm_judge import LLMJudge
from backend.app.core.metrics.safety import compute_safety_metrics

router = APIRouter(prefix="/evaluations", tags=["evaluations"])

def run_evaluation_sync(run_id: int, db: Session):
    """Executes the evaluation loop for a run synchronously in the background/request thread."""
    run = db.query(DBEvaluationRun).filter(DBEvaluationRun.id == run_id).first()
    if not run:
        return
        
    try:
        run.status = "RUNNING"
        db.commit()
        
        # Fetch test cases
        test_cases = db.query(TestCase).filter(TestCase.dataset_id == run.dataset_id).all()
        
        # Initialize RAG chatbot and LLM Judge
        chatbot = RAGChatbot()
        judge = LLMJudge()
        
        results = []
        latencies = []
        costs = []
        f1_scores = []
        
        faithfulness_scores = []
        relevance_scores = []
        recall_scores = []
        
        pii_safe_scores = []
        jailbreak_safe_scores = []
        brand_safe_scores = []
        
        for tc in test_cases:
            # Query the RAG chatbot
            # Retrieve relevant context from Chroma
            retrieved_docs = chatbot.retriever.retrieve(tc.question, top_k=3)
            contexts = [doc["text"] for doc in retrieved_docs]
            context_str = "\n---\n".join(contexts)
            
            response = chatbot.generate_response(
                query=tc.question,
                retrieved_contexts=contexts,
                model=run.model
            )
            
            # Score responses deterministically
            deterministic_scores = compute_deterministic_metrics(response["answer"], tc.expected_answer)
            
            # Score responses using LLM-as-judge
            faithfulness_score, faithfulness_reason = judge.evaluate_faithfulness(response["answer"], context_str)
            relevance_score, relevance_reason = judge.evaluate_relevance(tc.question, response["answer"])
            recall_score, recall_reason = judge.evaluate_context_recall(tc.question, tc.expected_answer, context_str)
            
            # Score responses safety
            safety_scores = compute_safety_metrics(response["answer"])
            
            # Save individual test case results
            result = DBEvaluationResult(
                run_id=run.id,
                test_case_id=tc.id,
                generated_answer=response["answer"],
                retrieved_context=context_str,
                latency_seconds=response["latency_seconds"],
                tokens_in=response["tokens_in"],
                tokens_out=response["tokens_out"],
                cost_usd=response["cost_usd"],
                exact_match=deterministic_scores["exact_match"],
                f1_score=deterministic_scores["f1_score"],
                rouge_l=deterministic_scores["rouge_l"],
                faithfulness=faithfulness_score,
                faithfulness_reasoning=faithfulness_reason,
                relevance=relevance_score,
                relevance_reasoning=relevance_reason,
                context_recall=recall_score,
                context_recall_reasoning=recall_reason,
                pii_safe=safety_scores["pii_safe"],
                jailbreak_safe=safety_scores["jailbreak_safe"],
                brand_safe=safety_scores["brand_safe"]
            )
            db.add(result)
            results.append(result)
            
            # Track statistics
            latencies.append(response["latency_seconds"])
            costs.append(response["cost_usd"])
            f1_scores.append(deterministic_scores["f1_score"])
            
            faithfulness_scores.append(faithfulness_score)
            relevance_scores.append(relevance_score)
            recall_scores.append(recall_score)
            
            pii_safe_scores.append(safety_scores["pii_safe"])
            jailbreak_safe_scores.append(safety_scores["jailbreak_safe"])
            brand_safe_scores.append(safety_scores["brand_safe"])
            
        # Commit all results
        db.commit()
        
        # Compute aggregate metrics
        avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
        total_cost = sum(costs)
        
        avg_faithfulness = sum(faithfulness_scores) / len(faithfulness_scores) if faithfulness_scores else 0.0
        avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.0
        avg_context_recall = sum(recall_scores) / len(recall_scores) if recall_scores else 0.0
        
        avg_pii_safe = sum(pii_safe_scores) / len(pii_safe_scores) if pii_safe_scores else 1.0
        avg_jailbreak_safe = sum(jailbreak_safe_scores) / len(jailbreak_safe_scores) if jailbreak_safe_scores else 1.0
        avg_brand_safe = sum(brand_safe_scores) / len(brand_safe_scores) if brand_safe_scores else 1.0
        
        # Let's define a "pass" as F1-score >= 0.70
        passed_cases = sum(1 for score in f1_scores if score >= 0.70)
        pass_rate = (passed_cases / len(f1_scores)) if f1_scores else 0.0
        
        # Update run status and aggregates
        run.status = "COMPLETED"
        run.avg_latency = avg_latency
        run.total_cost = total_cost
        run.avg_faithfulness = avg_faithfulness
        run.avg_relevance = avg_relevance
        run.avg_context_recall = avg_context_recall
        run.avg_pii_safe = avg_pii_safe
        run.avg_jailbreak_safe = avg_jailbreak_safe
        run.avg_brand_safe = avg_brand_safe
        run.pass_rate = pass_rate
        run.completed_at = datetime.utcnow()
        db.commit()

        
    except Exception as e:
        print(f"Error during evaluation run: {e}")
        run.status = "FAILED"
        db.commit()

@router.post("/run", response_model=SchemaEvaluationRun)
def trigger_evaluation_run(
    run_data: SchemaEvaluationRunCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    """Triggers an evaluation run over a dataset."""
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == run_data.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    # Check if there are test cases in dataset
    test_cases_count = db.query(TestCase).filter(TestCase.dataset_id == run_data.dataset_id).count()
    if test_cases_count == 0:
        raise HTTPException(status_code=400, detail="Cannot run evaluation on empty dataset")
        
    # Create new run entry using SQLAlchemy model
    new_run = DBEvaluationRun(
        dataset_id=run_data.dataset_id,
        name=run_data.name,
        model=run_data.model,
        prompt_version=run_data.prompt_version,
        status="PENDING"
    )
    db.add(new_run)
    db.commit()
    db.refresh(new_run)
    
    # Trigger background execution via orchestrator
    enqueue_evaluation_run(new_run.id, background_tasks, db)
    
    return new_run

@router.get("/runs", response_model=List[SchemaEvaluationRun])
def list_evaluation_runs(db: Session = Depends(get_db)):
    """Returns a list of all evaluation runs."""
    return db.query(DBEvaluationRun).order_by(DBEvaluationRun.created_at.desc()).all()

@router.get("/runs/{run_id}", response_model=SchemaEvaluationRun)
def get_evaluation_run(run_id: int, db: Session = Depends(get_db)):
    """Gets details and individual test results of a specific run."""
    run = db.query(DBEvaluationRun).filter(DBEvaluationRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return run

@router.get("/compare")
def compare_evaluation_runs(run_a_id: int, run_b_id: int, db: Session = Depends(get_db)):
    """Compares the results of two evaluation runs side by side, matching test cases."""
    run_a = db.query(DBEvaluationRun).filter(DBEvaluationRun.id == run_a_id).first()
    run_b = db.query(DBEvaluationRun).filter(DBEvaluationRun.id == run_b_id).first()
    
    if not run_a or not run_b:
        raise HTTPException(status_code=404, detail="One or both evaluation runs not found")
        
    # Fetch results
    results_a = {r.test_case_id: r for r in run_a.results}
    results_b = {r.test_case_id: r for r in run_b.results}
    
    # Get all test cases involved (union of test case IDs)
    test_case_ids = set(results_a.keys()) | set(results_b.keys())
    test_cases = db.query(TestCase).filter(TestCase.id.in_(test_case_ids)).all()
    
    comparison = []
    for tc in test_cases:
        res_a = results_a.get(tc.id)
        res_b = results_b.get(tc.id)
        
        comparison.append({
            "test_case_id": tc.id,
            "question": tc.question,
            "expected_answer": tc.expected_answer,
            "run_a": {
                "generated_answer": res_a.generated_answer if res_a else None,
                "latency_seconds": res_a.latency_seconds if res_a else None,
                "cost_usd": res_a.cost_usd if res_a else 0.0,
                "exact_match": res_a.exact_match if res_a else None,
                "f1_score": res_a.f1_score if res_a else None,
                "rouge_l": res_a.rouge_l if res_a else None
            } if res_a else None,
            "run_b": {
                "generated_answer": res_b.generated_answer if res_b else None,
                "latency_seconds": res_b.latency_seconds if res_b else None,
                "cost_usd": res_b.cost_usd if res_b else 0.0,
                "exact_match": res_b.exact_match if res_b else None,
                "f1_score": res_b.f1_score if res_b else None,
                "rouge_l": res_b.rouge_l if res_b else None
            } if res_b else None,
            "f1_diff": (res_b.f1_score - res_a.f1_score) if (res_a and res_b and res_a.f1_score is not None and res_b.f1_score is not None) else None
        })
        
    return {
        "run_a": {
            "id": run_a.id,
            "name": run_a.name,
            "model": run_a.model,
            "prompt_version": run_a.prompt_version,
            "avg_latency": run_a.avg_latency,
            "total_cost": run_a.total_cost,
            "pass_rate": run_a.pass_rate
        },
        "run_b": {
            "id": run_b.id,
            "name": run_b.name,
            "model": run_b.model,
            "prompt_version": run_b.prompt_version,
            "avg_latency": run_b.avg_latency,
            "total_cost": run_b.total_cost,
            "pass_rate": run_b.pass_rate
        },
        "comparison": comparison
    }

def _calculate_metrics_for_pairs(pairs):
    """Helper calculating confusion matrix, F1, and Cohen's Kappa from binary pairs list."""
    if not pairs:
        return {
            "confusion_matrix": {"tp": 0, "fp": 0, "fn": 0, "tn": 0},
            "cohens_kappa": 0.0,
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1_score": 0.0
        }
        
    tp = sum(1 for j, h in pairs if j == 1 and h == 1)
    fp = sum(1 for j, h in pairs if j == 1 and h == 0)
    fn = sum(1 for j, h in pairs if j == 0 and h == 1)
    tn = sum(1 for j, h in pairs if j == 0 and h == 0)
    total = len(pairs)
    
    accuracy = (tp + tn) / total
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    
    # Cohen's Kappa
    p_o = (tp + tn) / total
    p_yes = ((tp + fp) / total) * ((tp + fn) / total)
    p_no = ((tn + fn) / total) * ((tn + fp) / total)
    p_e = p_yes + p_no
    
    if p_e >= 1.0 or abs(1.0 - p_e) < 1e-9:
        kappa = 1.0 if p_o == 1.0 else 0.0
    else:
        kappa = (p_o - p_e) / (1.0 - p_e)
        
    return {
        "confusion_matrix": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
        "cohens_kappa": round(kappa, 3),
        "accuracy": round(accuracy, 3),
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1_score": round(f1, 3)
    }

@router.get("/runs/{run_id}/calibration")
def get_judge_calibration(run_id: int, db: Session = Depends(get_db)):
    """Computes calibration statistics comparing LLM-as-judge scores to human annotations.
    
    Threshold of 0.70 is used to bin scores into binary positive/negative classes.
    """
    from backend.app.models.annotation import Annotation as DBAnnotation
    
    results = db.query(DBEvaluationResult).filter(DBEvaluationResult.run_id == run_id).all()
    annotations = db.query(DBAnnotation).filter(DBAnnotation.run_id == run_id).all()
    
    annotated_count = len(annotations)
    if annotated_count == 0:
        return {
            "annotated_count": 0,
            "faithfulness": None,
            "relevance": None,
            "context_recall": None,
            "message": "No annotations found to calculate calibration. Review cases in the Annotation Queue first."
        }
        
    ann_map = {ann.result_id: ann for ann in annotations}
    
    faith_pairs = []
    relevance_pairs = []
    recall_pairs = []
    
    # 0.70 threshold for metric classifications
    threshold = 0.70
    
    for r in results:
        ann = ann_map.get(r.id)
        if not ann:
            continue
            
        # 1. Faithfulness
        if r.faithfulness is not None and ann.faithfulness_user is not None:
            j_label = 1 if r.faithfulness >= threshold else 0
            h_label = 1 if ann.faithfulness_user >= threshold else 0
            faith_pairs.append((j_label, h_label))
            
        # 2. Relevance
        if r.relevance is not None and ann.relevance_user is not None:
            j_label = 1 if r.relevance >= threshold else 0
            h_label = 1 if ann.relevance_user >= threshold else 0
            relevance_pairs.append((j_label, h_label))
            
        # 3. Context Recall
        if r.context_recall is not None and ann.context_recall_user is not None:
            j_label = 1 if r.context_recall >= threshold else 0
            h_label = 1 if ann.context_recall_user >= threshold else 0
            recall_pairs.append((j_label, h_label))
            
    return {
        "annotated_count": annotated_count,
        "faithfulness": _calculate_metrics_for_pairs(faith_pairs),
        "relevance": _calculate_metrics_for_pairs(relevance_pairs),
        "context_recall": _calculate_metrics_for_pairs(recall_pairs)
    }

