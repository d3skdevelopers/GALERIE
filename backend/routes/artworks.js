import express from 'express';

const router = express.Router();

export default function artworkRoutes(supabase, supabaseAdmin) {

  const getUser = async (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid or expired token');
    return user;
  };

  // GET all approved artworks
  router.get('/', async (req, res) => {
    try {
      const { limit = 50, offset = 0, artist_id } = req.query;
      let query = supabase
        .from('artworks')
        .select(`*, artist:profiles!artworks_artist_id_fkey(username, full_name, avatar_url)`)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (artist_id) query = query.eq('artist_id', artist_id);

      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET single artwork
  router.get('/:id', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('artworks')
        .select(`*, artist:profiles!artworks_artist_id_fkey(username, full_name, avatar_url)`)
        .eq('id', req.params.id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: 'Artwork not found' });
    }
  });

  // PUT transfer ownership
  router.put('/:id/transfer', async (req, res) => {
    try {
      const user = await getUser(req);
      const { newOwnerId } = req.body;

      if (!newOwnerId) return res.status(400).json({ error: 'newOwnerId is required' });

      const { data: artwork } = await supabase
        .from('artworks')
        .select('owned_by')
        .eq('id', req.params.id)
        .single();

      if (!artwork) return res.status(404).json({ error: 'Artwork not found' });
      if (artwork.owned_by !== user.id) return res.status(403).json({ error: 'Not the owner' });

      const { data, error } = await supabase
        .from('artworks')
        .update({ owned_by: newOwnerId })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

