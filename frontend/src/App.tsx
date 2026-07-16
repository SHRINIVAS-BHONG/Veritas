import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import EvaluationView from './views/EvaluationView';
import HistoryView from './views/HistoryView';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.05em' }}>
            VERITAS<span style={{ color: 'var(--accent-color)' }}>.AI</span>
          </h1>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            <a href="/dashboard" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>History</a>
            <a href="/new" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>New Scan</a>
          </nav>
        </header>
        
        <main style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginView />} />
            <Route path="/dashboard" element={<HistoryView />} />
            <Route path="/new" element={<DashboardView />} />
            <Route path="/evaluation/:taskId" element={<EvaluationView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
