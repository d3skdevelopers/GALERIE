import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './ArtistProfile.css';

export default function ArtistProfile({ session }) {
  const { username } = useParams();
  const [artist, setArtist] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [exhibitions, setExhibitions] = useState([]);
  const [kinship, setKinship] = useState([]);
  const [activeTab, setActiveTab] = useState('works');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArtist();
  }, [username]);

  async function fetchArtist() {
    setLoading(true);
    setError(null);
    
    try {
      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          setError('Artist not found');
        } else {
          setError('Error loading artist');
        }
        setLoading(false);
        return;
      }

      if (profile) {
        setArtist(profile);

        // Get their artworks
        const { data: works } = await supabase
          .from('artworks')
          .select('*')
          .eq('artist_id', profile.id)
          .eq('is_approved', true)
          .order('created_at', { ascending: false });

        setArtworks(works || []);

        // Get exhibitions they curated
        const { data: shows } = await supabase
          .from('exhibitions')
          .select('*')
          .contains('curator_ids', [profile.id])
          .eq('is_public', true);

        setExhibitions(shows || []);

        // Get kinship with other artists
        if (works?.length > 0) {
          const { data: kin } = await supabase
            .from('kinship')
            .select('*, artwork_b:artwork_b_id(artist_id, profiles(username))')
            .in('artwork_a_id', works.map(w => w.id))
            .order('similarity_score', { ascending: false })
            .limit(10);

          setKinship(kin || []);
        }
      }
    } catch (err) {
      console.error('Error fetching artist:', err);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">loading artist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="error-message">
          <h1>{error}</h1>
          <p>The artist @{username} doesn't exist yet.</p>
          <Link to="/" className="back-link">← return to foyer</Link>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="profile-container">
        <div className="error-message">
          <h1>artist not found</h1>
          <p>The artist @{username} doesn't exist yet.</p>
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
          {artist.bio && <p className="profile-bio">{artist.bio}</p>}
          <div className="profile-stats">
            <span>{artworks.length} works</span>
            <span>{exhibitions.length} exhibitions curated</span>
            <span>{artist.voting_tickets} voting tickets/week</span>
          </div>
          {session?.user?.id === artist.id && (
            <div className="profile-actions">
              <Link to="/edit-profile" className="edit-profile-button">
                edit profile
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="profile-tabs">
        <button 
          className={activeTab === 'works' ? 'active' : ''} 
          onClick={() => setActiveTab('works')}
        >works</button>
        <button 
          className={activeTab === 'exhibitions' ? 'active' : ''} 
          onClick={() => setActiveTab('exhibitions')}
        >exhibitions</button>
        <button 
          className={activeTab === 'kinship' ? 'active' : ''} 
          onClick={() => setActiveTab('kinship')}
        >kinship</button>
      </div>

      <div className="profile-content">
        {activeTab === 'works' && (
          <div className="works-grid">
            {artworks.length === 0 ? (
              <p className="no-content">no works yet</p>
            ) : (
              artworks.map(artwork => (
                <Link to={`/artwork/${artwork.id}`} key={artwork.id} className="work-card">
                  <div className="work-preview">◈</div>
                  <div className="work-info">
                    <h3>{artwork.title}</h3>
                    <p>{artwork.year || 'no date'}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === 'exhibitions' && (
          <div className="exhibitions-list">
            {exhibitions.length === 0 ? (
              <p className="no-content">no exhibitions curated</p>
            ) : (
              exhibitions.map(ex => (
                <div key={ex.id} className="exhibition-card">
                  <h3>{ex.title}</h3>
                  <p className="exhibition-description">{ex.description}</p>
                  <div className="exhibition-dates">
                    {ex.opening_date} — {ex.closing_date || 'ongoing'}
                  </div>
                  <Link to={`/exhibition/${ex.id}`} className="view-exhibition">view exhibition →</Link>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'kinship' && (
          <div className="kinship-list">
            <h3>artists with similar work</h3>
            {kinship.length === 0 ? (
              <p className="no-content">no kinship data yet</p>
            ) : (
              kinship.map(k => (
                <div key={k.id} className="kinship-profile-item">
                  <span className="kinship-score">{Math.round(k.similarity_score * 100)}%</span>
                  <Link to={`/artist/${k.artwork_b?.profiles?.username}`}>
                    @{k.artwork_b?.profiles?.username}
                  </Link>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}