import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './AuthCallback.css';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    const handle = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setStatus('error');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setStatus('success');
        setTimeout(() => navigate('/'), 1200);
      }
    };
    handle();
  }, [navigate]);

  return (
    <div className="auth-callback">
      {status === 'verifying' && <><div className="cb-spin">✦</div><p>Verifying…</p></>}
      {status === 'success' && <><div className="cb-ok">✓</div><p>Verified! Redirecting…</p></>}
      {status === 'error' && <><div className="cb-err">✗</div><p>Verification failed. Redirecting…</p></>}
    </div>
  );
}
