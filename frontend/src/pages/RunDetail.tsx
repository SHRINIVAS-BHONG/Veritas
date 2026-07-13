import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { EvaluationRun, RunComparison } from '../types';
import { ArrowLeft, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp, Search } from 'lucide-react';

interface RunDetailProps {
  runAId: number;
  runBId?: number; // Optional comparison run ID
  onBack: () => void;
}

export const RunDetail: React.FC<RunDetailProps> = ({ runAId, runBId, onBack }) => {
  const [singleRun, setSingleRun] = useState<EvaluationRun | null>(null);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [loading, setLoading] = useState(true);
  
  // UI filter states
  const [showRegressionsOnly, setShowRegressionsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedResultId, setExpandedResultId] = useState<number | null>(null);
  
  // Judge Trace Modal State
  const [activeTrace, setActiveTrace] = useState<{ title: string; content: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (runBId) {
        const compData = await api.compareRuns(runAId, runBId);
        setComparison(compData);
      } else {
        const runData = await api.getRun(runAId);
        setSingleRun(runData);
      }
    } catch (err) {
      console.error('Error loading run details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [runAId, runBId]);

  const getScoreColorClass = (score: number | undefined) => {
    if (score === undefined || score === null) return 'text-slate-500';
    if (score >= 0.8) return 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50';
    if (score >= 0.5) return 'bg-amber-950/40 text-amber-400 border border-amber-900/50';
    return 'bg-red-950/40 text-red-400 border border-red-900/50';
  };

  const getScoreLabel = (score: number | undefined) => {
    if (score === undefined || score === null) return '-';
    return `${(score * 100).toFixed(0)}%`;
  };

  // Render comparative run view
  if (runBId && comparison) {
    const { run_a, run_b, comparison: items } = comparison;
    
    // Filter comparison items
    const filteredItems = items.filter(item => {
      // 1. Search Query filter
      const matchesSearch = 
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.run_a?.generated_answer?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (item.run_b?.generated_answer?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
        
      // 2. Regressions Only filter: check if B scored worse than A in F1 (or other metric)
      const isRegression = (item.f1_diff ?? 0) < -0.05;
      
      if (showRegressionsOnly) {
        return matchesSearch && isRegression;
      }
      return matchesSearch;
    });

    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-100">
        {/* Breadcrumb Header */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-md transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Compare Runs</h1>
            <p className="text-sm text-slate-400">Comparing Run A ({run_a.name}) and Run B ({run_b.name})</p>
          </div>
        </div>

        {/* Comparison Meta Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Run A Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider bg-slate-950 px-2 py-0.5 rounded">Run A (Baseline)</span>
            <h3 className="text-xl font-bold text-white mt-2 truncate">{run_a.name}</h3>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm font-mono border-t border-slate-850 pt-3">
              <div>
                <span className="text-slate-500 text-xs block">Model</span>
                <span className="text-slate-200">{run_a.model}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Version</span>
                <span className="text-slate-200">{run_a.prompt_version}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Pass Rate</span>
                <span className="text-emerald-400 font-semibold">{((run_a.pass_rate || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Run B Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider bg-slate-950 px-2 py-0.5 rounded">Run B (Candidate)</span>
            <h3 className="text-xl font-bold text-white mt-2 truncate">{run_b.name}</h3>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm font-mono border-t border-slate-850 pt-3">
              <div>
                <span className="text-slate-500 text-xs block">Model</span>
                <span className="text-slate-200">{run_b.model}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Version</span>
                <span className="text-slate-200">{run_b.prompt_version}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Pass Rate</span>
                <span className={`font-semibold ${
                  (run_b.pass_rate || 0) > (run_a.pass_rate || 0) ? 'text-emerald-400' :
                  (run_b.pass_rate || 0) < (run_a.pass_rate || 0) ? 'text-red-400' : 'text-slate-200'
                }`}>
                  {((run_b.pass_rate || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter test cases by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-md py-2 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:border-slate-700 outline-none"
            />
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowRegressionsOnly(!showRegressionsOnly)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                showRegressionsOnly 
                  ? 'bg-red-950/40 border-red-900/60 text-red-400' 
                  : 'border-slate-800 text-slate-400 hover:text-white bg-slate-950/65'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Show Regressions Only
            </button>
            <span className="text-xs text-slate-500">
              Showing {filteredItems.length} of {items.length} test cases
            </span>
          </div>
        </div>

        {/* Comparison Table List */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-12 text-center text-slate-500 rounded-lg">
              No test cases matched the filters.
            </div>
          ) : (
            filteredItems.map(item => {
              const isExpanded = expandedResultId === item.test_case_id;
              const hasRegression = (item.f1_diff ?? 0) < 0;
              
              return (
                <div 
                  key={item.test_case_id}
                  className={`bg-slate-900 border rounded-lg overflow-hidden transition-all duration-150 ${
                    hasRegression ? 'border-red-900/40 bg-red-950/5' : 'border-slate-800'
                  }`}
                >
                  {/* Row Header */}
                  <div 
                    onClick={() => setExpandedResultId(isExpanded ? null : item.test_case_id)}
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-850/20"
                  >
                    <div className="flex items-start space-x-3 pr-4 max-w-3xl">
                      {hasRegression ? (
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h4 className="text-sm font-semibold text-white">{item.question}</h4>
                        {isExpanded && (
                          <div className="text-xs text-slate-500 mt-1 max-w-2xl bg-slate-950/60 p-2 rounded border border-slate-900">
                            <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px] mb-1">Expected Gold Answer:</span>
                            {item.expected_answer}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Aligned quick scores */}
                    <div className="flex items-center space-x-4 shrink-0 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block text-right uppercase">Delta</span>
                        <span className={`font-bold ${
                          (item.f1_diff ?? 0) > 0 ? 'text-emerald-400' :
                          (item.f1_diff ?? 0) < 0 ? 'text-red-400' : 'text-slate-400'
                        }`}>
                          {item.f1_diff ? `${item.f1_diff > 0 ? '+' : ''}${(item.f1_diff * 100).toFixed(0)}%` : '0%'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block uppercase">F1 A / B</span>
                        <span className="text-slate-300">
                          {getScoreLabel(item.run_a?.f1_score)} / {getScoreLabel(item.run_b?.f1_score)}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>

                  {/* Expanded comparative columns */}
                  {isExpanded && (
                    <div className="border-t border-slate-850 bg-slate-950/30 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-850">
                      {/* Column A (Baseline) */}
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-900 px-1.5 py-0.5 rounded">Run A (Baseline)</span>
                          {item.run_a?.f1_score && (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getScoreColorClass(item.run_a.f1_score)}`}>
                              F1: {getScoreLabel(item.run_a.f1_score)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded font-mono whitespace-pre-wrap min-h-[80px]">
                          {item.run_a?.generated_answer || 'No generated answer.'}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                          <div className="bg-slate-900/50 p-1.5 rounded">
                            <span className="text-slate-500 block">ROUGE-L</span>
                            <span className="text-slate-300 font-semibold">{getScoreLabel(item.run_a?.rouge_l)}</span>
                          </div>
                          <div className="bg-slate-900/50 p-1.5 rounded">
                            <span className="text-slate-500 block">Exact Match</span>
                            <span className="text-slate-300 font-semibold">{getScoreLabel(item.run_a?.exact_match)}</span>
                          </div>
                          <div className="bg-slate-900/50 p-1.5 rounded">
                            <span className="text-slate-500 block">Latency</span>
                            <span className="text-slate-300 font-semibold">{item.run_a?.latency_seconds?.toFixed(3)}s</span>
                          </div>
                        </div>
                      </div>

                      {/* Column B (Candidate) */}
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-900 px-1.5 py-0.5 rounded">Run B (Candidate)</span>
                          {item.run_b?.f1_score && (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getScoreColorClass(item.run_b.f1_score)}`}>
                              F1: {getScoreLabel(item.run_b.f1_score)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded font-mono whitespace-pre-wrap min-h-[80px]">
                          {item.run_b?.generated_answer || 'No generated answer.'}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                          <div className="bg-slate-900/50 p-1.5 rounded">
                            <span className="text-slate-500 block">ROUGE-L</span>
                            <span className="text-slate-300 font-semibold">{getScoreLabel(item.run_b?.rouge_l)}</span>
                          </div>
                          <div className="bg-slate-900/50 p-1.5 rounded">
                            <span className="text-slate-500 block">Exact Match</span>
                            <span className="text-slate-300 font-semibold">{getScoreLabel(item.run_b?.exact_match)}</span>
                          </div>
                          <div className="bg-slate-900/50 p-1.5 rounded">
                            <span className="text-slate-500 block">Latency</span>
                            <span className="text-slate-300 font-semibold">{item.run_b?.latency_seconds?.toFixed(3)}s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Render single evaluation run view
  if (singleRun) {
    const results = singleRun.results || [];
    
    // Filter results
    const filteredResults = results.filter(r => {
      const matchesSearch = 
        r.generated_answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(r.test_case_id).includes(searchQuery);
      return matchesSearch;
    });

    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-100 animate-in fade-in duration-200">
        {/* Breadcrumb Header */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-md transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Evaluation Details</h1>
            <p className="text-sm text-slate-400">Run: {singleRun.name}</p>
          </div>
        </div>

        {/* Aggregate Stats Summary Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Aggregate Scores</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 mt-4 border-t border-slate-800/60 pt-4 text-center font-mono">
            <div>
              <span className="text-slate-500 text-xs block">Pass Rate</span>
              <span className="text-lg font-bold text-white">{((singleRun.pass_rate || 0) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block">Faithfulness</span>
              <span className="text-lg font-bold text-emerald-400">{((singleRun.avg_faithfulness || 0) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block">Relevance</span>
              <span className="text-lg font-bold text-sky-400">{((singleRun.avg_relevance || 0) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block">Context Recall</span>
              <span className="text-lg font-bold text-indigo-400">{((singleRun.avg_context_recall || 0) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block">Avg Latency</span>
              <span className="text-lg font-bold text-slate-200">{(singleRun.avg_latency || 0).toFixed(3)}s</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block">Total Cost</span>
              <span className="text-lg font-bold text-slate-200">${(singleRun.total_cost || 0).toFixed(5)}</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search response answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-md py-2 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:border-slate-700 outline-none"
            />
          </div>
          <div className="text-xs text-slate-500">
            Showing {filteredResults.length} of {results.length} test outcomes
          </div>
        </div>

        {/* Single Run Results list */}
        <div className="space-y-4">
          {filteredResults.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-12 text-center text-slate-500 rounded-lg">
              No results found matching search parameters.
            </div>
          ) : (
            filteredResults.map(r => {
              const isExpanded = expandedResultId === r.id;
              
              return (
                <div 
                  key={r.id} 
                  className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden transition-all"
                >
                  {/* Result Item Header Row */}
                  <div 
                    onClick={() => setExpandedResultId(isExpanded ? null : r.id)}
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-850/20"
                  >
                    <div className="flex items-start space-x-3 pr-4 max-w-3xl">
                      <span className="text-xs font-semibold text-slate-500 bg-slate-950 px-2 py-0.5 rounded mt-0.5">
                        TC {r.test_case_id}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-white truncate max-w-xl">
                          {r.generated_answer.substring(0, 120)}...
                        </h4>
                      </div>
                    </div>

                    {/* Scores badge display */}
                    <div className="flex items-center space-x-3 shrink-0 font-mono text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getScoreColorClass(r.f1_score)}`}>
                        F1: {getScoreLabel(r.f1_score)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getScoreColorClass(r.faithfulness)}`}>
                        Faith: {getScoreLabel(r.faithfulness)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getScoreColorClass(r.relevance)}`}>
                        Relev: {getScoreLabel(r.relevance)}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-850 bg-slate-950/20 p-5 space-y-4">
                      {/* Generated Answer */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Generated Response</span>
                        <div className="text-sm text-slate-350 bg-slate-950 p-3 rounded whitespace-pre-wrap font-sans">
                          {r.generated_answer}
                        </div>
                      </div>

                      {/* Retrieved Context Chunks */}
                      {r.retrieved_context && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Retrieved Reference Context</span>
                          <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-900">
                            {r.retrieved_context}
                          </div>
                        </div>
                      )}

                      {/* Detail scores grid with Reasoning Trace Popups */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* F1 */}
                        <div className="bg-slate-900 p-3 rounded text-center border border-slate-850">
                          <span className="text-[10px] text-slate-500 block uppercase font-mono">F1-Score</span>
                          <span className="text-sm font-bold text-slate-200 mt-1 block">{getScoreLabel(r.f1_score)}</span>
                        </div>
                        {/* ROUGE-L */}
                        <div className="bg-slate-900 p-3 rounded text-center border border-slate-850">
                          <span className="text-[10px] text-slate-500 block uppercase font-mono">ROUGE-L</span>
                          <span className="text-sm font-bold text-slate-200 mt-1 block">{getScoreLabel(r.rouge_l)}</span>
                        </div>
                        {/* Faithfulness with Trace */}
                        <div className="bg-slate-900 p-3 rounded text-center border border-slate-850 flex flex-col justify-between items-center">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">Faithfulness</span>
                            <span className="text-sm font-bold text-emerald-400 mt-1 block">{getScoreLabel(r.faithfulness)}</span>
                          </div>
                          {r.faithfulness_reasoning && (
                            <button
                              onClick={() => setActiveTrace({ title: 'Faithfulness reasoning trace', content: r.faithfulness_reasoning || '' })}
                              className="text-[10px] text-blue-400 hover:underline mt-2 font-semibold flex items-center gap-1 font-mono"
                            >
                              <Info className="w-3 h-3" /> View Trace
                            </button>
                          )}
                        </div>
                        {/* Relevance with Trace */}
                        <div className="bg-slate-900 p-3 rounded text-center border border-slate-850 flex flex-col justify-between items-center">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">Relevance</span>
                            <span className="text-sm font-bold text-sky-400 mt-1 block">{getScoreLabel(r.relevance)}</span>
                          </div>
                          {r.relevance_reasoning && (
                            <button
                              onClick={() => setActiveTrace({ title: 'Answer relevance reasoning trace', content: r.relevance_reasoning || '' })}
                              className="text-[10px] text-blue-400 hover:underline mt-2 font-semibold flex items-center gap-1 font-mono"
                            >
                              <Info className="w-3 h-3" /> View Trace
                            </button>
                          )}
                        </div>
                        {/* Context Recall with Trace */}
                        <div className="bg-slate-900 p-3 rounded text-center border border-slate-850 flex flex-col justify-between items-center">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">Context Recall</span>
                            <span className="text-sm font-bold text-indigo-400 mt-1 block">{getScoreLabel(r.context_recall)}</span>
                          </div>
                          {r.context_recall_reasoning && (
                            <button
                              onClick={() => setActiveTrace({ title: 'Context recall reasoning trace', content: r.context_recall_reasoning || '' })}
                              className="text-[10px] text-blue-400 hover:underline mt-2 font-semibold flex items-center gap-1 font-mono"
                            >
                              <Info className="w-3 h-3" /> View Trace
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Reasoning Trace Overlay Modal */}
        {activeTrace && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <h4 className="text-lg font-bold text-white capitalize flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-500" />
                  {activeTrace.title}
                </h4>
                <button
                  onClick={() => setActiveTrace(null)}
                  className="text-slate-400 hover:text-white transition-colors font-bold text-sm"
                >
                  Close
                </button>
              </div>
              <div className="p-6 bg-slate-950/60 max-h-96 overflow-y-auto">
                <pre className="text-xs text-slate-350 font-mono whitespace-pre-wrap leading-relaxed">
                  {activeTrace.content}
                </pre>
              </div>
              <div className="p-4 border-t border-slate-850 flex justify-end bg-slate-900">
                <button
                  onClick={() => setActiveTrace(null)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold transition-all shadow-md"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-12 text-center text-slate-500">
      {loading ? 'Loading details...' : 'Failed to retrieve evaluation run.'}
    </div>
  );
};
