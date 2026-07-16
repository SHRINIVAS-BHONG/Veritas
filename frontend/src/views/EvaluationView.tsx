import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const EvaluationView: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'connecting' | 'running' | 'completed' | 'failed'>('connecting');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    if (!taskId) return;
    
    // Check if the task is already completed by fetching the static report
    const fetchReport = async () => {
      try {
        const token = localStorage.getItem('veritas_token');
        const res = await fetch(`http://localhost:8000/api/v1/evaluations/report/${taskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed' || data.status === 'failed') {
            setStatus(data.status);
            setReport(data.report);
            addLog('System', `Loaded historical report for ${taskId}`, 'info');
            
            if (data.report) {
              addLog('Target', data.report.target_url, 'info');
              addLog('Attack Vector', data.report.attack_type, 'info');
              addLog('Result Status', data.report.status.toUpperCase(), data.report.status === 'failed' ? 'success' : 'error');
              addLog('Response', JSON.stringify(data.report.system_response, null, 2), 'info');
            }
            return true;
          }
        }
      } catch (e) {
        console.error("Failed to fetch report:", e);
      }
      return false;
    };

    fetchReport().then(isComplete => {
      // Only connect to WebSocket if the task is still running
      if (!isComplete) {
        const wsUrl = `ws://localhost:8000/api/v1/evaluations/ws/evaluation/${taskId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setStatus('running');
          addLog('System', 'Connected to real-time evaluation stream.', 'info');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.message) {
              addLog('System', data.message, data.level || 'info');
            }
            if (data.status === 'completed') {
              setStatus('completed');
              if (data.report) setReport(data.report);
              addLog('System', 'Evaluation completed successfully.', 'success');
            } else if (data.status === 'failed') {
              setStatus('failed');
              addLog('System', 'Evaluation failed.', 'error');
            }
          } catch (e) {
            addLog('Raw', event.data, 'info');
          }
        };

        ws.onclose = () => {
          setStatus(prev => prev === 'running' ? 'completed' : prev);
        };

        ws.onerror = () => {
          addLog('System', 'WebSocket connection error.', 'error');
          setStatus('failed');
        };

        return () => ws.close();
      }
    });
  }, [taskId]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (source: string, message: string, type: LogEntry['type']) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '900px', marginTop: '2vh' }}>
      <button 
        className="btn" 
        onClick={() => navigate('/dashboard')}
        style={{ padding: '0.5rem 1rem', marginBottom: '1.5rem', background: 'transparent', color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '70vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              Execution Console
              {status === 'running' && <Activity size={20} color="var(--accent-color)" className="animate-pulse" />}
              {status === 'completed' && <CheckCircle size={20} color="var(--success)" />}
              {status === 'failed' && <XCircle size={20} color="var(--danger)" />}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Task ID: {taskId}
            </p>
          </div>
          
          <div style={{ 
            padding: '0.5rem 1rem', 
            borderRadius: '999px', 
            fontSize: '0.875rem',
            fontWeight: 500,
            background: status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 
                        status === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 
                        'rgba(99, 102, 241, 0.1)',
            color: status === 'completed' ? 'var(--success)' : 
                   status === 'failed' ? 'var(--danger)' : 
                   'var(--accent-color)'
          }}>
            {status.toUpperCase()}
          </div>
        </div>

        <div className="terminal-console" style={{ flex: 1 }}>
          {logs.map((log) => (
            <div key={log.id} className="log-entry">
              <span style={{ color: '#546e7a', marginRight: '0.5rem' }}>[{log.timestamp}]</span>
              <span className={`log-${log.type}`}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );
};

export default EvaluationView;
