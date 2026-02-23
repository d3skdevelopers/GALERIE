import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import './CreateExhibition.css';

export default function CreateExhibition({ session }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userArtworks, setUserArtworks] = useState([]);
  const [galleryArtworks, setGalleryArtworks] = useState([]);
  const [selectedArtworks, setSelectedArtworks] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', description: '', openingDate: '', closingDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    Promise.all([
      supabase.from('artworks').select('*').eq('artist_id', session.user.id).eq('is_approved', true),
      supabase.from('artworks').select('*, profiles(username)').eq('is_approved', true).neq('artist_id', session.user.id).limit(60)
    ]).then(([mine, gallery]) => {
      setUserArtworks(mine.data || []);
      setGalleryArtworks(gallery.data || []);
    });
  }, [session]);

  const toggle = (artwork) => {
    setSelectedArtworks(prev =>
      prev.find(a => a.id === artwork.id)
        ? prev.filter(a => a.id !== artwork.id)
        : [...prev, artwork]
    );
  };

  const isSelected = (id) => selectedArtworks.some(a => a.id === id);

  const filtered = galleryArtworks.filter(a =>
    !search || a.title?.toLowerCase().includes(search.toLowerCase()) || a.profiles?.username?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePublish = async () => {
    if (!form.title) { setError('Title is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch('/api/exhibitions', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          openingDate: form.openingDate || new Date().toISOString().split('T')[0],
          closingDate: form.closingDate || null
        })
      });
      navigate(`/artist/${session.user.user_metadata?.username || ''}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return <div className="ce-container"><p>Sign in to create exhibitions.</p></div>;

  return (
    <div className="ce-container">
      <h1>create exhibition</h1>

      <div className="ce-steps">
        {[['1', 'select works'], ['2', 'details'], ['3', 'publish']].map(([num, label], i) => (
          <div key={num} className={`ce-step ${step > i ? 'done' : ''} ${step === i + 1 ? 'current' : ''}`}>
            <span className="step-num">{num}</span>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="ce-content">
          <div className="works-panels">
            <div className="works-panel">
              <h3>your works</h3>
              <div className="select-grid">
                {userArtworks.length === 0
                  ? <p className="panel-empty">No approved works yet</p>
                  : userArtworks.map(a => (
                    <div key={a.id} className={`select-item ${isSelected(a.id) ? 'on' : ''}`} onClick={() => toggle(a)}>
                      <div className="si-preview">◈</div>
                      <span>{a.title}</span>
                    </div>
                  ))
                }
              </div>
            </div>
            <div className="works-panel">
              <h3>gallery works</h3>
              <input className="ce-search" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="search…" />
              <div className="select-grid">
                {filtered.map(a => (
                  <div key={a.id} className={`select-item ${isSelected(a.id) ? 'on' : ''}`} onClick={() => toggle(a)}>
                    <div className="si-preview">◈</div>
                    <span>{a.title}</span>
                    <span className="si-artist">@{a.profiles?.username}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ce-bar">
            <span>{selectedArtworks.length} selected</span>
            <button onClick={() => setStep(2)} disabled={selectedArtworks.length === 0} className="next-btn">next →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ce-content">
          <div className="ce-form">
            <div className="form-group">
              <label>title *</label>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. The Birth of Consciousness" />
            </div>
            <div className="form-group">
              <label>description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={4} placeholder="what is this exhibition about?" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>opening date</label>
                <input type="date" value={form.openingDate} onChange={e => setForm({...form, openingDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label>closing date (optional)</label>
                <input type="date" value={form.closingDate} onChange={e => setForm({...form, closingDate: e.target.value})} />
              </div>
            </div>
          </div>
          <div className="ce-nav">
            <button onClick={() => setStep(1)} className="back-btn">← back</button>
            <button onClick={() => setStep(3)} disabled={!form.title} className="next-btn">next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="ce-content">
          <div className="ce-summary">
            <h2>{form.title}</h2>
            {form.description && <p>{form.description}</p>}
            <p className="summary-count">{selectedArtworks.length} works</p>
            <div className="summary-works">
              {selectedArtworks.map((a, i) => (
                <div key={a.id} className="summary-item">
                  <span className="si-num">{i + 1}</span>
                  <span>{a.title}</span>
                </div>
              ))}
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="ce-nav">
            <button onClick={() => setStep(2)} className="back-btn">← back</button>
            <button onClick={handlePublish} disabled={submitting} className="publish-btn">
              {submitting ? 'publishing…' : 'publish exhibition'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
