from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AnnotationBase(BaseModel):
    result_id: int
    run_id: int
    annotator_name: Optional[str] = "human_reviewer"
    
    faithfulness_user: Optional[float] = None
    relevance_user: Optional[float] = None
    context_recall_user: Optional[float] = None
    
    is_disagreement: bool = False
    notes: Optional[str] = None

class AnnotationCreate(AnnotationBase):
    pass

class Annotation(AnnotationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
