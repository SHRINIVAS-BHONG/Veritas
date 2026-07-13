import React from 'react';
import { 
  Activity, 
  LayoutDashboard, 
  Play, 
  GitCompare, 
  ListTodo, 
  Database, 
  Scale, 
  BarChart, 
  Settings, 
  Bell, 
  Search,
  BookOpen
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'evaluation-runs', label: 'Evaluation Runs', icon: Play },
    { id: 'compare', label: 'Compare Runs', icon: GitCompare },
    { id: 'annotation-queue', label: 'Annotation Queue', icon: ListTodo },
    { id: 'golden-dataset', label: 'Golden Dataset', icon: Database },
    { id: 'judge-calibration', label: 'Judge Calibration', icon: Scale },
    { id: 'analytics', label: 'Analytics', icon: BarChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-[#111827] flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="h-14 border-b border-[#E5E7EB] bg-white flex items-center justify-between px-6 z-20 sticky top-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <div className="bg-[#2563EB] text-white p-1.5 rounded flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">TrustBench</span>
          </div>
          
          <div className="hidden md:flex items-center bg-[#F8F9FB] border border-[#E5E7EB] rounded-md px-3 py-1.5 text-sm text-[#6B7280] w-64 focus-within:border-[#2563EB] focus-within:ring-1 focus-within:ring-[#2563EB] transition-all">
            <Search className="w-4 h-4 mr-2" />
            <input 
              type="text" 
              placeholder="Search runs, datasets..." 
              className="bg-transparent border-none outline-none w-full text-[#111827] placeholder:text-[#9CA3AF] text-xs"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-[#6B7280]">
          <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer" className="hover:text-[#111827] transition-colors" title="API Docs">
            <BookOpen className="w-5 h-5" />
          </a>
          <button className="hover:text-[#111827] transition-colors" title="Alerts">
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-7 h-7 rounded-full bg-[#E5E7EB] flex items-center justify-center text-xs font-medium text-[#111827] border border-[#D1D5DB]">
            U
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-56px)]">
        {/* Left Sidebar */}
        <aside className="w-60 border-r border-[#E5E7EB] bg-white flex flex-col overflow-y-auto">
          <nav className="flex-1 py-4 px-3 space-y-0.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id || (item.id === 'evaluation-runs' && currentView === 'detail');
              
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive 
                      ? 'bg-[#F3F4F6] text-[#111827] font-medium' 
                      : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#111827]' : 'text-[#9CA3AF]'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FB] relative">
          {children}
        </main>
      </div>
    </div>
  );
};
