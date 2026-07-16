import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Play } from 'lucide-react';

const DashboardView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [githubUrl, setGithubUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [attackType, setAttackType] = useState('prompt_injection');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Store token if it exists in URL
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('veritas_token', token);
      // Clean URL
      window.history.replaceState({}, document.title, '/dashboard');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const token = localStorage.getItem('veritas_token');
    if (!token) {
      setError('Not authenticated. Please login again.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/v1/evaluations/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          github_repo_url: githubUrl,
          target_app_url: targetUrl,
          attack_type: attackType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start evaluation');
      }

      const data = await response.json();
      if (data.evaluation_task_id) {
        navigate(`/evaluation/${data.evaluation_task_id}`);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '600px', marginTop: '5vh' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: 'var(--accent-color)' }}>
          <Shield size={32} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>New Evaluation</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Configure target LLM application for testing.</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="githubUrl">GitHub Repository URL (Optional)</label>
            <input 
              id="githubUrl"
              type="text" 
              className="input-field" 
              placeholder="https://github.com/user/repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="targetUrl">Live Target App URL</label>
            <input 
              id="targetUrl"
              type="url" 
              className="input-field" 
              placeholder="https://yourapp.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="attackType">Adversarial Attack Vector</label>
            <select 
              id="attackType"
              className="input-field"
              value={attackType}
              onChange={(e) => setAttackType(e.target.value)}
              style={{ appearance: 'none' }}
            >
              <option value="prompt_injection" style={{ color: '#000' }}>Prompt Injection</option>
              <option value="data_leakage" style={{ color: '#000' }}>Data / Memory Leakage</option>
              <option value="jailbreak" style={{ color: '#000' }}>System Prompt Jailbreak</option>
            </select>
          </div>

          <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Starting...' : (
                <>
                  <Play size={18} />
                  Run Evaluation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DashboardView;
