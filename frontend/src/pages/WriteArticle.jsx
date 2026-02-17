import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/api';
import './WriteArticle.css';

export default function WriteArticle({ session }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedArtworks, setSelectedArtworks] = useState([]);
  const [userArtworks, setUserArtworks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }
    fetchUserArtworks();
  }, [session]);

  const fetchUserArtworks = async () => {
    const { data } = await supabase
      .from('artworks')
      .select('id, title')
      .eq('artist_id', session.user.id)
      .eq('is_approved', true);

    setUserArtworks(data || []);
  };

  const toggleArtwork = (artworkId) => {
    if (selectedArtworks.includes(artworkId)) {
      setSelectedArtworks(selectedArtworks.filter(id => id !== artworkId));
    } else {
      setSelectedArtworks([...selectedArtworks, artworkId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${API_URL}/api/articles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          body,
          artworkIds: selectedArtworks
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      const article = await res.json();
      navigate(`/article/${article.id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="write-container">
      <h1>write article</h1>

      <form onSubmit={handleSubmit} className="write-form">
        <div className="form-group">
          <label>title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., 'The Evolution of Grain'"
          />
        </div>

        <div className="form-group">
          <label>body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={15}
            placeholder="write your thoughts..."
          />
        </div>

        {userArtworks.length > 0 && (
          <div className="form-group">
            <label>related artworks (optional)</label>
            <div className="artwork-selector">
              {userArtworks.map(artwork => (
                <button
                  type="button"
                  key={artwork.id}
                  className={`artwork-chip ${selectedArtworks.includes(artwork.id) ? 'selected' : ''}`}
                  onClick={() => toggleArtwork(artwork.id)}
                >
                  {artwork.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button type="submit" disabled={loading} className="publish-button">
            {loading ? 'publishing...' : 'publish article'}
          </button>
          <button type="button" onClick={() => navigate('/library')} className="cancel-button">
            cancel
          </button>
        </div>
      </form>
    </div>
  );
}