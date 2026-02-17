import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './Navigation.css';

export default function Navigation({ session, setDarkMode, darkMode }) {
  const [username, setUsername] = useState('you');

  useEffect(() => {
    const fetchUsername = async () => {
      if (session?.user) {
        // First try to get from user_metadata
        if (session.user.user_metadata?.username) {
          setUsername(session.user.user_metadata.username);
        } else {
          // Otherwise fetch from profiles table
          const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .single();
          
          if (data?.username) {
            setUsername(data.username);
          }
        }
      }
    };

    fetchUsername();
  }, [session]);

  return (
    <nav className="nav">
      <div className="nav-left">
        <Link to="/" className="logo">GALERIE</Link>
        <span className="dot">·</span>
        <span className="current">the foyer</span>
      </div>
      <div className="nav-right">
        <Link to="/library">library</Link>
        <Link to="/search">search desk</Link>
        <Link to="/voting">voting</Link>
        {session ? (
          <Link to={`/artist/${username}`}>@{username}</Link>
        ) : (
          <>
            <Link to="/login">sign in</Link>
            <Link to="/signup">sign up</Link>
          </>
        )}
        <button 
          className="theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}