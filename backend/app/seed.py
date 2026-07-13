import os
import json
import sys

# Ensure workspace directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.database import SessionLocal, Base, engine
from backend.app.models.dataset import Dataset, TestCase
from backend.app.models.evaluation import EvaluationRun, EvaluationResult
from backend.app.models.annotation import Annotation

# File paths relative to workspace root
WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GOLDEN_SET_PATH = os.path.join(WORKSPACE_DIR, "data", "golden_set.json")
SAFETY_SET_PATH = os.path.join(WORKSPACE_DIR, "data", "safety_set.json")

def seed_database():
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Seed Golden Dataset
        if os.path.exists(GOLDEN_SET_PATH):
            with open(GOLDEN_SET_PATH, "r", encoding="utf-8") as f:
                golden_cases = json.load(f)
                
            # Check if Golden Set already exists
            dataset_name = "Golden Set v1"
            db_dataset = db.query(Dataset).filter(Dataset.name == dataset_name).first()
            
            if not db_dataset:
                print(f"Creating dataset '{dataset_name}'...")
                db_dataset = Dataset(
                    name=dataset_name, 
                    description="Standard evaluation suite containing 20 high-quality product FAQ Q&A pairs."
                )
                db.add(db_dataset)
                db.commit()
                db.refresh(db_dataset)
                
                # Add test cases
                for tc in golden_cases:
                    new_tc = TestCase(
                        dataset_id=db_dataset.id,
                        question=tc["question"],
                        expected_answer=tc["expected_answer"],
                        reference_context=tc.get("reference_context")
                    )
                    db.add(new_tc)
                db.commit()
                print(f"Successfully seeded {len(golden_cases)} test cases into '{dataset_name}'.")
            else:
                print(f"Dataset '{dataset_name}' already exists. Skipping seeding.")
        else:
            print(f"Golden set file not found at {GOLDEN_SET_PATH}")

        # 2. Seed Safety Dataset
        if os.path.exists(SAFETY_SET_PATH):
            with open(SAFETY_SET_PATH, "r", encoding="utf-8") as f:
                safety_cases = json.load(f)
                
            # Check if Safety Set already exists
            safety_dataset_name = "Safety Set v1"
            db_safety_dataset = db.query(Dataset).filter(Dataset.name == safety_dataset_name).first()
            
            if not db_safety_dataset:
                print(f"Creating dataset '{safety_dataset_name}'...")
                db_safety_dataset = Dataset(
                    name=safety_dataset_name, 
                    description="Adversarial evaluation suite containing 10 safety and jailbreak test cases."
                )
                db.add(db_safety_dataset)
                db.commit()
                db.refresh(db_safety_dataset)
                
                # Add test cases
                for tc in safety_cases:
                    new_tc = TestCase(
                        dataset_id=db_safety_dataset.id,
                        question=tc["question"],
                        expected_answer=tc["expected_answer"],
                        reference_context=None # Context is not applicable/empty for safety test cases
                    )
                    db.add(new_tc)
                db.commit()
                print(f"Successfully seeded {len(safety_cases)} test cases into '{safety_dataset_name}'.")
            else:
                print(f"Dataset '{safety_dataset_name}' already exists. Skipping seeding.")
        else:
            print(f"Safety set file not found at {SAFETY_SET_PATH}")
            
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
