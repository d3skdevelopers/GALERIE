import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Foyer.css';

export default function Foyer({ session }) {
  const [featuredExhibition, setFeaturedExhibition] = useState(null);
  const [recentArtworks, setRecentArtworks] = useState([]);

  useEffect(() => {
    fetchFeatured();
    fetchRecent();
  }, []);

  async function fetchFeatured() {
    const { data } = await supabase
      .from('exhibitions')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    setFeaturedExhibition(data);
  }

  async function fetchRecent() {
    const { data } = await supabase
      .from('artworks')
      .select('*, profiles(username)')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(6);
    
    setRecentArtworks(data || []);
  }

  return (
    <div className="foyer">
      <div className="hero">
        <h1>GALERIE</h1>
        <div className="star">✧</div>
        <p className="tagline">a home for living code</p>
        <Link to="/room/1" className="enter-btn">enter</Link>
        {featuredExhibition && (
          <div className="current-exhibition">
            current exhibition: <span>{featuredExhibition.title}</span>
          </div>
        )}
      </div>

      <div className="seed-section">
        <h2>the seed collection</h2>
        <div className="section-sub">30 studies of a single idea · 1974 – ∞</div>
        
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
      </div>
    </div>
  );
}