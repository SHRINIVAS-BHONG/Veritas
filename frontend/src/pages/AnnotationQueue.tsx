import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { EvaluationRun, EvaluationResult, Annotation } from '../types';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';

interface AnnotationQueueProps {
  runId: number;
  onBack: () => void;
}

export const AnnotationQueue: React.FC<AnnotationQueueProps> = ({ runId, onBack }) => {
  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Annotation form fields state
  const [faithfulnessUser, setFaithfulnessUser] = useState<number>(1.0);
  const [relevanceUser, setRelevanceUser] = useState<number>(1.0);
  const [contextRecallUser, setContextRecallUser] = useState<number>(1.0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const runData = await api.getRun(runId);
      const annData = await api.getRunAnnotations(runId);
      setRun(runData);
      setAnnotations(annData);
      
      // Seed first card annotation if it exists
      if (runData.results && runData.results.length > 0) {
        const firstResult = runData.results[0];
        const existingAnn = annData.find(a => a.result_id === firstResult.id);
        
        if (existingAnn) {
          setFaithfulnessUser(existingAnn.faithfulness_user ?? 1.0);
          setRelevanceUser(existingAnn.relevance_user ?? 1.0);
          setContextRecallUser(existingAnn.context_recall_user ?? 1.0);
          setNotes(existingAnn.notes ?? '');
        } else {
          // Default to SUT scores
          setFaithfulnessUser(firstResult.faithfulness ?? 1.0);
          setRelevanceUser(firstResult.relevance ?? 1.0);
          setContextRecallUser(firstResult.context_recall ?? 1.0);
          setNotes('');
        }
      }
    } catch (err) {
      console.error('Error loading annotation queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [runId]);

  const activeResult: EvaluationResult | undefined = run?.results?.[currentIndex];

  // When changing card index, load the existing annotation values or defaults
  const handleNavigate = (newIndex: number) => {
    if (!run?.results || newIndex < 0 || newIndex >= run.results.length) return;
    
    setStatusMessage(null);
    setCurrentIndex(newIndex);
    const nextResult = run.results[newIndex];
    const existingAnn = annotations.find(a => a.result_id === nextResult.id);
    
    if (existingAnn) {
      setFaithfulnessUser(existingAnn.faithfulness_user ?? 1.0);
      setRelevanceUser(existingAnn.relevance_user ?? 1.0);
      setContextRecallUser(existingAnn.context_recall_user ?? 1.0);
      setNotes(existingAnn.notes ?? '');
    } else {
      setFaithfulnessUser(nextResult.faithfulness ?? 1.0);
      setRelevanceUser(nextResult.relevance ?? 1.0);
      setContextRecallUser(nextResult.context_recall ?? 1.0);
      setNotes('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeResult || !run) return;
    
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const ann = await api.submitAnnotation({
        result_id: activeResult.id,
        run_id: run.id,
        annotator_name: "human_reviewer",
        faithfulness_user: faithfulnessUser,
        relevance_user: relevanceUser,
        context_recall_user: contextRecallUser,
        notes: notes.trim() || null
      });
      
      // Update annotations state
      const updated = [...annotations].filter(a => a.result_id !== activeResult.id);
      updated.push(ann);
      setAnnotations(updated);
      
      setStatusMessage({ type: 'success', text: 'Annotation saved successfully!' });
      
      // Auto-advance after short delay if not at end
      setTimeout(() => {
        if (currentIndex < (run.results.length - 1)) {
          handleNavigate(currentIndex + 1);
        }
      }, 800);
      
    } catch (err) {
      console.error('Error submitting annotation:', err);
      setStatusMessage({ type: 'error', text: 'Failed to save annotation.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading Annotation Queue...</div>;
  }

  if (!run || !activeResult) {
    return (
      <div className="p-12 text-center text-slate-500">
        Failed to load evaluation run.
      </div>
    );
  }

  const totalResults = run.results?.length || 0;
  const reviewedCount = annotations.length;
  const isReviewed = annotations.some(a => a.result_id === activeResult.id);

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto text-slate-100 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-md transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Annotation Queue</h1>
            <p className="text-sm text-slate-400">Reviewing: {run.name}</p>
          </div>
        </div>
        
        {/* Progress Badge */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono">
          <span className="text-slate-500">Reviewed</span>
          <span className="text-emerald-400 font-bold">{reviewedCount}</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-300">{totalResults}</span>
        </div>
      </div>

      {/* Main Review Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Test case contexts */}
        <div className="md:col-span-2 space-y-4">
          {/* Question & Expected Ans */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Question</span>
              <h3 className="text-base font-semibold text-white mt-1">{activeResult.test_case_id}. Question details</h3>
              <p className="text-slate-200 mt-2 bg-slate-950 p-3 rounded font-mono border border-slate-900">
                {run.results[currentIndex]?.generated_answer ? "Query triggered from database case" : "N/A"}
              </p>
            </div>
            
            <div className="border-t border-slate-800/60 pt-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Golden Expected Answer</span>
              <p className="text-slate-300 mt-1 text-sm bg-slate-950/60 p-3 rounded border border-slate-900/40">
                Check expected answers inside comparison views.
              </p>
            </div>
          </div>

          {/* SUT Generated Answer */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest block">Generated Response (SUT)</span>
            <div className="text-sm text-slate-100 bg-slate-950 p-4 rounded mt-2 border border-slate-900 whitespace-pre-wrap font-sans min-h-[140px]">
              {activeResult.generated_answer}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs font-mono text-slate-500 justify-end">
              <span>Latency: {activeResult.latency_seconds?.toFixed(3)}s</span>
              <span>Cost: ${activeResult.cost_usd.toFixed(5)}</span>
            </div>
          </div>

          {/* Retrieved Context Chunks */}
          {activeResult.retrieved_context && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Retrieved Source Context</span>
              <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded mt-2 max-h-48 overflow-y-auto border border-slate-900 font-mono">
                {activeResult.retrieved_context}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Column: Human Rating & Submission Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-lg sticky top-24">
          <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Human Evaluation</span>
            {isReviewed && (
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-900/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                Reviewed
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Judge Scores Comparison Panel */}
            <div className="bg-slate-950/80 border border-slate-850 p-3 rounded space-y-2 text-xs font-mono">
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">AI Judge reference scores</span>
              <div className="flex justify-between">
                <span className="text-slate-400">Faithfulness:</span>
                <span className="text-emerald-400 font-bold">{(activeResult.faithfulness ?? 0) * 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Relevance:</span>
                <span className="text-sky-400 font-bold">{(activeResult.relevance ?? 0) * 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recall:</span>
                <span className="text-indigo-400 font-bold">{(activeResult.context_recall ?? 0) * 100}%</span>
              </div>
            </div>

            {/* Form Faithfulness score slider */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-450 mb-1">
                <span className="text-slate-400">Groundedness (Faithful)</span>
                <span className="text-emerald-400 font-mono font-bold">{(faithfulnessUser * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="1.0" // Binary toggle (0 or 1) makes manual calibration super simple
                value={faithfulnessUser}
                onChange={(e) => setFaithfulnessUser(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-950 border border-slate-850 rounded h-2 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-650 mt-1">
                <span>0 (Unfaithful)</span>
                <span>1 (Grounded)</span>
              </div>
            </div>

            {/* Form Relevance score slider */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-450 mb-1">
                <span className="text-slate-400">Answer Relevance</span>
                <span className="text-sky-400 font-mono font-bold">{(relevanceUser * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="1.0"
                value={relevanceUser}
                onChange={(e) => setRelevanceUser(Number(e.target.value))}
                className="w-full accent-sky-500 bg-slate-950 border border-slate-850 rounded h-2 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-650 mt-1">
                <span>0 (Irrelevant)</span>
                <span>1 (Relevant)</span>
              </div>
            </div>

            {/* Form Context Recall slider */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-450 mb-1">
                <span className="text-slate-400">Context Recall</span>
                <span className="text-indigo-400 font-mono font-bold">{(contextRecallUser * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="1.0"
                value={contextRecallUser}
                onChange={(e) => setContextRecallUser(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-950 border border-slate-850 rounded h-2 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-650 mt-1">
                <span>0 (Incomplete)</span>
                <span>1 (Complete)</span>
              </div>
            </div>

            {/* Feedback Notes */}
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Feedback Notes</label>
              <textarea
                rows={3}
                placeholder="Write specific notes on factuality, hallucination errors, or user instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-md p-2.5 text-xs text-slate-200 focus:border-slate-700 outline-none resize-none placeholder-slate-700"
              />
            </div>

            {/* Save Rating */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-55 text-white font-semibold rounded transition-all text-xs tracking-wider uppercase flex items-center justify-center gap-1 shadow-md shadow-blue-600/10"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Annotation'}
            </button>

            {/* Status Message */}
            {statusMessage && (
              <div className={`p-2.5 rounded text-xs flex items-center gap-1.5 ${
                statusMessage.type === 'success' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/40 text-red-400 border border-red-900/50'
              }`}>
                {statusMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {statusMessage.text}
              </div>
            )}
          </form>

          {/* Navigation Footer */}
          <div className="bg-slate-950/40 border-t border-slate-800 p-4 flex justify-between items-center text-xs">
            <button
              onClick={() => handleNavigate(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="font-mono text-slate-500">
              Card {currentIndex + 1} of {totalResults}
            </span>
            <button
              onClick={() => handleNavigate(currentIndex + 1)}
              disabled={currentIndex === totalResults - 1}
              className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
