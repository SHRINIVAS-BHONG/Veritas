from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    test_cases = relationship("TestCase", back_populates="dataset", cascade="all, delete-orphan")
    runs = relationship("EvaluationRun", back_populates="dataset")

class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    question = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=False)
    reference_context = Column(Text, nullable=True) # Context retrieved when gold set was created
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    dataset = relationship("Dataset", back_populates="test_cases")
    results = relationship("EvaluationResult", back_populates="test_case", cascade="all, delete-orphan")
