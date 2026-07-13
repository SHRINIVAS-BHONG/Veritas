from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from backend.app.database import get_db
from backend.app.models.evaluation import EvaluationResult as DBEvaluationResult
from backend.app.models.annotation import Annotation as DBAnnotation
from backend.app.schemas.annotation import Annotation as SchemaAnnotation, AnnotationCreate as SchemaAnnotationCreate

router = APIRouter(prefix="/annotations", tags=["annotations"])

def compute_disagreement(result: DBEvaluationResult, data: SchemaAnnotationCreate) -> bool:
    """Helper to compute if human disagrees with judge ratings."""
    disagreement = False
    
    # 1. Check Faithfulness
    if data.faithfulness_user is not None and result.faithfulness is not None:
        if abs(data.faithfulness_user - result.faithfulness) > 0.01:
            disagreement = True
            
    # 2. Check Relevance
    if data.relevance_user is not None and result.relevance is not None:
        if abs(data.relevance_user - result.relevance) > 0.01:
            disagreement = True
            
    # 3. Check Context Recall
    if data.context_recall_user is not None and result.context_recall is not None:
        if abs(data.context_recall_user - result.context_recall) > 0.01:
            disagreement = True
            
    return disagreement

@router.post("/", response_model=SchemaAnnotation)
def create_or_update_annotation(data: SchemaAnnotationCreate, db: Session = Depends(get_db)):
    """Creates or updates a manual annotation/rating for an SUT generated response."""
    result = db.query(DBEvaluationResult).filter(DBEvaluationResult.id == data.result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Evaluation result record not found")
        
    # Check if annotation already exists for this test result
    annotation = db.query(DBAnnotation).filter(DBAnnotation.result_id == data.result_id).first()
    
    # Auto-compute if human ratings disagree with judge scores
    is_disagree = compute_disagreement(result, data)
    
    if annotation:
        # Update existing
        annotation.annotator_name = data.annotator_name
        annotation.faithfulness_user = data.faithfulness_user
        annotation.relevance_user = data.relevance_user
        annotation.context_recall_user = data.context_recall_user
        annotation.is_disagreement = is_disagree
        annotation.notes = data.notes
        annotation.updated_at = datetime.utcnow()
    else:
        # Create new
        annotation = DBAnnotation(
            result_id=data.result_id,
            run_id=data.run_id,
            annotator_name=data.annotator_name,
            faithfulness_user=data.faithfulness_user,
            relevance_user=data.relevance_user,
            context_recall_user=data.context_recall_user,
            is_disagreement=is_disagree,
            notes=data.notes
        )
        db.add(annotation)
        
    db.commit()
    db.refresh(annotation)
    return annotation

@router.get("/run/{run_id}", response_model=List[SchemaAnnotation])
def get_run_annotations(run_id: int, db: Session = Depends(get_db)):
    """Returns a list of all human annotations for an evaluation run."""
    return db.query(DBAnnotation).filter(DBAnnotation.run_id == run_id).all()

@router.get("/result/{result_id}", response_model=SchemaAnnotation)
def get_result_annotation(result_id: int, db: Session = Depends(get_db)):
    """Returns the human annotation for an individual evaluation result, if it exists."""
    annotation = db.query(DBAnnotation).filter(DBAnnotation.result_id == result_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="No annotation found for this result")
    return annotation
