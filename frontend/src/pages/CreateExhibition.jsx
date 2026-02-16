import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './CreateExhibition.css';

export default function CreateExhibition({ session }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userArtworks, setUserArtworks] = useState([]);
  const [galleryArtworks, setGalleryArtworks] = useState([]);
  const [selectedArtworks, setSelectedArtworks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    theme: '',
    openingDate: '',
    closingDate: ''
  });

  useEffect(() => {
    if (session) {
      fetchUserArtworks();
      fetchGalleryArtworks();
    }
  }, [session]);

  async function fetchUserArtworks() {
    const { data } = await supabase
      .from('artworks')
      .select('*')
      .eq('artist_id', session.user.id)
      .eq('is_approved', true);
    
    setUserArtworks(data || []);
  }

  async function fetchGalleryArtworks() {
    const { data } = await supabase
      .from('artworks')
      .select('*, profiles(username)')
      .eq('is_approved', true)
      .neq('artist_id', session.user.id)
      .limit(50);
    
    setGalleryArtworks(data || []);
  }

  const toggleArtwork = (artwork) => {
    if (selectedArtworks.find(a => a.id === artwork.id)) {
      setSelectedArtworks(selectedArtworks.filter(a => a.id !== artwork.id));
    } else {
      setSelectedArtworks([...selectedArtworks, artwork]);
    }
  };

  const filteredGallery = galleryArtworks.filter(a => 
    a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    const roomIds = []; // In real app, create rooms first
    
    const { data, error } = await supabase
      .from('exhibitions')
      .insert({
        title: formData.title,
        description: formData.description,
        curator_ids: [session.user.id],
        room_ids: roomIds,
        opening_date: formData.openingDate || null,
        closing_date: formData.closingDate || null,
        is_public: true
      })
      .select()
      .single();

    if (!error) {
      navigate(`/exhibition/${data.id}`);
    }
  };

  if (!session) {
    return (
      <div className="create-exhibition">
        <h1>create exhibition</h1>
        <p>sign in to curate</p>
      </div>
    );
  }

  return (
    <div className="create-exhibition">
      <h1>create exhibition</h1>
      <div className="steps">
        <div className={`step ${step >= 1 ? 'active' : ''}`}>1. select works</div>
        <div className={`step ${step >= 2 ? 'active' : ''}`}>2. title & theme</div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>3. arrange</div>
      </div>

      {step === 1 && (
        <div className="step-content">
          <div className="selection-area">
            <div className="your-works">
              <h3>your works</h3>
              <div className="works-grid">
                {userArtworks.map(artwork => (
                  <div 
                    key={artwork.id} 
                    className={`artwork-select ${selectedArtworks.find(a => a.id === artwork.id) ? 'selected' : ''}`}
                    onClick={() => toggleArtwork(artwork)}
                  >
                    <div className="artwork-preview">◈</div>
                    <div className="artwork-info">
                      <div className="artwork-title">{artwork.title}</div>
                      <div className="artwork-year">{artwork.year}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gallery-works">
              <h3>gallery works</h3>
              <input 
                type="text" 
                placeholder="search by artist or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <div className="works-grid">
                {filteredGallery.map(artwork => (
                  <div 
                    key={artwork.id} 
                    className={`artwork-select ${selectedArtworks.find(a => a.id === artwork.id) ? 'selected' : ''}`}
                    onClick={() => toggleArtwork(artwork)}
                  >
                    <div className="artwork-preview">◈</div>
                    <div className="artwork-info">
                      <div className="artwork-title">{artwork.title}</div>
                      <div className="artwork-artist">@{artwork.profiles?.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="selection-summary">
            <span>{selectedArtworks.length} works selected</span>
            <button onClick={() => setStep(2)} disabled={selectedArtworks.length === 0}>
              next →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step-content">
          <div className="form-group">
            <label>title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="e.g., 'The Birth of Consciousness'"
            />
          </div>

          <div className="form-group">
            <label>description</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="what is this exhibition about?"
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>theme (optional)</label>
            <input 
              type="text" 
              value={formData.theme}
              onChange={(e) => setFormData({...formData, theme: e.target.value})}
              placeholder="e.g., consciousness, quantum, nature"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>opening date</label>
              <input 
                type="date" 
                value={formData.openingDate}
                onChange={(e) => setFormData({...formData, openingDate: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>closing date (optional)</label>
              <input 
                type="date" 
                value={formData.closingDate}
                onChange={(e) => setFormData({...formData, closingDate: e.target.value})}
              />
            </div>
          </div>

          <div className="navigation-buttons">
            <button onClick={() => setStep(1)}>← back</button>
            <button 
              onClick={() => setStep(3)} 
              disabled={!formData.title}
            >next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step-content">
          <div className="arrangement-area">
            <h3>arrange sequence</h3>
            <p className="arrangement-hint">drag to reorder (simulated — real drag-drop coming)</p>
            
            <div className="sequence-list">
              {selectedArtworks.map((artwork, index) => (
                <div key={artwork.id} className="sequence-item">
                  <span className="sequence-index">{index + 1}</span>
                  <div className="sequence-preview">◈</div>
                  <div className="sequence-info">
                    <div className="sequence-title">{artwork.title}</div>
                    <div className="sequence-artist">@{artwork.profiles?.username || 'you'}</div>
                  </div>
                  <span className="drag-handle">☰</span>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>commentary (optional)</label>
              <textarea 
                placeholder="add notes about the sequence..."
                rows={3}
              />
            </div>
          </div>

          <div className="navigation-buttons">
            <button onClick={() => setStep(2)}>← back</button>
            <button onClick={handleSubmit} className="publish-btn">publish exhibition</button>
          </div>
        </div>
      )}
    </div>
  );
}