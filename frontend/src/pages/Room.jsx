import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Room.css';

export default function Room() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoom();
  }, [id]);

  async function fetchRoom() {
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (roomData?.layout?.artworks) {
      const artworkIds = roomData.layout.artworks.map(a => a.id);
      const { data: artworksData } = await supabase
        .from('artworks')
        .select('*, profiles(username)')
        .in('id', artworkIds);

      setArtworks(artworksData || []);
    }

    setRoom(roomData);
    setLoading(false);
  }

  if (loading) return <div className="loading">loading room...</div>;
  if (!room) return <div className="error">room not found</div>;

  return (
    <div className="room-container">
      <div className="room-header">
        <Link to="/" className="back-link">← GALERIE</Link>
        <div className="room-info">
          <h1>{room.name}</h1>
          <p className="room-description">{room.description}</p>
          <span className="room-count">{artworks.length} of 30 works</span>
        </div>
      </div>

      <div className="room-grid">
        {artworks.map((artwork, index) => (
          <Link 
            to={`/artwork/${artwork.id}`} 
            key={artwork.id}
            className="room-artwork"
            style={{ gridArea: `artwork-${index}` }}
          >
            <div className="artwork-frame">
              <div className="artwork-preview">✦</div>
              <div className="artwork-overlay">
                <h3>{artwork.title}</h3>
                <p>@{artwork.profiles?.username}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="room-navigation">
        <button className="nav-prev">◀</button>
        <div className="room-dots">
          <span className="dot active"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
        <button className="nav-next">▶</button>
      </div>
    </div>
  );
}