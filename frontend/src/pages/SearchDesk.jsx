import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import './SearchDesk.css';

export default function SearchDesk() {
  const [textQuery, setTextQuery] = useState('');
  const [textResults, setTextResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const handleTextSearch = async (e) => {
    e.preventDefault();
    if (!textQuery.trim() || textQuery.length < 2) return;

    setSearching(true);
    setError('');
    setTextResults(null);

    try {
      const data = await apiFetch(`/api/search?q=${encodeURIComponent(textQuery)}`);
      setTextResults(data);
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const totalTextResults = textResults
    ? (textResults.artworks?.length || 0) + (textResults.artists?.length || 0) + (textResults.articles?.length || 0)
    : 0;

  return (
    <div className="search-desk">
      <h1>search desk</h1>
      <p className="search-description">
        search artworks, artists, and articles by title, medium, or name
      </p>

      <form onSubmit={handleTextSearch} className="text-search-form">
        <div className="search-input-row">
          <input
            type="text"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            placeholder="search artists, artworks, articles…"
            className="text-input"
            autoFocus
          />
          <button type="submit" disabled={searching || textQuery.length < 2} className="search-btn">
            {searching ? '…' : 'search'}
          </button>
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      {searching && (
        <div className="searching">
          <span className="spin-icon">✦</span>
          <p>searching…</p>
        </div>
      )}

      {textResults && !searching && (
        <div className="results">
          {totalTextResults === 0 ? (
            <div className="no-results">
              <p>No results for &ldquo;{textQuery}&rdquo;</p>
              <Link to="/upload" className="upload-prompt-link">upload your work →</Link>
            </div>
          ) : (
            <>
              {textResults.artworks?.length > 0 && (
                <section className="result-section">
                  <h3>artworks</h3>
                  <div className="result-grid">
                    {textResults.artworks.map(a => (
                      <Link to={`/artwork/${a.id}`} key={a.id} className="result-card">
                        <div className="result-preview">◈</div>
                        <div className="result-info">
                          <span className="result-title">{a.title}</span>
                          <span className="result-sub">@{a.profiles?.username}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {textResults.artists?.length > 0 && (
                <section className="result-section">
                  <h3>artists</h3>
                  <div className="result-grid">
                    {textResults.artists.map(a => (
                      <Link to={`/artist/${a.username}`} key={a.id} className="result-card">
                        <div className="result-preview artist">✦</div>
                        <div className="result-info">
                          <span className="result-title">@{a.username}</span>
                          {a.full_name && <span className="result-sub">{a.full_name}</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {textResults.articles?.length > 0 && (
                <section className="result-section">
                  <h3>articles</h3>
                  {textResults.articles.map(a => (
                    <Link to={`/article/${a.id}`} key={a.id} className="article-result">
                      <span className="article-title">{a.title}</span>
                      <span className="article-meta">by @{a.author?.username} · {a.push_count} pushes</span>
                    </Link>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
