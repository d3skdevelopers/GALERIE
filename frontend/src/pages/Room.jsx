import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fitnessLabel, fitnessPhase } from '../lib/pigment';
import { countPolygons } from '../lib/pigment-local';
import './Room.css';

// Local genome thumbnail — renders .pg inline on a small canvas
// Used as fallback when no preview_url exists on HTML artworks
function GenomeThumb({ genome, width = 200, height = 200 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current || !genome) return;
    import('../lib/pigment-local').then(({ parseGenome, renderGenomeToCanvas }) => {
      if (!ref.current) return;
      try {
        renderGenomeToCanvas(parseGenome(genome), ref.current, width, height);
      } catch {}
    });
  }, [genome, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ imageRendering: 'pixelated', width: '100%', height: '100%', display: 'block' }} />;
}


export default function Room() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRoom(); }, [id]);

  async function fetchRoom() {
    // Try fetching the room
    const { data: roomData, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    let artworkIds = roomData?.layout?.artworks?.map(a => a.id) || [];

    // If room has no artworks in layout, load recent approved ones
    if (artworkIds.length === 0) {
      const { data: works } = await supabase
        .from('artworks')
        .select('*, profiles(username), preview_url, genome, pigment_fitness, is_evolved')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(12);
      setArtworks(works || []);
    } else {
      const { data: works } = await supabase
        .from('artworks')
        .select('*, profiles(username), preview_url, genome, pigment_fitness, is_evolved')
        .in('id', artworkIds);
      setArtworks(works || []);
    }

    setRoom(roomData || { id, name: 'Main Gallery', description: 'The seed collection', is_public: true });
    setLoading(false);
  }

  if (loading) return <div className="room-container"><div className="loading">entering the gallery…</div></div>;

  return (
    <div className="room-container">
      <div className="room-header">
        <Link to="/" className="back-link">← GALERIE</Link>
        <div className="room-title-area">
          <h1>{room.name}</h1>
          {room.description && <p className="room-desc">{room.description}</p>}
          <span className="room-count">{artworks.length} works</span>
        </div>
      </div>

      {artworks.length === 0 ? (
        <div className="empty-room">
          <p>This room is empty. <Link to="/upload">Submit the first work →</Link></p>
        </div>
      ) : (
        <div className="room-grid">
          {artworks.map(artwork => (
            <Link to={`/artwork/${artwork.id}`} key={artwork.id} className="room-artwork">
              <div className="artwork-frame">
                {/* Show preview_url if available (set by PIGMENT on upload) */}
                {artwork.preview_url ? (
                  <img src={artwork.preview_url} alt={artwork.title} />
                ) : artwork.file_type === 'png' || artwork.file_type === 'jpg' || artwork.file_type === 'jpeg' || artwork.file_type === 'gif' ? (
                  <img src={artwork.file_url} alt={artwork.title} />
                ) : artwork.genome ? (
                  // Local genome render — no API call needed
                  <GenomeThumb genome={artwork.genome} />
                ) : (
                  <div className="frame-placeholder">✦</div>
                )}
                {/* PIGMENT fitness indicator on evolved works */}
                {artwork.pigment_fitness != null && (
                  <div className="room-fitness-badge">
                    {artwork.pigment_fitness.toFixed(0)}%
                  </div>
                )}
                <div className="artwork-overlay">
                  <h3>{artwork.title}</h3>
                  <p>@{artwork.profiles?.username}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
