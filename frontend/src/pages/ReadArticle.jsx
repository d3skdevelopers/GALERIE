import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { API_URL, apiFetch } from '../lib/api';
import './ReadArticle.css';

// ── Body renderer: paragraphs, @mentions, images, bold, italic ──
function renderInline(text) {
  const parts = [];
  const re = /!\[([^\]]*)\]\(([^)]+)\)|@([a-zA-Z0-9_]+)|\*\*(.+?)\*\*|_(.+?)_/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      // Block image: ![alt](url) — render inline since it's inside a <p>
      parts.push(
        <img key={m.index} src={m[2]} alt={m[1]} className="article-img-inline" />
      );
    } else if (m[3]) {
      parts.push(
        <Link key={m.index} to={`/artist/${m[3]}`} className="mention">@{m[3]}</Link>
      );
    } else if (m[4]) {
      parts.push(<strong key={m.index}>{m[4]}</strong>);
    } else if (m[5]) {
      parts.push(<em key={m.index}>{m[5]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderBody(text) {
  return text.split('\n\n').map((para, i) => {
    if (!para.trim()) return null;
    // Standalone image paragraph: ![alt](url)
    const imgMatch = para.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      return (
        <figure key={i} className="article-figure">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="article-img" />
          {imgMatch[1] && <figcaption>{imgMatch[1]}</figcaption>}
        </figure>
      );
    }
    return <p key={i}>{renderInline(para)}</p>;
  });
}

export default function ReadArticle({ session }) {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [hasPushed, setHasPushed] = useState(false);
  const [pushCount, setPushCount] = useState(0);
  const [pushTickets, setPushTickets] = useState(0);
  const [pushing, setPushing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [id, session]);

  async function loadAll() {
    try {
      const [artRes, pushRes, meRes] = await Promise.all([
        fetch(`${API_URL}/api/articles/${id}`).then(r => r.json()),
        session ? apiFetch('/api/pushes/my-pushes') : Promise.resolve([]),
        session ? apiFetch('/api/auth/me') : Promise.resolve(null)
      ]);

      setArticle(artRes);
      setPushCount(artRes.push_count || 0);

      if (session) {
        const pushed = (pushRes || []).some(p => p.article_id === id);
        setHasPushed(pushed);
        setPushTickets(meRes?.push_tickets || 0);
      }

      if (artRes.artwork_ids?.length > 0) {
        const { data } = await supabase
          .from('artworks')
          .select('id, title, profiles(username)')
          .in('id', artRes.artwork_ids);
        setArtworks(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePush() {
    if (!session || hasPushed || pushTickets <= 0 || pushing) return;
    setPushing(true);
    try {
      const result = await apiFetch(`/api/pushes/article/${id}`, { method: 'POST' });
      setHasPushed(true);
      setPushCount(prev => prev + 1);
      setPushTickets(result.ticketsRemaining ?? pushTickets - 1);
    } catch (err) {
      alert(err.message);
    } finally {
      setPushing(false);
    }
  }

  if (loading) return <div className="read-container"><div className="loading">loading…</div></div>;
  if (!article || article.error) return <div className="read-container"><p className="error">Article not found.</p></div>;

  return (
    <div className="read-container">
      <Link to="/library" className="back-link">← library</Link>

      <article className="article-body-wrap">
        <h1>{article.title}</h1>
        <p className="byline">
          by{' '}
          <Link to={`/artist/${article.author?.username}`}>@{article.author?.username}</Link>
          {' '}· {new Date(article.published_at).toLocaleDateString()}
        </p>

        <div className="article-text">
          {renderBody(article.body)}
        </div>

        {artworks.length > 0 && (
          <div className="related-works">
            <h3>referenced works</h3>
            <div className="works-row">
              {artworks.map(a => (
                <Link to={`/artwork/${a.id}`} key={a.id} className="ref-work">
                  <span className="ref-icon">◈</span>
                  <span>{a.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="article-footer">
          <div className="push-row">
            <button
              onClick={handlePush}
              disabled={!session || hasPushed || pushTickets <= 0 || pushing}
              className={`push-btn ${hasPushed ? 'pushed' : ''}`}
            >
              {pushing ? '…' : hasPushed ? 'pushed ✦' : 'push'}
            </button>
            <span className="push-ct">{pushCount} pushes</span>
          </div>
          {session && (
            <p className="tickets-left">{pushTickets} push ticket{pushTickets !== 1 ? 's' : ''} remaining</p>
          )}
        </div>
      </article>
    </div>
  );
}
