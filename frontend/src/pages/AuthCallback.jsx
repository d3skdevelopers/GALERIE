import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './AuthCallback.css';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from the URL
        const hash = window.location.hash;
        const query = window.location.search;
        
        console.log('Auth callback - hash:', hash);
        console.log('Auth callback - query:', query);

        // Check for error in URL
        if (query.includes('error=')) {
          const errorMsg = query.match(/error_description=([^&]*)/);
          if (errorMsg) {
            setStatus('error');
            setTimeout(() => {
              window.location.href = 'https://galerie-eight.vercel.app/login?error=' + encodeURIComponent(decodeURIComponent(errorMsg[1]));
            }, 3000);
            return;
          }
        }
        
        // Let Supabase handle the hash if it contains access_token
        if (hash && hash.includes('access_token')) {
          setStatus('verifying');
          
          // Process the OAuth callback
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Auth error:', error);
            setStatus('error');
            setTimeout(() => {
              window.location.href = 'https://galerie-eight.vercel.app/login?error=Verification failed';
            }, 3000);
          } else if (data.session) {
            setStatus('success');
            setTimeout(() => {
              window.location.href = 'https://galerie-eight.vercel.app/';
            }, 1500);
          }
        } else {
          // Check if we already have a session
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setStatus('success');
            setTimeout(() => {
              window.location.href = 'https://galerie-eight.vercel.app/';
            }, 1500);
          } else {
            // No session and no hash, probably not a callback
            setStatus('error');
            setTimeout(() => {
              window.location.href = 'https://galerie-eight.vercel.app/login';
            }, 3000);
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setStatus('error');
        setTimeout(() => {
          window.location.href = 'https://galerie-eight.vercel.app/login';
        }, 3000);
      }
    };
    
    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="auth-callback">
      {status === 'verifying' && (
        <>
          <div className="spinner">✦</div>
          <p>Verifying your email...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="success-icon">✓</div>
          <p>Email verified! Redirecting...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="error-icon">✗</div>
          <p>Verification failed. Redirecting to login...</p>
        </>
      )}
    </div>
  );
}