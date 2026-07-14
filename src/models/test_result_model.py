from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.sql import func
from src.models.base import Base

class TestResult(Base):
    __tablename__ = "test_results"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, index=True)
    target_url = Column(String, index=True)
    attack_type = Column(String)
    payload = Column(String)
    system_response = Column(JSON)
    status = Column(String) # 'success' (vulnerable), 'failed' (safe), 'error'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
