import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Auth.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [ready, setReady]         = useState(false);   // true once Supabase parses the token
  const [tokenError, setTokenError] = useState(false); // link was bad or expired

  // Supabase sends the user to /auth/reset-password#access_token=...
  // The auth listener fires a PASSWORD_RECOVERY event when ready.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // If no event fires within 3s the link is probably stale
    const timer = setTimeout(() => {
      setReady(prev => {
        if (!prev) setTokenError(true);
        return prev;
      });
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (password !== confirm) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    setError('');

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      navigate('/login?message=Password updated — sign in with your new password');
    }
  };

  // Link expired or invalid
  if (tokenError) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>link expired</h1>
          <div className="reset-expired">
            <p>This reset link has expired or is invalid. Reset links are valid for one hour.</p>
            <a href="/forgot-password" className="submit-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '1.5rem' }}>
              request a new link
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for Supabase to process the token
  if (!ready) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>verifying reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>new password</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>new password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="at least 6 characters"
              required
              autoFocus
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label>confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="same again"
              required
              autoComplete="new-password"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading || !password || !confirm} className="submit-btn">
            {loading ? 'updating…' : 'update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
