from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.database import Base

class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    model = Column(String, nullable=False)
    prompt_version = Column(String, nullable=False)
    status = Column(String, default="PENDING") # PENDING, RUNNING, COMPLETED, FAILED
    
    # Aggregated Metrics
    avg_latency = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)
    avg_faithfulness = Column(Float, nullable=True)
    avg_relevance = Column(Float, nullable=True)
    avg_context_recall = Column(Float, nullable=True)
    avg_pii_safe = Column(Float, nullable=True)
    avg_jailbreak_safe = Column(Float, nullable=True)
    avg_brand_safe = Column(Float, nullable=True)
    pass_rate = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    dataset = relationship("Dataset", back_populates="runs")
    results = relationship("EvaluationResult", back_populates="run", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="run", cascade="all, delete-orphan")

class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("evaluation_runs.id"), nullable=False)
    test_case_id = Column(Integer, ForeignKey("test_cases.id"), nullable=False)
    
    # SUT Outputs
    generated_answer = Column(Text, nullable=False)
    retrieved_context = Column(Text, nullable=True) # Actual context retrieved during this evaluation
    
    # Operation Metrics
    latency_seconds = Column(Float, nullable=True)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    
    # Deterministic Metrics
    exact_match = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    rouge_l = Column(Float, nullable=True)
    
    # LLM-as-Judge Metrics
    faithfulness = Column(Float, nullable=True)
    faithfulness_reasoning = Column(Text, nullable=True)
    
    relevance = Column(Float, nullable=True)
    relevance_reasoning = Column(Text, nullable=True)
    
    context_recall = Column(Float, nullable=True)
    context_recall_reasoning = Column(Text, nullable=True)
    
    # Safety Metrics
    pii_safe = Column(Float, default=1.0)
    jailbreak_safe = Column(Float, default=1.0)
    brand_safe = Column(Float, default=1.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    run = relationship("EvaluationRun", back_populates="results")
    test_case = relationship("TestCase", back_populates="results")
    annotations = relationship("Annotation", back_populates="result", cascade="all, delete-orphan")
