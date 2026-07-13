export interface TestCase {
  id: number;
  dataset_id: number;
  question: string;
  expected_answer: string;
  reference_context?: string;
  created_at: string;
}

export interface Dataset {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  test_cases: TestCase[];
}

export interface EvaluationResult {
  id: number;
  run_id: number;
  test_case_id: number;
  generated_answer: string;
  retrieved_context?: string;
  
  // Operation Metrics
  latency_seconds?: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  
  // Deterministic Metrics
  exact_match?: number;
  f1_score?: number;
  rouge_l?: number;
  
  // LLM-as-Judge Metrics
  faithfulness?: number;
  faithfulness_reasoning?: string;
  relevance?: number;
  relevance_reasoning?: string;
  context_recall?: number;
  context_recall_reasoning?: string;
  
  created_at: string;
}

export interface EvaluationRun {
  id: number;
  dataset_id: number;
  name: string;
  model: string;
  prompt_version: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  
  // Aggregated Metrics
  avg_latency?: number;
  total_cost?: number;
  avg_faithfulness?: number;
  avg_relevance?: number;
  avg_context_recall?: number;
  pass_rate?: number;
  
  created_at: string;
  completed_at?: string;
  results: EvaluationResult[];
}

export interface ComparisonRunDetails {
  id: number;
  name: string;
  model: string;
  prompt_version: string;
  avg_latency?: number;
  total_cost?: number;
  pass_rate?: number;
}

export interface CompareResultItem {
  test_case_id: number;
  question: string;
  expected_answer: string;
  run_a?: {
    generated_answer?: string;
    latency_seconds?: number;
    cost_usd: number;
    exact_match?: number;
    f1_score?: number;
    rouge_l?: number;
  };
  run_b?: {
    generated_answer?: string;
    latency_seconds?: number;
    cost_usd: number;
    exact_match?: number;
    f1_score?: number;
    rouge_l?: number;
  };
  f1_diff?: number;
}

export interface RunComparison {
  run_a: ComparisonRunDetails;
  run_b: ComparisonRunDetails;
  comparison: CompareResultItem[];
}

export interface Annotation {
  id?: number;
  result_id: number;
  run_id: number;
  annotator_name?: string;
  faithfulness_user?: number;
  relevance_user?: number;
  context_recall_user?: number;
  is_disagreement?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CalibrationMetricDetails {
  confusion_matrix: { tp: number; fp: number; fn: number; tn: number };
  cohens_kappa: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface CalibrationReport {
  annotated_count: number;
  faithfulness: CalibrationMetricDetails | null;
  relevance: CalibrationMetricDetails | null;
  context_recall: CalibrationMetricDetails | null;
  message?: string;
}

