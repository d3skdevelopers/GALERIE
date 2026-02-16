import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Focus.css';

export default function Focus() {
  const { id } = useParams();
  const [artwork, setArtwork] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [kinship, setKinship] = useState([]);

  useEffect(() => {
    fetchArtwork();
    fetchKinship();
  }, [id]);

  async function fetchArtwork() {
    const { data } = await supabase
      .from('artworks')
      .select('*, profiles(username, full_name)')
      .eq('id', id)
      .single();
    
    setArtwork(data);
  }

  async function fetchKinship() {
    const { data } = await supabase
      .from('kinship')
      .select('*, artwork_b:artwork_b_id(*)')
      .eq('artwork_a_id', id)
      .order('similarity_score', { ascending: false })
      .limit(5);
    
    setKinship(data || []);
  }

  if (!artwork) return <div className="loading">loading...</div>;

  return (
    <div className="focus-container">
      <div className="focus-header">
        <Link to={`/room/1`} className="back-link">← back to room</Link>
        <button 
          className="info-toggle"
          onClick={() => setShowInfo(!showInfo)}
        >
          {showInfo ? '✕' : 'ⓘ'}
        </button>
      </div>

      <div className="focus-artwork">
        <iframe 
          src={artwork.file_url}
          title={artwork.title}
          className="artwork-iframe"
          sandbox="allow-scripts"
        />
      </div>

      {showInfo && (
        <div className="focus-info">
          <h2>{artwork.title}</h2>
          <p className="artist">by <Link to={`/artist/${artwork.profiles?.username}`}>@{artwork.profiles?.username}</Link></p>
          
          {artwork.year && <p className="year">{artwork.year}</p>}
          {artwork.medium && <p className="medium">{artwork.medium}</p>}
          
          {artwork.description && (
            <div className="description">
              <h3>about</h3>
              <p>{artwork.description}</p>
            </div>
          )}

          {kinship.length > 0 && (
            <div className="kinship-section">
              <h3>kinship</h3>
              <div className="kinship-list">
                {kinship.map(k => (
                  <Link to={`/artwork/${k.artwork_b?.id}`} key={k.id} className="kinship-item">
                    <span className="score">{Math.round(k.similarity_score * 100)}%</span>
                    <span className="title">{k.artwork_b?.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="artwork-actions">
            <button className="save-btn">save</button>
            <button className="share-btn">share</button>
          </div>
        </div>
      )}
    </div>
  );
}