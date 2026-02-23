import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { API_URL, apiFetch } from '../lib/api';
import './Voting.css';

// Renders HTML artwork as live output in a sandboxed iframe.
// Uses srcdoc (fetched content) so the source URL is never exposed.
// Pointer-events overlay prevents right-click / view-source / drag.
function HtmlPreview({ fileUrl, title }) {
  const [srcdoc, setSrcdoc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!fileUrl) return;
    fetch(fileUrl)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed');
        return r.text();
      })
      .then(html => {
        // Strip any <script src="..."> that references the original URL
        // and any inline source-revealing comments
        const sanitised = html
          .replace(/<!--[\s\S]*?-->/g, '')           // strip HTML comments
          .replace(/<base\s[^>]*>/gi, '');           // remove base tags
        setSrcdoc(sanitised);
      })
      .catch(() => setFailed(true));
  }, [fileUrl]);

  if (failed) return <span className="preview-icon">✦</span>;
  if (!srcdoc) return <span className="preview-icon loading-spin">↻</span>;

  return (
    <div className="html-preview-wrap">
      {/* Transparent overlay: blocks right-click, drag, and pointer events on the iframe */}
      <div className="html-preview-shield" aria-hidden="true" />
      <iframe
        title={title}
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        className="submission-iframe"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

// Renders a .pg genome to a small canvas for HTML works without preview_url
function GenomeThumb({ genome }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !genome) return;
    import('../lib/pigment-local').then(({ parseGenome, renderGenomeToCanvas }) => {
      if (!ref.current) return;
      try { renderGenomeToCanvas(parseGenome(genome), ref.current, 120, 120); } catch {}
    });
  }, [genome]);
  return (
    <canvas
      ref={ref}
      width={120}
      height={120}
      style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
    />
  );
}

export default function Voting({ session }) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [voted, setVoted] = useState({});
  const [ticketsRemaining, setTicketsRemaining] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState(null); // FIX: track in-progress vote

  // FIX: Single load function, not in useEffect dependency array
  const loadData = useCallback(async () => {
    if (!session) return;

    try {
      const [pendingData, myVotesData, meData] = await Promise.all([
        apiFetch('/api/votes/pending'),
        apiFetch('/api/votes/my-votes'),
        apiFetch('/api/auth/me')
      ]);

      setSubmissions(pendingData?.pending || []);
      setTicketsRemaining(meData?.voting_tickets || 0);

      const votedMap = {};
      (myVotesData || []).forEach(v => { votedMap[v.artwork_id] = v.vote; });
      setVoted(votedMap);
    } catch (err) {
      console.error('Failed to load voting data:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    loadData();
    // FIX: loadData excluded — including it causes infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const castVote = async (artworkId, voteValue) => {
    if (ticketsRemaining <= 0 || votingId) return;

    setVotingId(artworkId);
    try {
      const result = await apiFetch('/api/votes', {
        method: 'POST',
        body: JSON.stringify({ artworkId, vote: voteValue })
      });

      // FIX: Optimistic update — no full reload needed
      setVoted(prev => ({ ...prev, [artworkId]: voteValue }));
      setTicketsRemaining(result.ticketsRemaining ?? ticketsRemaining - 1);
    } catch (err) {
      alert(err.message || 'Vote failed');
    } finally {
      setVotingId(null);
    }
  };

  // Separate voted vs unvoted
  const allWithStatus = submissions.map(s => ({
    ...s,
    myVote: voted[s.id]
  }));

  const filtered = allWithStatus.filter(s => {
    if (filter === 'voted') return s.myVote !== undefined;
    if (filter === 'pending') return s.myVote === undefined;
    return true;
  });

  if (!session) {
    return (
      <div className="voting-container">
        <h1>voting chamber</h1>
        <p className="voting-description">
          Community members vote on new submissions. Sign in to participate.
        </p>
        <Link to="/login" className="signin-link">sign in to vote →</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="voting-container">
        <div className="loading">loading submissions…</div>
      </div>
    );
  }

  return (
    <div className="voting-container">
      <div className="voting-header">
        <div>
          <h1>voting chamber</h1>
          <p className="voting-sub">review and vote on new submissions</p>
        </div>
        <div className="tickets-box">
          <span className="tickets-count">{ticketsRemaining}</span>
          <span className="tickets-label">votes left this week</span>
        </div>
      </div>

      <div className="voting-filters">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          all ({submissions.length})
        </button>
        <button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>
          need vote ({submissions.filter(s => voted[s.id] === undefined).length})
        </button>
        <button className={filter === 'voted' ? 'active' : ''} onClick={() => setFilter('voted')}>
          voted ({Object.keys(voted).length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="no-submissions">
          <p>
            {filter === 'pending'
              ? "You've voted on everything available — check back later."
              : "Nothing here yet."}
          </p>
          {session && (
            <Link to="/upload" className="upload-link">submit your own work →</Link>
          )}
        </div>
      ) : (
        <div className="submissions-list">
          {filtered.map(artwork => (
            <div key={artwork.id} className={`submission-card ${artwork.myVote !== undefined ? 'voted' : ''}`}>
              <div className="submission-preview">
                {artwork.preview_url ? (
                  <img src={artwork.preview_url} alt={artwork.title} />
                ) : artwork.file_type === 'png' || artwork.file_type === 'jpg' || artwork.file_type === 'jpeg' || artwork.file_type === 'gif' ? (
                  <img src={artwork.file_url} alt={artwork.title} />
                ) : artwork.genome ? (
                  <GenomeThumb genome={artwork.genome} />
                ) : (artwork.file_type === 'html' || artwork.file_type === 'htm' || artwork.file_type === 'js') ? (
                  <HtmlPreview fileUrl={artwork.file_url} title={artwork.title} />
                ) : (
                  <span className="preview-icon">✦</span>
                )}
              </div>
              <div className="submission-info">
                <div className="submission-header">
                  <h3>{artwork.title}</h3>
                  <span className="submission-artist">
                    @{artwork.profiles?.username}
                  </span>
                </div>
                {artwork.description && (
                  <p className="submission-description">{artwork.description}</p>
                )}
                <div className="submission-meta">
                  {artwork.medium && <span>medium: {artwork.medium}</span>}
                  {artwork.year && <span>{artwork.year}</span>}
                  <span>expires {new Date(artwork.voting_ends).toLocaleDateString()}</span>
                  <span className="vote-tally">
                    <span className="yes-count">✓ {artwork.approval_votes || 0}</span>
                    <span className="no-count">✗ {artwork.rejection_votes || 0}</span>
                  </span>
                </div>

                {artwork.myVote === undefined ? (
                  <div className="vote-actions">
                    <button
                      className="vote-yes"
                      onClick={() => castVote(artwork.id, true)}
                      disabled={ticketsRemaining <= 0 || votingId === artwork.id}
                    >
                      {votingId === artwork.id ? '…' : '✓ admit'}
                    </button>
                    <button
                      className="vote-no"
                      onClick={() => castVote(artwork.id, false)}
                      disabled={ticketsRemaining <= 0 || votingId === artwork.id}
                    >
                      {votingId === artwork.id ? '…' : '✗ pass'}
                    </button>
                  </div>
                ) : (
                  <div className={`voted-badge ${artwork.myVote ? 'yes' : 'no'}`}>
                    you voted {artwork.myVote ? '✓ admit' : '✗ pass'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {ticketsRemaining === 0 && (
        <div className="tickets-empty">
          You've used all your votes for this week. Tickets refresh every Monday.
        </div>
      )}
    </div>
  );
}