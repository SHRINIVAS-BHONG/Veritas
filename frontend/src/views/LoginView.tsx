import React from 'react';

const LoginView: React.FC = () => {
  const handleLogin = () => {
    // Redirect to the backend OAuth endpoint
    window.location.href = 'http://localhost:8000/api/v1/auth/login/github';
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px', marginTop: '10vh' }}>
      <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.75rem', fontWeight: 600 }}>Welcome Back</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
          Sign in to access the Real-Time LLM Application Evaluation Platform.
        </p>
        
        <button className="btn btn-github" onClick={handleLogin} style={{ width: '100%' }}>
          Continue with GitHub
        </button>
      </div>
    </div>
  );
};

export default LoginView;
