import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../lib/api';
import './Library.css';

export default function Library() {
  const [articles, setArticles] = useState([]);
  const [view, setView] = useState('featured');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchArticles(view); }, [view]);

  async function fetchArticles(tab) {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/articles/${tab}`);
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
    } catch { setArticles([]); }
    finally { setLoading(false); }
  }

  return (
    <div className="library-container">
      <div className="library-header">
        <h1>the library</h1>
        <Link to="/write" className="write-btn">write article</Link>
      </div>

      <div className="lib-tabs">
        {['featured', 'recent'].map(tab => (
          <button key={tab} className={view === tab ? 'active' : ''} onClick={() => setView(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">loading…</div>
      ) : articles.length === 0 ? (
        <div className="empty-lib">
          <p>No articles yet. <Link to="/write">Be the first to write →</Link></p>
        </div>
      ) : (
        <div className="articles-grid">
          {articles.map(article => (
            <Link to={`/article/${article.id}`} key={article.id} className="article-card">
              <div className="art-card-icon">✦</div>
              <div className="art-card-body">
                <h3>{article.title}</h3>
                <p className="art-card-meta">
                  by @{article.author?.username} · {article.push_count || 0} pushes
                </p>
                <p className="art-card-excerpt">
                  {article.body?.substring(0, 100)}…
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
