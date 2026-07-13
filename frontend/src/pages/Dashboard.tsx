import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Dataset, EvaluationRun } from '../types';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Play, Layers, BarChart2, Zap, Clock, ArrowRight, RefreshCw } from 'lucide-react';

interface DashboardProps {
  onCompare: (runAId: number, runBId: number) => void;
  onViewDetails: (runId: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onCompare, onViewDetails }) => {
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>([]);
  
  // Trigger Run Modal State
  const [showModal, setShowModal] = useState(false);
  const [datasetId, setDatasetId] = useState<number>(0);
  const [runName, setRunName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [promptVersion, setPromptVersion] = useState('v1.0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await fetchData();
    setTimeout(() => setIsRetrying(false), 500); // 500ms delay for visual feedback
  };

  const fetchData = async () => {
    try {
      const runsData = await api.getRuns();
      const datasetsData = await api.getDatasets();
      setRuns(runsData);
      setDatasets(datasetsData);
      if (datasetsData.length > 0 && datasetId === 0) {
        setDatasetId(datasetsData[0].id);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Poll status of running or pending evaluations
  useEffect(() => {
    const activeRuns = runs.filter(r => r.status === 'PENDING' || r.status === 'QUEUED' || r.status === 'RUNNING');
    if (activeRuns.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const updatedRuns = await api.getRuns();
        setRuns(updatedRuns);
      } catch (err) {
        console.error('Error polling runs:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [runs]);

  const handleSelectRun = (runId: number) => {
    if (selectedRunIds.includes(runId)) {
      setSelectedRunIds(selectedRunIds.filter(id => id !== runId));
    } else {
      if (selectedRunIds.length >= 2) {
        // limit to 2 selections
        setSelectedRunIds([selectedRunIds[1], runId]);
      } else {
        setSelectedRunIds([...selectedRunIds, runId]);
      }
    }
  };

  const handleTriggerRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datasetId) return;

    setIsSubmitting(true);
    try {
      const name = runName.trim();
      const finalName = name || `Evaluation Run - ${new Date().toLocaleTimeString()}`;
      await api.triggerRun({
        dataset_id: datasetId,
        name: finalName,
        model,
        prompt_version: promptVersion
      });
      setShowModal(false);
      setRunName('');
      fetchData();
    } catch (err) {
      console.error('Error triggering evaluation run:', err);
      alert('Failed to trigger evaluation run.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute Sparkline Data (last 8 completed runs)
  const completedRuns = [...runs].filter(r => r.status === 'COMPLETED').reverse();
  const sparklineData = completedRuns.map((r, idx) => ({
    index: idx,
    passRate: (r.pass_rate || 0) * 100,
    faithfulness: (r.avg_faithfulness || 0) * 100,
    latency: r.avg_latency || 0,
  }));

  // Aggregated Stats
  const latestRun = runs.find(r => r.status === 'COMPLETED');
  const avgPassRate = runs.length > 0 
    ? (runs.reduce((acc, r) => acc + (r.pass_rate || 0), 0) / runs.length) 
    : 0.0;

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Dashboard</h1>
          <p className="text-[#6B7280] mt-1 text-sm">Monitor overall project health and recent evaluation runs</p>
        </div>
        <div className="flex space-x-3">
          {selectedRunIds.length === 2 && (
            <button
              onClick={() => onCompare(selectedRunIds[0], selectedRunIds[1])}
              className="flex items-center px-4 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#D1D5DB] rounded-md text-sm font-medium transition-all gap-2"
            >
              <BarChart2 className="w-4 h-4" />
              Compare Runs
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-md text-sm font-medium transition-all shadow-sm gap-2"
          >
            <Play className="w-4 h-4 fill-white" />
            New Evaluation
          </button>
          <button
            onClick={fetchData}
            className="p-2 border border-[#E5E7EB] rounded-md text-[#6B7280] hover:text-[#111827] transition-all bg-white hover:bg-[#F9FAFB]"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sparkline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pass Rate Metric Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-center">
            <div className="text-[#6B7280] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#F59E0B]" /> Pass Rate (F1 &ge; 0.70)
            </div>
            <div className="text-2xl font-bold text-[#111827] font-mono">
              {latestRun ? `${((latestRun.pass_rate || 0) * 100).toFixed(0)}%` : '0%'}
            </div>
          </div>
          <div className="h-12 mt-4 -mx-1">
            {sparklineData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="passRate" stroke="#F59E0B" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-2">Historical avg: {(avgPassRate * 100).toFixed(0)}%</div>
        </div>

        {/* Faithfulness Metric Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-center">
            <div className="text-[#6B7280] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#10B981]" /> Faithfulness (Grounded)
            </div>
            <div className="text-2xl font-bold text-[#111827] font-mono">
              {latestRun ? `${((latestRun.avg_faithfulness || 0) * 100).toFixed(0)}%` : '0%'}
            </div>
          </div>
          <div className="h-12 mt-4 -mx-1">
            {sparklineData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="faithfulness" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-2">LLM-as-judge groundedness metric</div>
        </div>

        {/* Average Latency Metric Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-center">
            <div className="text-[#6B7280] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0EA5E9]" /> Avg Latency
            </div>
            <div className="text-2xl font-bold text-[#111827] font-mono">
              {latestRun ? `${(latestRun.avg_latency || 0).toFixed(3)}s` : '0.00s'}
            </div>
          </div>
          <div className="h-12 mt-4 -mx-1">
            {sparklineData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="latency" stroke="#0EA5E9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-2">Average response latency per generation</div>
        </div>
      </div>

      {/* Runs Table Section */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex justify-between items-center">
          <h2 className="text-base font-semibold text-[#111827]">Recent Evaluation Runs</h2>
          <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded font-medium border border-[#E5E7EB]">
            {runs.length} Runs total
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#6B7280]">Loading evaluation runs...</div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-[#6B7280]">
            No evaluation runs found. Click "New Evaluation" to trigger your first run!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">Select</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Model</th>
                  <th className="py-3 px-4">Prompt</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Pass Rate</th>
                  <th className="py-3 px-4 text-center">Faithfulness</th>
                  <th className="py-3 px-4 text-center">Relevance</th>
                  <th className="py-3 px-4 text-center">Recall</th>
                  <th className="py-3 px-4 text-center">Latency</th>
                  <th className="py-3 px-4 text-center">Cost</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {runs.map(run => {
                  const isSelected = selectedRunIds.includes(run.id);
                  
                  return (
                    <tr 
                      key={run.id} 
                      className={`hover:bg-slate-800/30 transition-all ${isSelected ? 'bg-slate-800/20' : ''}`}
                    >
                      <td className="py-4 px-6 text-center">
                        <input
                          type="checkbox"
                          disabled={run.status !== 'COMPLETED'}
                          checked={isSelected}
                          onChange={() => handleSelectRun(run.id)}
                          className="w-4 h-4 accent-emerald-500 rounded border-slate-700 bg-slate-950 text-emerald-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-4 px-6 font-medium text-white truncate max-w-xs" title={run.name}>
                        {run.name}
                      </td>
                      <td className="py-4 px-6 text-slate-300 font-mono text-xs">{run.model}</td>
                      <td className="py-4 px-6 text-slate-300 font-mono text-xs">{run.prompt_version}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                          run.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' :
                          run.status === 'FAILED' ? 'bg-red-950 text-red-400 border border-red-900/50' :
                          run.status === 'RUNNING' ? 'bg-sky-950 text-sky-400 border border-sky-900/50 animate-pulse' :
                          'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {run.status === 'RUNNING' && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {run.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-mono font-semibold">
                        {run.status === 'COMPLETED' ? `${((run.pass_rate || 0) * 100).toFixed(0)}%` : '-'}
                      </td>
                      <td className="py-4 px-6 text-center font-mono">
                        {run.status === 'COMPLETED' ? `${((run.avg_faithfulness || 0) * 100).toFixed(0)}%` : '-'}
                      </td>
                      <td className="py-4 px-6 text-center font-mono">
                        {run.status === 'COMPLETED' ? `${((run.avg_relevance || 0) * 100).toFixed(0)}%` : '-'}
                      </td>
                      <td className="py-4 px-6 text-center font-mono">
                        {run.status === 'COMPLETED' ? `${((run.avg_context_recall || 0) * 100).toFixed(0)}%` : '-'}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-slate-300">
                        {run.status === 'COMPLETED' ? `${(run.avg_latency || 0).toFixed(2)}s` : '-'}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-slate-300">
                        {run.status === 'COMPLETED' ? `$${(run.total_cost || 0).toFixed(4)}` : '-'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => onViewDetails(run.id)}
                          className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          Details <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Evaluation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/90 rounded-lg max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800/80 bg-slate-900/40">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-500 fill-blue-500/20" /> Trigger Evaluation Run
              </h3>
              <p className="text-slate-400 text-[11px] mt-1">Configure evaluation parameters to run tests against the chatbot.</p>
            </div>
            
            <form onSubmit={handleTriggerRun} className="p-6 space-y-5">
              {/* STEP 1: DATASET & NAME */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">STEP 1</span>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Evaluation Scope</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Target Dataset</label>
                    {datasets.length === 0 ? (
                      <div className="bg-amber-950/20 border border-amber-500/20 rounded-md p-3 space-y-2">
                        <div className="text-amber-400 text-[11px] font-semibold flex items-center gap-1.5">
                          <span>⚠️ No Datasets Loaded</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          The database is empty. Run <code>python app/seed.py</code> inside the backend folder to seed.
                        </p>
                        <button
                          type="button"
                          onClick={handleRetry}
                          disabled={isRetrying}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 hover:border-amber-400 text-amber-400 rounded text-xs transition-all font-bold shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                          {isRetrying ? 'Scanning...' : 'Retry Connection'}
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={datasetId}
                          onChange={(e) => setDatasetId(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md py-2.5 px-3 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none text-xs appearance-none cursor-pointer transition-all"
                          required
                          style={{ minHeight: '38px' }}
                        >
                          {datasets.map(ds => (
                            <option key={ds.id} value={ds.id}>{ds.name} ({ds.test_cases.length} cases)</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Run Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="Default: Date & Time"
                      value={runName}
                      onChange={(e) => setRunName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md py-2.5 px-3 text-white placeholder-slate-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none text-xs transition-all"
                      style={{ minHeight: '38px' }}
                    />
                  </div>
                </div>
              </div>

              {/* STEP 2: MODEL ROUTING */}
              <div className="border-t border-slate-800/40 pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">STEP 2</span>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Model Routing</span>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">System Model Under Test</label>
                  <input
                    type="text"
                    placeholder="Enter model string or click quick-pill"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md py-2.5 px-3 text-white placeholder-slate-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none text-xs font-mono transition-all"
                    required
                    style={{ minHeight: '38px' }}
                  />

                  {/* Clickable Quick Pills */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setModel('gpt-4o-mini')}
                      className={`px-2.5 py-1 text-[10px] rounded-full border transition-all ${
                        model === 'gpt-4o-mini'
                          ? 'bg-blue-900/25 border-blue-500/70 text-blue-400 font-semibold'
                          : 'bg-slate-950 border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      gpt-4o-mini (OpenAI)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModel('hf/meta-llama/Meta-Llama-3-8B-Instruct')}
                      className={`px-2.5 py-1 text-[10px] rounded-full border transition-all ${
                        model === 'hf/meta-llama/Meta-Llama-3-8B-Instruct'
                          ? 'bg-purple-900/25 border-purple-500/70 text-purple-400 font-semibold'
                          : 'bg-slate-950 border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      Llama-3 8B (HF)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModel('hf/google/gemma-2-9b-it')}
                      className={`px-2.5 py-1 text-[10px] rounded-full border transition-all ${
                        model === 'hf/google/gemma-2-9b-it'
                          ? 'bg-orange-950/25 border-orange-500/70 text-orange-400 font-semibold'
                          : 'bg-slate-950 border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      Gemma-2 9B (HF)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModel('ollama/llama3')}
                      className={`px-2.5 py-1 text-[10px] rounded-full border transition-all ${
                        model === 'ollama/llama3'
                          ? 'bg-emerald-950/25 border-emerald-500/70 text-emerald-400 font-semibold'
                          : 'bg-slate-950 border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      Llama-3 (Ollama)
                    </button>
                  </div>
                </div>
              </div>

              {/* STEP 3: CONFIG TAG */}
              <div className="border-t border-slate-800/40 pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">STEP 3</span>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Evaluation Meta-Tag</span>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Prompt Version / Config Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. v1.0-rag-baseline"
                    value={promptVersion}
                    onChange={(e) => setPromptVersion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md py-2.5 px-3 text-white placeholder-slate-750 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none text-xs transition-all"
                    required
                    style={{ minHeight: '38px' }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4 border-t border-slate-800/80 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-md transition-all text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || datasets.length === 0}
                  className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-md transition-all text-xs font-bold font-orbitron uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(2,132,199,0.6)] hover:shadow-[0_0_25px_rgba(2,132,199,0.8)]"
                >
                  {isSubmitting ? 'INITIATING...' : 'RUN EVALUATION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
