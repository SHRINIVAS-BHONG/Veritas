# Veritas

Automated evaluation & observability platform for RAG systems — faithfulness, relevance, and safety scoring via LLM-as-judge, human-in-the-loop calibration tracking, and CI regression gating. Built with FastAPI, React, and PostgreSQL.

---

## Project Structure

```
Veritas/
├── backend/                           # FastAPI Backend + Eval Orchestrator
│   ├── app/
│   │   ├── main.py                    # FastAPI entrypoint
│   │   ├── config.py                  # Configurations (DB, Redis, LLM API keys)
│   │   ├── database.py                # Database connection helper
│   │   ├── models/                    # SQL Alchemy models (runs, metrics, annotation)
│   │   ├── schemas/                   # Pydantic validation schemas
│   │   ├── api/                       # API routes (datasets, metrics, runs)
│   │   ├── core/                      # Eval Orchestrator, LLM Judges, Metrics
│   │   └── system_under_test/         # RAG chatbot system to be evaluated
│   └── requirements.txt               # Backend requirements
├── frontend/                          # React + TypeScript Frontend app
└── data/                              # Golden dataset and adversarial evaluation sets
```

---

## Local Setup

### 1. Prerequisites
- Python 3.10 or higher (tested on 3.14.0)
- Node.js (for React frontend)
- Redis and PostgreSQL (or use SQLite for lightweight testing)

### 2. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment template and set your API keys:
   ```bash
   # Create a .env file with:
   OPENAI_API_KEY=your-openai-api-key
   DATABASE_URL=sqlite:///./veritas.db
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```
