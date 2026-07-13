import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { RunDetail } from './pages/RunDetail';
import { AnnotationQueue } from './pages/AnnotationQueue';
import { Layout } from './components/Layout';
import { FileText } from 'lucide-react';

type ViewState = 'dashboard' | 'evaluation-runs' | 'compare' | 'annotation-queue' | 'golden-dataset' | 'judge-calibration' | 'analytics' | 'settings' | 'detail';

function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [runAId, setRunAId] = useState<number | null>(null);
  const [runBId, setRunBId] = useState<number | null>(null);

  const handleNavigate = (newView: string) => {
    setView(newView as ViewState);
    if (newView !== 'detail' && newView !== 'compare' && newView !== 'annotation-queue') {
      setRunAId(null);
      setRunBId(null);
    }
  };

  const handleCompare = (idA: number, idB: number) => {
    setRunAId(idA);
    setRunBId(idB);
    setView('compare');
  };

  const handleViewDetails = (id: number) => {
    setRunAId(id);
    setRunBId(null);
    setView('detail');
  };

  const handleOpenAnnotationQueue = (id: number) => {
    setRunAId(id);
    setView('annotation-queue');
  };

  const renderPlaceholder = (title: string) => (
    <div className="flex flex-col items-center justify-center h-full text-[#6B7280]">
      <FileText className="w-12 h-12 mb-4 text-[#D1D5DB]" />
      <h2 className="text-lg font-medium text-[#111827]">{title}</h2>
      <p className="text-sm mt-1">This module is coming soon.</p>
    </div>
  );

  return (
    <Layout currentView={view} onNavigate={handleNavigate}>
      {view === 'dashboard' && (
        <Dashboard 
          onCompare={handleCompare} 
          onViewDetails={handleViewDetails} 
        />
      )}
      {view === 'evaluation-runs' && (
        <Dashboard 
          onCompare={handleCompare} 
          onViewDetails={handleViewDetails} 
        />
      )}
      {(view === 'detail' || view === 'compare') && runAId !== null && (
        <RunDetail 
          runAId={runAId} 
          runBId={runBId || undefined} 
          onBack={() => handleNavigate('evaluation-runs')} 
          onOpenAnnotationQueue={handleOpenAnnotationQueue}
        />
      )}
      {view === 'annotation-queue' && runAId !== null && (
        <AnnotationQueue
          runId={runAId}
          onBack={() => handleViewDetails(runAId)}
        />
      )}
      
      {/* Empty Placeholders */}
      {view === 'annotation-queue' && runAId === null && renderPlaceholder('Annotation Queue (Global)')}
      {view === 'golden-dataset' && renderPlaceholder('Golden Dataset Management')}
      {view === 'judge-calibration' && renderPlaceholder('Judge Calibration')}
      {view === 'analytics' && renderPlaceholder('Analytics & Metrics')}
      {view === 'settings' && renderPlaceholder('Workspace Settings')}
    </Layout>
  );
}

export default App;
