import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>forgot password</h1>

        {sent ? (
          <div className="forgot-sent">
            <div className="sent-icon">✦</div>
            <p className="sent-heading">check your inbox</p>
            <p className="sent-body">
              We've sent a reset link to <strong>{email}</strong>.
              It expires in one hour.
            </p>
            <p className="sent-note">
              Didn't receive it? Check your spam folder, or{' '}
              <button
                className="resend-btn"
                onClick={() => { setSent(false); setEmail(''); }}
              >
                try a different address
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <p className="forgot-desc">
              Enter the email address for your account and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" disabled={loading || !email} className="submit-btn">
                {loading ? 'sending…' : 'send reset link'}
              </button>
            </form>
          </>
        )}

        <p className="auth-redirect">
          remembered it? <Link to="/login">sign in</Link>
        </p>
      </div>
    </div>
  );
}
