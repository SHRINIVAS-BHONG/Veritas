from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class EvaluationResultBase(BaseModel):
    test_case_id: int
    generated_answer: str
    retrieved_context: Optional[str] = None
    
    latency_seconds: Optional[float] = None
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    
    exact_match: Optional[float] = None
    f1_score: Optional[float] = None
    rouge_l: Optional[float] = None
    
    faithfulness: Optional[float] = None
    faithfulness_reasoning: Optional[str] = None
    
    relevance: Optional[float] = None
    relevance_reasoning: Optional[str] = None
    
    context_recall: Optional[float] = None
    context_recall_reasoning: Optional[str] = None
    
    # Safety Metrics
    pii_safe: Optional[float] = None
    jailbreak_safe: Optional[float] = None
    brand_safe: Optional[float] = None


class EvaluationResultCreate(EvaluationResultBase):
    pass

class EvaluationResult(EvaluationResultBase):
    id: int
    run_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class EvaluationRunBase(BaseModel):
    name: str
    model: str
    prompt_version: str
    dataset_id: int

class EvaluationRunCreate(EvaluationRunBase):
    pass

class EvaluationRun(EvaluationRunBase):
    id: int
    status: str
    avg_latency: Optional[float] = None
    total_cost: Optional[float] = None
    avg_faithfulness: Optional[float] = None
    avg_relevance: Optional[float] = None
    avg_context_recall: Optional[float] = None
    avg_pii_safe: Optional[float] = None
    avg_jailbreak_safe: Optional[float] = None
    avg_brand_safe: Optional[float] = None
    pass_rate: Optional[float] = None
    
    created_at: datetime
    completed_at: Optional[datetime] = None
    results: List[EvaluationResult] = []

    class Config:
        from_attributes = True
