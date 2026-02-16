import { Link } from 'react-router-dom';
import './Navigation.css';

export default function Navigation({ session, setDarkMode, darkMode }) {
  return (
    <nav className="nav">
      <div className="nav-left">
        <Link to="/" className="logo">GALERIE</Link>
        <span className="dot">·</span>
        <span className="current">the foyer</span>
      </div>
      <div className="nav-right">
        <Link to="/search">search desk</Link>
        <Link to="/voting">voting</Link>
        {session ? (
          <Link to={`/artist/${session.user.email}`}>@you</Link>
        ) : (
          <Link to="/login">sign in</Link>
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