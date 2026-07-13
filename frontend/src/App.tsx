import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { RunDetail } from './pages/RunDetail';
import { AnnotationQueue } from './pages/AnnotationQueue';
import { Activity, BookOpen } from 'lucide-react';

type ViewState = 'dashboard' | 'detail' | 'compare' | 'annotation-queue';

function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [runAId, setRunAId] = useState<number | null>(null);
  const [runBId, setRunBId] = useState<number | null>(null);

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

  const handleBackToDashboard = () => {
    setView('dashboard');
    setRunAId(null);
    setRunBId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={handleBackToDashboard}>
            <div className="bg-blue-600 p-2 rounded-md shadow-md shadow-blue-500/20 text-white flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-white tracking-wider">VERITAS</span>
              <span className="text-[10px] text-blue-500 font-bold block leading-none font-mono uppercase tracking-widest">OBSERVABILITY</span>
            </div>
          </div>
          <nav className="flex items-center space-x-6 text-sm font-semibold text-slate-400">
            <button 
              onClick={handleBackToDashboard}
              className={`hover:text-white transition-colors ${view === 'dashboard' ? 'text-white border-b-2 border-blue-500 py-5' : ''}`}
            >
              Evaluation Runs
            </button>
            <a 
              href="http://127.0.0.1:8000/docs" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="w-4 h-4" /> Docs
            </a>
          </nav>
        </div>
      </header>

      {/* Main Body Content */}
      <main className="flex-1 pb-16">
        {view === 'dashboard' && (
          <Dashboard 
            onCompare={handleCompare} 
            onViewDetails={handleViewDetails} 
          />
        )}
        {(view === 'detail' || view === 'compare') && runAId !== null && (
          <RunDetail 
            runAId={runAId} 
            runBId={runBId || undefined} 
            onBack={handleBackToDashboard} 
            onOpenAnnotationQueue={handleOpenAnnotationQueue}
          />
        )}
        {view === 'annotation-queue' && runAId !== null && (
          <AnnotationQueue
            runId={runAId}
            onBack={() => handleViewDetails(runAId)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
