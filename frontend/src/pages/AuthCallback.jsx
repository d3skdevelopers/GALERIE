import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './AuthCallback.css';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth error:', error);
        navigate('/login?error=Could not verify email');
      } else if (data.session) {
        // Successfully verified
        navigate('/');
      } else {
        // No session yet, wait for the hash to be processed
        setTimeout(() => {
          navigate('/login?error=Verification timeout');
        }, 5000);
      }
    };
    
    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="auth-callback">
      <div className="spinner">✦</div>
      <p>Verifying your email...</p>
    </div>
  );
}