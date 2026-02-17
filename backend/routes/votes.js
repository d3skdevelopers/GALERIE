import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

export default function voteRoutes(supabase) {
  
  // Test route
  router.get('/test', (req, res) => {
    res.json({ message: 'Votes route is working' });
  });

  // Get artworks needing votes (excluding user's own)
  router.get('/pending', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const { data, error } = await supabase
        .from('artworks')
        .select('*, profiles(username)')
        .eq('is_approved', false)
        .gt('voting_ends', new Date().toISOString())
        .neq('artist_id', decoded.userId)
        .order('voting_ends', { ascending: true });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Cast vote
  router.post('/', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { artworkId, vote } = req.body;

      // Check if artwork exists and get artist_id
      const { data: artwork, error: artworkError } = await supabase
        .from('artworks')
        .select('artist_id')
        .eq('id', artworkId)
        .single();

      if (artworkError) throw new Error('Artwork not found');

      // Prevent voting on own work
      if (artwork.artist_id === decoded.userId) {
        throw new Error('Cannot vote on your own work');
      }

      // Check if already voted
      const { data: existing } = await supabase
        .from('votes')
        .select('*')
        .eq('artwork_id', artworkId)
        .eq('voter_id', decoded.userId)
        .single();

      if (existing) throw new Error('Already voted');

      // Insert vote
      const { error: voteError } = await supabase
        .from('votes')
        .insert({
          artwork_id: artworkId,
          voter_id: decoded.userId,
          vote
        });

      if (voteError) throw voteError;

      // Update artwork vote counts
      if (vote) {
        await supabase.rpc('increment_approval', { artwork_id: artworkId });
      } else {
        await supabase.rpc('increment_rejection', { artwork_id: artworkId });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get user's voting history
  router.get('/my-votes', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const { data, error } = await supabase
        .from('votes')
        .select('*, artworks(title)')
        .eq('voter_id', decoded.userId);

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}