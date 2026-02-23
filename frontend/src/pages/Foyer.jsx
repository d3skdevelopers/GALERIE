import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Foyer.css';

export default function Foyer({ session }) {
  const [recentArtworks, setRecentArtworks] = useState([]);
  const [featuredExhibition, setFeaturedExhibition] = useState(null);
  const [mainRoomId, setMainRoomId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchRecent(), fetchFeatured(), fetchMainRoom()])
      .finally(() => setLoading(false));
  }, []);

  async function fetchRecent() {
    const { data } = await supabase
      .from('artworks')
      .select('*, profiles(username)')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(9);
    setRecentArtworks(data || []);
  }

  async function fetchFeatured() {
    const { data } = await supabase
      .from('exhibitions')
      .select('id, title')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setFeaturedExhibition(data);
  }

  // Fetch the oldest/first public room to use as the "enter" destination
  async function fetchMainRoom() {
    const { data } = await supabase
      .from('rooms')
      .select('id')
      .eq('is_public', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    setMainRoomId(data?.id || null);
  }

  return (
    <div className="foyer">
      <div className="hero">
        <h1>GALERIE</h1>
        <div className="hero-star">✧</div>
        <p className="tagline">a home for living code</p>
        <Link to={mainRoomId ? `/room/${mainRoomId}` : '/voting'} className="enter-btn">enter</Link>
        {featuredExhibition && (
          <p className="featured-note">
            current exhibition: <span>{featuredExhibition.title}</span>
          </p>
        )}
      </div>

      {!loading && (
        <div className="seed-section">
          <div className="section-header">
            <h2>the collection</h2>
            <p className="section-sub">approved works in the gallery</p>
          </div>

          {recentArtworks.length === 0 ? (
            <div className="empty-gallery">
              <p>The gallery awaits its first works.</p>
              {session
                ? <Link to="/upload" className="cta-link">submit your work →</Link>
                : <Link to="/signup" className="cta-link">join to submit →</Link>
              }
            </div>
          ) : (
            <>
              <div className="artwork-grid">
                {recentArtworks.map(artwork => (
                  <Link to={`/artwork/${artwork.id}`} key={artwork.id} className="artwork-card">
                    <div className="artwork-preview">◈</div>
                    <div className="artwork-info">
                      <div className="artwork-title">{artwork.title}</div>
                      <div className="artwork-meta">@{artwork.profiles?.username}</div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="foyer-cta">
                {session
                  ? <Link to="/upload" className="cta-link">submit your work →</Link>
                  : <Link to="/voting" className="cta-link">join the voting →</Link>
                }
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
