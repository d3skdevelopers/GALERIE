import express from 'express';

const router = express.Router();

export default function voteRoutes(supabase, supabaseAdmin) {

  const getUser = async (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid or expired token');
    return user;
  };

  router.get('/test', (req, res) => {
    res.json({ message: 'Votes route is working' });
  });

  // GET all pending artworks for the voting queue
  // Uses supabaseAdmin to bypass RLS — pending works aren't publicly readable
  router.get('/pending', async (req, res) => {
    try {
      const user = await getUser(req);

      const { data: myVotes } = await supabaseAdmin
        .from('votes')
        .select('artwork_id')
        .eq('voter_id', user.id);

      const votedIds = (myVotes || []).map(v => v.artwork_id);

      let query = supabaseAdmin
        .from('artworks')
        .select('*, profiles!artworks_artist_id_fkey(username, full_name)')
        .eq('is_approved', false)
        .gt('voting_ends', new Date().toISOString())
        .neq('artist_id', user.id)
        .order('voting_ends', { ascending: true });

      if (votedIds.length > 0) {
        query = query.not('id', 'in', `(${votedIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({ pending: data || [] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST cast a vote — all DB ops use supabaseAdmin to bypass RLS
  router.post('/', async (req, res) => {
    try {
      const user = await getUser(req);
      const { artworkId, vote } = req.body;

      if (artworkId === undefined || vote === undefined) {
        return res.status(400).json({ error: 'artworkId and vote are required' });
      }

      const { data: artwork, error: artworkError } = await supabaseAdmin
        .from('artworks')
        .select('artist_id, voting_ends, is_approved, approval_votes, rejection_votes')
        .eq('id', artworkId)
        .single();

      if (artworkError || !artwork) return res.status(404).json({ error: 'Artwork not found' });
      if (artwork.artist_id === user.id) return res.status(400).json({ error: 'Cannot vote on your own work' });
      if (artwork.is_approved) return res.status(400).json({ error: 'Artwork already approved' });
      if (new Date(artwork.voting_ends) < new Date()) return res.status(400).json({ error: 'Voting period has ended' });

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('voting_tickets')
        .eq('id', user.id)
        .single();

      if (!profile || profile.voting_tickets <= 0) {
        return res.status(400).json({ error: 'No voting tickets remaining this week' });
      }

      const { data: existing } = await supabaseAdmin
        .from('votes')
        .select('id')
        .eq('artwork_id', artworkId)
        .eq('voter_id', user.id)
        .maybeSingle();

      if (existing) return res.status(400).json({ error: 'Already voted on this artwork' });

      const { error: voteError } = await supabaseAdmin
        .from('votes')
        .insert({ artwork_id: artworkId, voter_id: user.id, vote: Boolean(vote) });

      if (voteError) throw voteError;

      const field = vote ? 'approval_votes' : 'rejection_votes';
      const newCount = (artwork[field] || 0) + 1;

      await supabaseAdmin
        .from('artworks')
        .update({ [field]: newCount })
        .eq('id', artworkId);

      const approvals   = vote ? newCount : (artwork.approval_votes  || 0);
      const rejections  = vote ? (artwork.rejection_votes || 0) : newCount;

      if (approvals >= 5) {
        await supabaseAdmin
          .from('artworks')
          .update({ is_approved: true })
          .eq('id', artworkId);

        try {
          await supabaseAdmin.rpc('calculate_kinship', { p_artwork_id: artworkId });
        } catch (kinErr) {
          console.warn('Kinship calculation failed (non-fatal):', kinErr.message);
        }
      } else if (rejections >= 5) {
        await supabaseAdmin
          .from('artworks')
          .update({ voting_ends: new Date().toISOString() })
          .eq('id', artworkId);
      }

      await supabaseAdmin
        .from('profiles')
        .update({ voting_tickets: profile.voting_tickets - 1 })
        .eq('id', user.id);

      res.json({ success: true, ticketsRemaining: profile.voting_tickets - 1 });
    } catch (error) {
      console.error('Vote error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // GET user's own vote history
  router.get('/my-votes', async (req, res) => {
    try {
      const user = await getUser(req);
      const { data, error } = await supabaseAdmin
        .from('votes')
        .select('*, artworks(id, title)')
        .eq('voter_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  return router;
}
