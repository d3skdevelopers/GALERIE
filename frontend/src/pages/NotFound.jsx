import { Link, useLocation } from 'react-router-dom';
import './NotFound.css';

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="notfound">
      <div className="notfound-inner">
        <div className="notfound-glyph">✦</div>
        <h1>404</h1>
        <p className="notfound-headline">this room doesn't exist</p>
        <p className="notfound-path">{pathname}</p>
        <nav className="notfound-links">
          <Link to="/" className="notfound-btn primary">← return to foyer</Link>
          <Link to="/voting" className="notfound-btn">voting</Link>
          <Link to="/library" className="notfound-btn">library</Link>
          <Link to="/search" className="notfound-btn">search</Link>
        </nav>
      </div>
    </div>
  );
}
