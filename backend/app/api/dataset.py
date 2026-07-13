from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.app.database import get_db
from backend.app.models.dataset import Dataset as DBDataset, TestCase as DBTestCase
from backend.app.schemas.dataset import Dataset, DatasetCreate, TestCase, TestCaseCreate

router = APIRouter(prefix="/datasets", tags=["datasets"])

@router.get("/", response_model=List[Dataset])
def list_datasets(db: Session = Depends(get_db)):
    return db.query(DBDataset).all()

@router.post("/", response_model=Dataset)
def create_dataset(dataset: DatasetCreate, db: Session = Depends(get_db)):
    db_dataset = db.query(DBDataset).filter(DBDataset.name == dataset.name).first()
    if db_dataset:
        raise HTTPException(status_code=400, detail="Dataset name already exists")
    
    new_dataset = DBDataset(name=dataset.name, description=dataset.description)
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)
    return new_dataset

@router.get("/{dataset_id}", response_model=Dataset)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    db_dataset = db.query(DBDataset).filter(DBDataset.id == dataset_id).first()
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return db_dataset

@router.post("/{dataset_id}/testcases", response_model=List[TestCase])
def add_test_cases(dataset_id: int, test_cases: List[TestCaseCreate], db: Session = Depends(get_db)):
    db_dataset = db.query(DBDataset).filter(DBDataset.id == dataset_id).first()
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    new_test_cases = []
    for tc in test_cases:
        new_tc = DBTestCase(
            dataset_id=dataset_id,
            question=tc.question,
            expected_answer=tc.expected_answer,
            reference_context=tc.reference_context
        )
        db.add(new_tc)
        new_test_cases.append(new_tc)
        
    db.commit()
    for tc in new_test_cases:
        db.refresh(tc)
    return new_test_cases
