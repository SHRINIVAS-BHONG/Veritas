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
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Veritas Dashboard</h1>
          <p className="text-slate-400 mt-1">Automated LLM Evaluation and Observability Platform</p>
        </div>
        <div className="flex space-x-3">
          {selectedRunIds.length === 2 && (
            <button
              onClick={() => onCompare(selectedRunIds[0], selectedRunIds[1])}
              className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold transition-all shadow-md gap-2"
            >
              <BarChart2 className="w-4 h-4" />
              Compare Selected Runs
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold transition-all shadow-md gap-2"
          >
            <Play className="w-4 h-4 fill-white" />
            New Evaluation
          </button>
          <button
            onClick={fetchData}
            className="p-2 border border-slate-800 rounded-md text-slate-400 hover:text-white transition-all bg-slate-900/50"
            title="Refresh logs"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sparkline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pass Rate Metric Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex justify-between items-center">
            <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Pass Rate (F1 &ge; 0.70)
            </div>
            <div className="text-2xl font-bold text-white">
              {latestRun ? `${((latestRun.pass_rate || 0) * 100).toFixed(0)}%` : '0%'}
            </div>
          </div>
          <div className="h-10 mt-4">
            {sparklineData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="passRate" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2">Latest run status vs. historical average ({(avgPassRate * 100).toFixed(0)}%)</div>
        </div>

        {/* Faithfulness Metric Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex justify-between items-center">
            <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" /> Faithfulness (Grounded)
            </div>
            <div className="text-2xl font-bold text-white">
              {latestRun ? `${((latestRun.avg_faithfulness || 0) * 100).toFixed(0)}%` : '0%'}
            </div>
          </div>
          <div className="h-10 mt-4">
            {sparklineData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="faithfulness" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2">LLM-as-judge groundedness metric across evaluations</div>
        </div>

        {/* Average Latency Metric Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex justify-between items-center">
            <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-500" /> Avg Latency
            </div>
            <div className="text-2xl font-bold text-white">
              {latestRun ? `${(latestRun.avg_latency || 0).toFixed(3)}s` : '0.00s'}
            </div>
          </div>
          <div className="h-10 mt-4">
            {sparklineData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="latency" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2">Average response latency per evaluation question</div>
        </div>
      </div>

      {/* Runs Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Evaluation Log History</h2>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
            {runs.length} Runs total
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading evaluation runs...</div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No evaluation runs found. Click "New Evaluation" to trigger your first run!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6 w-12 text-center">Select</th>
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Model</th>
                  <th className="py-4 px-6">Prompt Version</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center">Pass Rate</th>
                  <th className="py-4 px-6 text-center">Faithfulness</th>
                  <th className="py-4 px-6 text-center">Relevance</th>
                  <th className="py-4 px-6 text-center">Context Recall</th>
                  <th className="py-4 px-6 text-center">Latency</th>
                  <th className="py-4 px-6 text-center">Cost</th>
                  <th className="py-4 px-6 text-right">Actions</th>
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
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">Trigger Evaluation Suite</h3>
              <p className="text-slate-400 text-sm mt-1">Select parameters to run test cases against the chatbot.</p>
            </div>
            
            <form onSubmit={handleTriggerRun} className="p-6 space-y-4">
              {/* Dataset Selection */}
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Target Dataset</label>
                <select
                  value={datasetId}
                  onChange={(e) => setDatasetId(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white focus:border-slate-700 outline-none text-sm"
                  required
                >
                  {datasets.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name} ({ds.test_cases.length} test cases)</option>
                  ))}
                </select>
              </div>

              {/* Run Name */}
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Run Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. gpt-4o-mini prompt v1.2"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white placeholder-slate-600 focus:border-slate-700 outline-none text-sm"
                />
              </div>

              {/* SUT Model selection */}
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">System Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white focus:border-slate-700 outline-none text-sm"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Cheap / Fast)</option>
                  <option value="gpt-4o">gpt-4o (Smart / High quality)</option>
                  <option value="claude-3-5-sonnet">claude-3-5-sonnet (Highly precise)</option>
                  <option value="claude-3-haiku">claude-3-haiku</option>
                  <option value="ollama/llama3">ollama/llama3 (Local default)</option>
                </select>
              </div>

              {/* Prompt version */}
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Prompt Version / Config Tag</label>
                <input
                  type="text"
                  placeholder="e.g. v1.2-rag-baseline"
                  value={promptVersion}
                  onChange={(e) => setPromptVersion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white focus:border-slate-700 outline-none text-sm"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4 border-t border-slate-800/60 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-md transition-all text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md transition-all text-sm font-semibold flex items-center gap-1"
                >
                  {isSubmitting ? 'Submitting...' : 'Run Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
