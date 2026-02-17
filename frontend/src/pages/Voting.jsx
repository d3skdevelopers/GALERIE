import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/api';
import './Voting.css';

export default function Voting({ session }) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [voted, setVoted] = useState({});
  const [ticketsRemaining, setTicketsRemaining] = useState(5);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // Prevent multiple simultaneous requests
  const isFetching = useRef(false);
  const abortController = useRef(null);

  // Helper  function to get token and make authenticated requests
  const fetchWithAuth = async (url, options = {}) => {
    // Prevent concurrent requests
    if (isFetching.current) {
      console.log('Already fetching, skipping...');
      return null;
    }
    
    // Cancel previous request if exists
    if (abortController.current) {
      abortController.current.abort();
    }
    
    abortController.current = new AbortController();
    isFetching.current = true;
    
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No session, redirecting to login...');
        navigate('/login');
        return null;
      }

      const response = await fetch(url, {
        ...options,
        signal: abortController.current.signal,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // If unauthorized, try to refresh the token
      if (response.status === 401) {
        console.log('Token expired, attempting refresh...');
        
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.log('Refresh failed, redirecting to login...');
          await supabase.auth.signOut();
          navigate('/login');
          return null;
        }

        // Retry with new token
        const retryResponse = await fetch(url, {
          ...options,
          signal: abortController.current.signal,
          headers: {
            'Authorization': `Bearer ${refreshData.session.access_token}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!retryResponse.ok) {
          console.error(`Retry failed with status ${retryResponse.status}`);
          return null;
        }

        return await retryResponse.json();
      }

      if (!response.ok) {
        console.error(`Request failed with status ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return null;
      }
      console.error('Fetch error:', error);
      return null;
    } finally {
      isFetching.current = false;
      abortController.current = null;
    }
  };

  // Check session on mount and when it changes
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      }
    };
    
    checkSession();
  }, [navigate]);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      if (event === 'SIGNED_OUT') {
        navigate('/login');
      } else if (event === 'TOKEN_REFRESHED') {
        // Refresh the page data
        loadAllData();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session) {
      loadAllData();
    } else {
      setLoading(false);
    }

    // Cleanup on unmount
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [session]);

  const loadAllData = async () => {
    // Prevent multiple simultaneous loads
    if (loading) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchSubmissions(),
        fetchUserTickets(),
        fetchVoted()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      console.log('Fetching submissions...');
      const data = await fetchWithAuth(`${API_URL}/api/votes/pending`);
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
        // Refresh submissions to update counts
        fetchSubmissions();
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