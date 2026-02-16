export default function voteRoutes(supabase) {
  const router = express.Router();

  // Get artworks needing votes
  router.get('/pending', async (req, res) => {
    const { data, error } = await supabase
      .from('artworks')
      .select('*')
      .eq('is_approved', false)
      .gt('voting_ends', new Date().toISOString())
      .order('voting_ends', { ascending: true });

    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  // Cast vote
  router.post('/', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { artworkId, vote } = req.body; // vote = true (yes) or false (no)

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

  return router;
}