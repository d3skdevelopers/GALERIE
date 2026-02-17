import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../lib/api';
import './Library.css';

export default function Library() {
  const [featured, setFeatured] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('featured');

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const [featuredRes, recentRes] = await Promise.all([
        fetch(`${API_URL}/api/articles/featured`),
        fetch(`${API_URL}/api/articles/recent`)
      ]);

      const featuredData = await featuredRes.json();
      const recentData = await recentRes.json();

      setFeatured(featuredData);
      setRecent(recentData);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="library-container">
        <div className="loading">loading library...</div>
      </div>
    );
  }

  return (
    <div className="library-container">
      <div className="library-header">
        <h1>the library</h1>
        <Link to="/write" className="write-button">write article</Link>
      </div>

      <div className="library-tabs">
        <button 
          className={view === 'featured' ? 'active' : ''}
          onClick={() => setView('featured')}
        >featured</button>
        <button 
          className={view === 'recent' ? 'active' : ''}
          onClick={() => setView('recent')}
        >recent</button>
      </div>

      <div className="articles-grid">
        {(view === 'featured' ? featured : recent).map(article => (
          <Link to={`/article/${article.id}`} key={article.id} className="article-card">
            <div className="article-preview">✦</div>
            <div className="article-info">
              <h3>{article.title}</h3>
              <p className="article-meta">
                by @{article.author?.username} · {article.push_count} pushes
              </p>
              <p className="article-excerpt">
                {article.body.substring(0, 120)}...
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}