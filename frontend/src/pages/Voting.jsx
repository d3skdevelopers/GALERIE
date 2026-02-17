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

  // Helper function to get token and make authenticated requests
  const fetchWithAuth = async (url, options = {}) => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      let token = session?.access_token;
      
      if (!token) {
        console.log('No active session, trying to refresh...');
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('Session refresh failed:', refreshError);
          return null;
        }
        token = refreshData.session?.access_token;
      }

      if (!token) {
        console.error('No token available after refresh');
        return null;
      }

      console.log('Sending request with token:', token.substring(0, 20) + '...');

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        console.error(`Request failed with status ${response.status}`);
        
        if (response.status === 401) {
          // Token might be expired, try to refresh once more
          console.log('Token rejected, attempting refresh...');
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session?.access_token) {
            // Retry with new token
            return fetchWithAuth(url, options);
          }
        }
        
        const errorText = await response.text();
        console.error('Error response:', errorText);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      return null;
    }
  };

  useEffect(() => {
    if (session) {
      loadAllData();
    }
  }, [session]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSubmissions(),
      fetchUserTickets(),
      fetchVoted()
    ]);
    setLoading(false);
  };

  const fetchSubmissions = async () => {
    try {
      console.log('Fetching submissions from:', `${API_URL}/api/votes/pending`);
      const data = await fetchWithAuth(`${API_URL}/api/votes/pending`);
      console.log('Submissions response:', data);
      if (data) {
        setSubmissions(data.pending || []);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    }
  };

  const fetchUserTickets = async () => {
    try {
      const user = await fetchWithAuth(`${API_URL}/api/auth/me`);
      if (user) {
        setTicketsRemaining(user.voting_tickets || 0);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    }
  };

  const fetchVoted = async () => {
    try {
      const votes = await fetchWithAuth(`${API_URL}/api/votes/my-votes`);
      if (votes) {
        const votedMap = {};
        votes.forEach(v => votedMap[v.artwork_id] = v.vote);
        setVoted(votedMap);
      }
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    }
  };

  const castVote = async (artworkId, voteValue) => {
    if (ticketsRemaining <= 0) {
      alert('No votes remaining this week');
      return;
    }

    try {
      const result = await fetchWithAuth(`${API_URL}/api/votes`, {
        method: 'POST',
        body: JSON.stringify({
          artworkId,
          vote: voteValue
        })
      });

      if (result) {
        setVoted({ ...voted, [artworkId]: voteValue });
        setTicketsRemaining(prev => prev - 1);
        await fetchSubmissions(); // Refresh to update counts
      }
    } catch (error) {
      console.error('Vote failed:', error);
      alert(error.message || 'Failed to cast vote');
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
        {filteredSubmissions.length === 0 ? (
          <div className="no-submissions">
            <p>No artworks waiting for votes</p>
          </div>
        ) : (
          filteredSubmissions.map(artwork => (
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
          ))
        )}
      </div>
    </div>
  );
}