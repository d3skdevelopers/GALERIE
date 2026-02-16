import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Voting.css';

export default function Voting({ session }) {
  const [submissions, setSubmissions] = useState([]);
  const [voted, setVoted] = useState({});
  const [ticketsRemaining, setTicketsRemaining] = useState(5);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (session) {
      fetchSubmissions();
      fetchUserTickets();
      fetchVoted();
    }
  }, [session]);

  async function fetchSubmissions() {
    const { data } = await supabase
      .from('artworks')
      .select('*, profiles(username)')
      .eq('is_approved', false)
      .gt('voting_ends', new Date().toISOString())
      .order('voting_ends', { ascending: true });
    
    setSubmissions(data || []);
  }

  async function fetchUserTickets() {
    const { data } = await supabase
      .from('profiles')
      .select('voting_tickets')
      .eq('id', session.user.id)
      .single();
    
    setTicketsRemaining(data?.voting_tickets || 0);
  }

  async function fetchVoted() {
    const { data } = await supabase
      .from('votes')
      .select('artwork_id, vote')
      .eq('voter_id', session.user.id);
    
    const votedMap = {};
    data?.forEach(v => votedMap[v.artwork_id] = v.vote);
    setVoted(votedMap);
  }

  async function castVote(artworkId, voteValue) {
    if (ticketsRemaining <= 0) return;

    const { error } = await supabase
      .from('votes')
      .insert({
        artwork_id: artworkId,
        voter_id: session.user.id,
        vote: voteValue
      });

    if (!error) {
      setVoted({ ...voted, [artworkId]: voteValue });
      setTicketsRemaining(ticketsRemaining - 1);
      
      // Update vote counts
      if (voteValue) {
        await supabase.rpc('increment_approval', { artwork_id: artworkId });
      } else {
        await supabase.rpc('increment_rejection', { artwork_id: artworkId });
      }
    }
  }

  const filteredSubmissions = submissions.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'voted') return voted[s.id] !== undefined;
    if (filter === 'pending') return voted[s.id] === undefined;
    return true;
  });

  if (!session) {
    return (
      <div className="voting-container">
        <h1>voting</h1>
        <p className="voting-description">sign in to vote</p>
        <Link to="/login" className="signin-prompt">sign in →</Link>
      </div>
    );
  }

  return (
    <div className="voting-container">
      <div className="voting-header">
        <h1>voting</h1>
        <div className="tickets">
          <span className="tickets-count">{ticketsRemaining}</span>
          <span className="tickets-label">votes remaining this week</span>
        </div>
      </div>

      <div className="voting-filters">
        <button 
          className={filter === 'all' ? 'active' : ''} 
          onClick={() => setFilter('all')}
        >all ({submissions.length})</button>
        <button 
          className={filter === 'pending' ? 'active' : ''} 
          onClick={() => setFilter('pending')}
        >need your vote</button>
        <button 
          className={filter === 'voted' ? 'active' : ''} 
          onClick={() => setFilter('voted')}
        >voted</button>
      </div>

      <div className="submissions-list">
        {filteredSubmissions.map(artwork => (
          <div key={artwork.id} className="submission-card">
            <div className="submission-preview">✦</div>
            <div className="submission-info">
              <div className="submission-header">
                <h3>{artwork.title}</h3>
                <span className="submission-artist">@{artwork.profiles?.username}</span>
              </div>
              <p className="submission-description">{artwork.description}</p>
              <div className="submission-meta">
                <span>expires: {new Date(artwork.voting_ends).toLocaleDateString()}</span>
                <span>✓ {artwork.approval_votes || 0}</span>
                <span>✗ {artwork.rejection_votes || 0}</span>
              </div>
              {voted[artwork.id] === undefined ? (
                <div className="vote-actions">
                  <button 
                    className="vote-yes" 
                    onClick={() => castVote(artwork.id, true)}
                    disabled={ticketsRemaining <= 0}
                  >✓ yes</button>
                  <button 
                    className="vote-no" 
                    onClick={() => castVote(artwork.id, false)}
                    disabled={ticketsRemaining <= 0}
                  >✗ no</button>
                </div>
              ) : (
                <div className="voted-indicator">
                  you voted {voted[artwork.id] ? '✓ yes' : '✗ no'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}