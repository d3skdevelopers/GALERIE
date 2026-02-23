import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/api';
import './ArtistProfile.css';

export default function ArtistProfile({ session }) {
  const { username } = useParams();
  const [artist, setArtist] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [exhibitions, setExhibitions] = useState([]);
  const [articles, setArticles] = useState([]);
  const [activeTab, setActiveTab] = useState('works');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [username]);

  async function loadProfile() {
    setLoading(true);
    setNotFound(false);

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setArtist(profile);

      // Load all data in parallel
      const [worksRes, showsRes, articlesRes] = await Promise.all([
        supabase
          .from('artworks')
          .select('*')
          .eq('artist_id', profile.id)
          .eq('is_approved', true)
          .order('created_at', { ascending: false }),

        supabase
          .from('exhibitions')
          .select('*')
          .contains('curator_ids', [profile.id])
          .eq('is_public', true),

        // FIX: Use the proper author endpoint
        fetch(`${API_URL}/api/articles/author/${profile.id}`).then(r => r.json()).catch(() => [])
      ]);

      setArtworks(worksRes.data || []);
      setExhibitions(showsRes.data || []);
      setArticles(Array.isArray(articlesRes) ? articlesRes : []);
    } catch (err) {
      console.error('Profile load error:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const isOwner = session?.user?.id === artist?.id;

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="profile-container">
        <div className="not-found">
          <h1>artist not found</h1>
          <p>@{username} doesn't exist in the gallery.</p>
          <Link to="/" className="back-link">← return to foyer</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-avatar">
          {artist.avatar_url ? (
            <img src={artist.avatar_url} alt={artist.username} />
          ) : (
            <div className="avatar-placeholder">✦</div>
          )}
        </div>

        <div className="profile-info">
          <h1>@{artist.username}</h1>
          {artist.full_name && <h2>{artist.full_name}</h2>}
          {artist.bio && <p className="bio">{artist.bio}</p>}
          <div className="stats">
            <span>{artworks.length} works</span>
            <span>{exhibitions.length} exhibitions</span>
            <span>{articles.length} articles</span>
          </div>
          {isOwner && (
            <div className="owner-actions">
              <Link to="/edit-profile" className="edit-btn">edit profile</Link>
              <Link to="/upload" className="upload-btn">upload work</Link>
              <Link to="/write" className="write-btn">write article</Link>
            </div>
          )}
        </div>
      </div>

      <div className="profile-tabs">
        {[
          ['works', `works (${artworks.length})`],
          ['exhibitions', `exhibitions (${exhibitions.length})`],
          ['articles', `articles (${articles.length})`]
        ].map(([tab, label]) => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="profile-content">
        {activeTab === 'works' && (
          artworks.length === 0
            ? <p className="empty">no approved works yet</p>
            : (
              <div className="works-grid">
                {artworks.map(artwork => (
                  <Link to={`/artwork/${artwork.id}`} key={artwork.id} className="work-card">
                    <div className="work-preview">◈</div>
                    <div className="work-info">
                      <h3>{artwork.title}</h3>
                      <p>{artwork.year || artwork.medium || '—'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )
        )}

        {activeTab === 'exhibitions' && (
          exhibitions.length === 0
            ? <p className="empty">no exhibitions curated yet</p>
            : (
              <div className="exhibitions-list">
                {exhibitions.map(ex => (
                  <div key={ex.id} className="exhibition-card">
                    <h3>{ex.title}</h3>
                    {ex.description && <p>{ex.description}</p>}
                    <div className="ex-meta">
                      {ex.opening_date} {ex.closing_date ? `— ${ex.closing_date}` : '— ongoing'}
                    </div>
                  </div>
                ))}
              </div>
            )
        )}

        {activeTab === 'articles' && (
          articles.length === 0
            ? <p className="empty">no articles written yet</p>
            : (
              <div className="articles-grid">
                {articles.map(article => (
                  <Link to={`/article/${article.id}`} key={article.id} className="article-card">
                    <div className="article-preview-icon">✦</div>
                    <div className="article-card-info">
                      <h3>{article.title}</h3>
                      <p className="article-meta">
                        {article.push_count} pushes · {new Date(article.published_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )
        )}
      </div>
    </div>
  );
}
