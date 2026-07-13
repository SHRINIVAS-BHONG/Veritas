from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.database import Base

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("evaluation_results.id"), nullable=False)
    run_id = Column(Integer, ForeignKey("evaluation_runs.id"), nullable=False)
    
    # Annotator details
    annotator_name = Column(String, default="human_reviewer")
    
    # Corrected Scores (null if not reviewed or if human agrees with judge)
    faithfulness_user = Column(Float, nullable=True)
    relevance_user = Column(Float, nullable=True)
    context_recall_user = Column(Float, nullable=True)
    
    # Calibration details
    is_disagreement = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    result = relationship("EvaluationResult", back_populates="annotations")
    run = relationship("EvaluationRun", back_populates="annotations")
