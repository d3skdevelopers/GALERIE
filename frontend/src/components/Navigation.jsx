import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './Navigation.css';

export default function Navigation({ session, setDarkMode, darkMode }) {
  const [username, setUsername] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (!session?.user) {
      setUsername('');
      return;
    }

    const fetchUsername = async () => {
      // Try metadata first (fastest)
      if (session.user.user_metadata?.username) {
        setUsername(session.user.user_metadata.username);
        return;
      }
      // Fall back to DB
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (data?.username) setUsername(data.username);
    };

    fetchUsername();
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
  };

  // Get current page name for nav display
  const getPageName = () => {
    const path = location.pathname;
    if (path === '/') return 'the foyer';
    if (path.startsWith('/room')) return 'gallery room';
    if (path.startsWith('/artwork')) return 'artwork focus';
    if (path.startsWith('/artist')) return 'artist profile';
    if (path === '/search') return 'search desk';
    if (path === '/voting') return 'voting chamber';
    if (path === '/library') return 'the library';
    if (path.startsWith('/article')) return 'reading room';
    if (path === '/write') return 'writing desk';
    if (path === '/upload') return 'submission';
    if (path === '/edit-profile') return 'edit profile';
    if (path === '/my-submissions') return 'my submissions';
    if (path === '/create-exhibition') return 'new exhibition';
    return '';
  };

  return (
    <nav className="nav">
      <div className="nav-left">
        <Link to="/" className="logo">GALERIE</Link>
        {getPageName() && (
          <>
            <span className="dot">·</span>
            <span className="current">{getPageName()}</span>
          </>
        )}
      </div>

      {/* Desktop nav */}
      <div className="nav-right desktop-nav">
        <Link to="/library">library</Link>
        <Link to="/search">search</Link>
        <Link to="/voting">voting</Link>
        {session ? (
          <>
            <Link to={`/artist/${username || 'me'}`}>@{username || '…'}</Link>
            <Link to="/my-submissions">submissions</Link>
            <button className="nav-link-btn" onClick={handleSignOut}>sign out</button>
          </>
        ) : (
          <>
            <Link to="/login">sign in</Link>
            <Link to="/signup" className="nav-signup">sign up</Link>
          </>
        )}
        <button
          className="theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="Toggle theme"
        >
          {darkMode ? '☀' : '☾'}
        </button>
      </div>

      {/* Mobile hamburger */}
      <div className="mobile-controls">
        <button
          className="theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="Toggle theme"
        >
          {darkMode ? '☀' : '☾'}
        </button>
        <button
          className="hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="mobile-menu">
          <Link to="/library">library</Link>
          <Link to="/search">search</Link>
          <Link to="/voting">voting</Link>
          {session ? (
            <>
              <Link to={`/artist/${username || 'me'}`}>@{username || '…'}</Link>
              <Link to="/upload">upload work</Link>
              <Link to="/write">write article</Link>
              <Link to="/my-submissions">my submissions</Link>
              <button className="nav-link-btn" onClick={handleSignOut}>sign out</button>
            </>
          ) : (
            <>
              <Link to="/login">sign in</Link>
              <Link to="/signup">sign up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
