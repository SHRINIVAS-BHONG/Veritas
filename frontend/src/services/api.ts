import axios from 'axios';
import type { Dataset, EvaluationRun, RunComparison } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // --- Datasets ---
  getDatasets: async (): Promise<Dataset[]> => {
    const res = await client.get<Dataset[]>('/datasets/');
    return res.data;
  },
  
  getDataset: async (id: number): Promise<Dataset> => {
    const res = await client.get<Dataset>(`/datasets/${id}`);
    return res.data;
  },
  
  // --- Evaluation Runs ---
  triggerRun: async (payload: {
    dataset_id: number;
    name: string;
    model: string;
    prompt_version: string;
  }): Promise<EvaluationRun> => {
    const res = await client.post<EvaluationRun>('/evaluations/run', payload);
    return res.data;
  },
  
  getRuns: async (): Promise<EvaluationRun[]> => {
    const res = await client.get<EvaluationRun[]>('/evaluations/runs');
    return res.data;
  },
  
  getRun: async (id: number): Promise<EvaluationRun> => {
    const res = await client.get<EvaluationRun>(`/evaluations/runs/${id}`);
    return res.data;
  },
  
  compareRuns: async (runAId: number, runBId: number): Promise<RunComparison> => {
    const res = await client.get<RunComparison>(
      `/evaluations/compare?run_a_id=${runAId}&run_b_id=${runBId}`
    );
    return res.data;
  }
};
