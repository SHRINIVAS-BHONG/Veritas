# TrustBench — An LLM Evaluation & Observability Platform for Customer-Facing AI Systems

**A job-ready portfolio project | Domain: AI Quality Assurance / MLOps (non-healthcare)**

---

## 1. Why this project

Every company that ships an LLM feature (support chatbot, RAG search, coding assistant, sales copilot) now needs a way to answer: *"Did our last prompt/model change make things better or worse?"* This is one of the fastest-growing job categories in 2025–2026 — titles like "LLM Evaluation Engineer," "AI Quality Engineer," and "Applied AI / MLOps Engineer" all center on exactly this problem. It is also a great fit for you: it's NLP-heavy, benefits from your model-architecture background, and is a clean, demoable full-stack system — distinct from your medical-VQA work, which keeps your portfolio diversified.

**The real-world problem TrustBench solves:** a company runs an LLM-powered customer support assistant (RAG over a product knowledge base). Every time they change the prompt, swap models, or update the retrieval index, they need to know — automatically, before shipping — whether answers are still accurate, grounded in the docs, safe, and cost-efficient. Today most teams do this by eyeballing a few outputs. TrustBench replaces that with an automated, auditable evaluation pipeline plus a human-review UI, styled after tools like LangSmith, Arize Phoenix, and Braintrust, but built by you, end-to-end, so you can speak to every layer in an interview.

---

## 2. Scope: what you're actually building

A working RAG-based customer-support assistant (the "system under test") **plus** the evaluation platform wrapped around it. You need the system under test only as a realistic subject to evaluate — keep it simple (a few hundred FAQ/product docs is enough, e.g. scrape an open-source project's public docs, or use a public e-commerce FAQ dataset).

The platform itself has four pillars:

1. **Golden dataset & test-case management** — curated question/expected-answer/reference-context sets, versioned.
2. **Automated evaluation engine** — a battery of metrics computed on every run (deterministic + LLM-as-judge).
3. **Human-in-the-loop review** — a UI where a reviewer can browse runs, disagree with the judge, and add labels that feed back into the judge's calibration.
4. **Regression / comparison dashboard** — compare two runs (e.g. "gpt-4o-mini vs. gpt-4.1-mini" or "prompt v3 vs v4") side by side, with pass/fail gating usable in CI.

---

## 3. System architecture

```
                     ┌─────────────────────────┐
                     │   System Under Test      │
                     │  (RAG chatbot: retriever │
                     │   + LLM generator)        │
                     └────────────┬─────────────┘
                                  │ logs every call
                                  ▼
 ┌────────────┐   trigger    ┌─────────────────────┐
 │ Golden Set  │─────────────▶│  Eval Orchestrator   │
 │ (test cases)│              │  (Python, Celery/    │
 └────────────┘              │   RQ task queue)      │
                              └─────────┬────────────┘
                                        │ fan-out
                     ┌──────────────────┼──────────────────┐
                     ▼                  ▼                  ▼
             ┌───────────────┐  ┌───────────────┐  ┌────────────────┐
             │ Deterministic  │  │ LLM-as-Judge   │  │ Safety/Cost    │
             │ metrics        │  │ metrics        │  │ metrics        │
             │ (BLEU/ROUGE,   │  │ (faithfulness, │  │ (toxicity,     │
             │ exact match,   │  │ relevance,     │  │ PII leak, $    │
             │ latency)       │  │ context recall)│  │ per call)      │
             └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
                     └──────────────────┬┴──────────────────┘
                                        ▼
                              ┌───────────────────┐
                              │ Postgres (results, │
                              │ runs, annotations) │
                              └─────────┬──────────┘
                                        ▼
                     ┌──────────────────────────────────┐
                     │  FastAPI backend (REST + WebSocket │
                     │  for live run progress)            │
                     └─────────────┬──────────────────────┘
                                    ▼
                     ┌──────────────────────────────────┐
                     │  React frontend: run dashboard,    │
                     │  diff view, annotation queue        │
                     └──────────────────────────────────┘
```

---

## 4. Tech stack (pick one lane, justify it in interviews)

| Layer | Recommended | Why |
|---|---|---|
| System-under-test LLM | OpenAI / Anthropic API (small, cheap models) + one local model via Ollama | Shows you can eval across providers, not just one |
| Retrieval | `pgvector` or `Chroma` + `sentence-transformers` embeddings | Lightweight, no extra infra cost |
| Orchestration | Python, FastAPI, Celery + Redis (or just RQ for simplicity) | Async eval jobs, realistic MLOps pattern |
| Database | PostgreSQL | Structured run/metric storage, easy to query for the dashboard |
| Frontend | React + TypeScript, Tailwind, Recharts | Matches real eval-tool UIs; recruiters recognize the pattern |
| Deployment | Docker Compose locally → Render/Fly.io/Railway for a live demo | Free-tier deployable, shows you can ship |
| CI hook | GitHub Actions workflow that runs the eval suite on PRs touching the prompt/RAG code and fails the build below a threshold | This single feature is the strongest "I get MLOps" signal in the whole project |

---

## 5. The evaluation metrics (the technical core)

Group these clearly in your code/docs — this structure itself is interview gold.

**A. Deterministic / reference-based**
- Exact match / F1 (for factual Q&A style questions)
- ROUGE-L (for longer generated answers)
- Latency (p50/p95) and cost per call

**B. LLM-as-judge (the differentiator)**
- **Faithfulness / groundedness**: does the answer only use facts present in the retrieved context? Implement via a judge prompt that extracts claims from the answer and checks each against the context (this claim-decomposition approach is what makes a judge defensible — cite RAGAS's methodology as prior art, but implement your own).
- **Answer relevance**: does the answer address the actual question (independent of correctness)?
- **Context precision/recall**: did the retriever pull the right chunks, and only the right chunks?
- **Judge calibration**: track judge-vs-human agreement (Cohen's kappa) on a sample every run — this is the detail that separates a toy project from a "job ready" one, because it shows you know LLM judges are noisy and need to be measured, not trusted blindly.

**C. Safety / guardrail metrics**
- Toxicity/harmful-content classifier on outputs (small open model, e.g. a HF toxic-comment classifier)
- PII leakage regex + NER pass
- Prompt-injection resistance (a small adversarial test set you write yourself)

**D. Cost/ops metrics**
- Tokens in/out, $ per query, latency — surfaced per model so the dashboard can answer "is the cheaper model good enough?"

---

## 6. UI/UX design

Think three screens, each with a clear job:

**1. Run Dashboard (landing page)**
- Table of evaluation runs: model/prompt version, date, pass rate, avg faithfulness, avg latency, $ cost
- Sparkline trend per metric over the last N runs (regression-at-a-glance)
- A big "Compare" button to select two runs

**2. Run Detail / Diff View**
- Left: test case (question + retrieved context). Right: two columns for old vs. new run's answers, metric scores color-coded (green/amber/red)
- Filter by "regressions only" — cases where the new run scored worse
- Click a row to expand the judge's reasoning trace (always show *why* the judge scored what it scored — critical for trust and for your own debugging)

**3. Annotation Queue (human-in-the-loop)**
- A reviewer works through a queue of judge-scored cases, agrees/disagrees with one click, optionally edits the score and leaves a note
- These labels feed a small "judge calibration" report (agreement %, confusion matrix) — this closes the loop and is the single feature that most portfolio projects skip, so it's your differentiator

Design notes: use a dense, data-tool aesthetic (think Linear/Vercel dashboards) — not a marketing-site look. Muted neutral background, one accent color reserved for regressions/alerts, monospace font for scores and IDs, generous use of small multiples over big single charts.

---

## 7. Data you'll need

- 100–300 golden Q&A pairs with reference context. Fastest path: pick a public docs set (e.g. an open-source project's documentation, or a public e-commerce FAQ dataset) and generate candidate Q&A pairs with an LLM, then hand-review/edit ~100 of them yourself — the hand-review is what makes it a credible golden set, so don't skip it.
- A small adversarial set (10–20 prompt-injection / off-topic / harmful-request examples) you write by hand for the safety metrics.

---

## 8. Build plan & Status (Completed!)

| Week | Deliverable | Status |
|---|---|---|
| 1 | System-under-test: minimal RAG chatbot (retriever + generator) working end-to-end on FAQ docs | **[x] COMPLETED** |
| 2 | Golden dataset built + deterministic metrics + SQLite / Postgres results persistence | **[x] COMPLETED** |
| 3 | LLM-as-judge metrics (faithfulness, relevance, context precision/recall) with reasoning traces stored | **[x] COMPLETED** |
| 4 | React dashboard: run list + run detail/diff view wired to the backend | **[x] COMPLETED** |
| 5 | Annotation queue UI + human-in-the-loop judge-calibration report (Cohen's Kappa & Confusion Matrix) | **[x] COMPLETED** |
| 6 | GitHub Actions CI gate, Docker Compose packaging, and multi-stage container deployment configurations | **[x] COMPLETED** |
| Phase 2 | **100 Tricky Cases Expansion** (Permutation-generated edge-cases) + **Hugging Face Inference API Routing** | **[x] COMPLETED** |

---

## 9. What makes this "job ready" vs. a toy project

- **Judge calibration tracking** — most portfolio eval projects trust the LLM judge blindly; measuring and reporting its agreement with humans is a senior-level signal.
- **CI gating** — wiring the eval suite into GitHub Actions so a PR fails if faithfulness drops below a threshold is the exact workflow real AI teams run.
- **Cost/latency alongside quality** — shows product judgment, not just ML skill (a model that's 2% better but 5x the cost is usually the wrong choice).
- **Reasoning traces surfaced in UI**, not hidden — shows you understand that eval tools need to be debuggable, not just scoreboards.
- **Cross-provider evaluation** (at least one OpenAI/Anthropic model + one local model) — shows you're not locked into one vendor's tooling.

---

## 10. How to present it on your resume/portfolio

One line: *"Built an LLM evaluation platform (FastAPI/React/Postgres) implementing faithfulness, relevance, and safety metrics with LLM-as-judge scoring, human-in-the-loop calibration tracking, and a CI gate that blocks regressions — deployed with a live demo."*

For your portfolio site, this pairs well as a second, contrasting pillar next to your medical-VQA work: one shows deep model-architecture research, this one shows you can ship production-grade AI infrastructure end-to-end.

---

## 11. Stretch goals (only if time allows)

- Multi-turn conversation evaluation (not just single Q&A)
- A/B routing: automatically split live traffic between two prompts and report which one wins on your metrics
- Drift detection: alert when live traffic's questions start diverging from the golden set's distribution
