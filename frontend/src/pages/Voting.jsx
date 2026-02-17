import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/api';
import './Voting.css';

export default function Voting({ session }) {
  const [submissions, setSubmissions] = useState([]);
  const [voted, setVoted] = useState({});
  const [ticketsRemaining, setTicketsRemaining] = useState(5);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchSubmissions();
      fetchUserTickets();
      fetchVoted();
    }
  }, [session]);

  const fetchSubmissions = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${API_URL}/api/votes/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setSubmissions(data.pending || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
      setLoading(false);
    }
  };

  const fetchUserTickets = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const user = await response.json();
      setTicketsRemaining(user.voting_tickets || 0);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    }
  };

  const fetchVoted = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${API_URL}/api/votes/my-votes`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const votes = await response.json();
      const votedMap = {};
      votes.forEach(v => votedMap[v.artwork_id] = v.vote);
      setVoted(votedMap);
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    }
  };

  const castVote = async (artworkId, voteValue) => {
    if (ticketsRemaining <= 0) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${API_URL}/api/votes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artworkId,
          vote: voteValue
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      setVoted({ ...voted, [artworkId]: voteValue });
      setTicketsRemaining(ticketsRemaining - 1);
      
      // Refresh submissions to update counts
      fetchSubmissions();
    } catch (error) {
      console.error('Vote failed:', error);
      alert(error.message);
    }
  };

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

  if (loading) {
    return (
      <div className="voting-container">
        <div className="loading">loading...</div>
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