import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ExternalLink, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface HistoryItem {
  id: number;
  task_id: string;
  target_url: string;
  attack_type: string;
  status: string;
  created_at: string;
}

const HistoryView: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('veritas_token');
      if (!token) {
        setError('Not authenticated. Please login again.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:8000/api/v1/evaluations/history', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch evaluation history');
        }

        const data = await response.json();
        setHistory(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
    const intervalId = setInterval(fetchHistory, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'vulnerable':
        return <ShieldAlert size={18} color="var(--danger)" />;
      case 'failed':
      case 'safe':
        return <ShieldCheck size={18} color="var(--success)" />;
      case 'error':
        return <AlertTriangle size={18} color="#eab308" />;
      default:
        return <Clock size={18} color="var(--text-secondary)" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return 'Vulnerable';
      case 'failed': return 'Secure';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '900px', marginTop: '2vh' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: 'var(--accent-color)' }}>
            <Clock size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>Evaluation History</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Review past security assessments and reports.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/new')}>
          Run New Scan
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', minHeight: '50vh' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading history...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px' }}>
            {error}
          </div>
        ) : history.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            <Clock size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No evaluations found.</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Run a new scan to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Target</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Attack Vector</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Date</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '1rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.target_url}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.875rem' }}>
                        {item.attack_type}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {getStatusIcon(item.status)}
                        <span style={{ 
                          color: item.status === 'success' || item.status === 'vulnerable' ? 'var(--danger)' : 
                                 item.status === 'failed' || item.status === 'safe' ? 'var(--success)' : 
                                 item.status === 'error' ? '#eab308' : 'var(--text-secondary)'
                        }}>
                          {getStatusText(item.status)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button 
                        onClick={() => navigate(`/evaluation/${item.task_id}`)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        View <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
