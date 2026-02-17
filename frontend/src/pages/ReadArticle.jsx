import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/api';
import './ReadArticle.css';

export default function ReadArticle({ session }) {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [hasPushed, setHasPushed] = useState(false);
  const [pushCount, setPushCount] = useState(0);
  const [ticketsRemaining, setTicketsRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticle();
    if (session) {
      checkPushStatus();
      fetchUserTickets();
    }
  }, [id, session]);

  const fetchArticle = async () => {
    try {
      const res = await fetch(`${API_URL}/api/articles/${id}`);
      const data = await res.json();
      setArticle(data);
      setPushCount(data.push_count || 0);

      // Fetch linked artworks
      if (data.artwork_ids?.length > 0) {
        const { data: artworksData } = await supabase
          .from('artworks')
          .select('*, profiles(username)')
          .in('id', data.artwork_ids);
        setArtworks(artworksData || []);
      }
    } catch (error) {
      console.error('Failed to fetch article:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPushStatus = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${API_URL}/api/pushes/my-pushes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const pushes = await res.json();
      const pushed = pushes.some(p => p.article_id === id);
      setHasPushed(pushed);
    } catch (error) {
      console.error('Failed to check push status:', error);
    }
  };

  const fetchUserTickets = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const user = await res.json();
      setTicketsRemaining(user.push_tickets || 0);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    }
  };

  const handlePush = async () => {
    if (!session) {
      alert('sign in to push articles');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${API_URL}/api/pushes/article/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      setHasPushed(true);
      setPushCount(prev => prev + 1);
      setTicketsRemaining(prev => prev - 1);
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) {
    return (
      <div className="read-container">
        <div className="loading">loading...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="read-container">
        <div className="error">article not found</div>
      </div>
    );
  }

  return (
    <div className="read-container">
      <Link to="/library" className="back-link">← back to library</Link>

      <article className="article">
        <h1>{article.title}</h1>
        <p className="article-byline">
          by @{article.author?.username} · {new Date(article.published_at).toLocaleDateString()}
        </p>

        <div className="article-body">
          {article.body.split('\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {artworks.length > 0 && (
          <div className="related-artworks">
            <h2>related artworks</h2>
            <div className="artworks-mini-grid">
              {artworks.map(artwork => (
                <Link to={`/artwork/${artwork.id}`} key={artwork.id} className="mini-artwork">
                  <div className="mini-preview">◈</div>
                  <span>{artwork.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="article-footer">
          <div className="push-section">
            <button 
              onClick={handlePush}
              disabled={!session || hasPushed || ticketsRemaining <= 0}
              className="push-button"
            >
              {hasPushed ? 'pushed' : 'push'}
            </button>
            <span className="push-count">{pushCount} pushes</span>
          </div>
          {session && (
            <div className="tickets-remaining">
              {ticketsRemaining} pushes remaining this week
            </div>
          )}
        </div>
      </article>
    </div>
  );
}