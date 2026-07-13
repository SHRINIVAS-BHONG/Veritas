from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class TestCaseBase(BaseModel):
    question: str
    expected_answer: str
    reference_context: Optional[str] = None

class TestCaseCreate(TestCaseBase):
    pass

class TestCase(TestCaseBase):
    id: int
    dataset_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None

class DatasetCreate(DatasetBase):
    pass

class Dataset(DatasetBase):
    id: int
    created_at: datetime
    test_cases: List[TestCase] = []

    class Config:
        from_attributes = True
