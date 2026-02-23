import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './MySubmissions.css';

export default function MySubmissions({ session }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');

  useEffect(() => {
    if (!session) { navigate('/login'); return; }
    loadSubmissions();
  }, [session]);

  async function loadSubmissions() {
    const { data, error } = await supabase
      .from('artworks')
      .select('*')
      .eq('artist_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error || !data) { setLoading(false); return; }

    const now = new Date();
    setPending(data.filter(a => !a.is_approved && new Date(a.voting_ends) > now));
    setRejected(data.filter(a => !a.is_approved && new Date(a.voting_ends) <= now));
    setApproved(data.filter(a => a.is_approved));
    setLoading(false);
  }

  const daysLeft = (voting_ends) => {
    const diff = new Date(voting_ends) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const lists = { pending, rejected, approved };
  const current = lists[tab];

  if (loading) return <div className="my-sub-container"><div className="loading">loading…</div></div>;

  return (
    <div className="my-sub-container">
      <div className="my-sub-header">
        <h1>my submissions</h1>
        <Link to="/upload" className="upload-link">+ upload work</Link>
      </div>

      <div className="sub-tabs">
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
          pending ({pending.length})
        </button>
        <button className={tab === 'approved' ? 'active' : ''} onClick={() => setTab('approved')}>
          approved ({approved.length})
        </button>
        <button className={tab === 'rejected' ? 'active' : ''} onClick={() => setTab('rejected')}>
          rejected ({rejected.length})
        </button>
      </div>

      {current.length === 0 ? (
        <div className="sub-empty">
          {tab === 'pending' && <p>No works currently in voting. <Link to="/upload">Submit something →</Link></p>}
          {tab === 'approved' && <p>No approved works yet. Keep submitting.</p>}
          {tab === 'rejected' && <p>No rejected works. Good.</p>}
        </div>
      ) : (
        <div className="sub-list">
          {current.map(artwork => (
            <div key={artwork.id} className={`sub-card ${tab}`}>
              <div className="sub-preview">
                {artwork.file_type === 'png' || artwork.file_type === 'jpg' ? (
                  <img src={artwork.file_url} alt={artwork.title} />
                ) : (
                  <span>✦</span>
                )}
              </div>
              <div className="sub-info">
                <div className="sub-top">
                  <h3>{artwork.title}</h3>
                  <span className={`sub-status ${tab}`}>
                    {tab === 'pending' && `${daysLeft(artwork.voting_ends)}d left`}
                    {tab === 'approved' && 'approved ✓'}
                    {tab === 'rejected' && 'not admitted'}
                  </span>
                </div>
                {artwork.medium && <p className="sub-medium">{artwork.medium}{artwork.year ? ` · ${artwork.year}` : ''}</p>}
                <div className="sub-votes">
                  <span className="yes-votes">✓ {artwork.approval_votes || 0} approve</span>
                  <span className="no-votes">✗ {artwork.rejection_votes || 0} pass</span>
                </div>
                <div className="sub-actions">
                  {tab === 'approved' && (
                    <Link to={`/artwork/${artwork.id}`} className="view-link">view in gallery →</Link>
                  )}
                  {tab === 'rejected' && (
                    <Link to="/upload" className="resubmit-link">resubmit →</Link>
                  )}
                  {tab === 'pending' && (
                    <span className="pending-note">in voting — check back soon</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
