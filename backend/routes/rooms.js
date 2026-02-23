import express from 'express';

const router = express.Router();

export default function roomRoutes(supabase, supabaseAdmin) {

  const getUser = async (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid or expired token');
    return user;
  };

  // GET all public rooms
  router.get('/', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET single room with its artworks
  router.get('/:id', async (req, res) => {
    try {
      const { data: room, error: roomError } = await supabaseAdmin
        .from('rooms')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (roomError) throw roomError;

      const artworkIds = room.layout?.artworks?.map(a => a.id) || [];

      if (artworkIds.length > 0) {
        const { data: artworks } = await supabaseAdmin
          .from('artworks')
          .select('*, profiles(username)')
          .in('id', artworkIds);
        room.artworks = artworks || [];
      } else {
        const { data: artworks } = await supabaseAdmin
          .from('artworks')
          .select('*, profiles(username)')
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .limit(12);
        room.artworks = artworks || [];
      }

      res.json(room);
    } catch (error) {
      // Fallback for id='1' (Foyer link before rooms table is seeded)
      if (req.params.id === '1') {
        const { data: artworks } = await supabaseAdmin
          .from('artworks')
          .select('*, profiles(username)')
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .limit(12);

        return res.json({
          id: 1,
          name: 'Main Gallery',
          description: 'The seed collection',
          is_public: true,
          artworks: artworks || [],
          layout: { grid: [3, 4], artworks: [] }
        });
      }
      res.status(404).json({ error: 'Room not found' });
    }
  });

  // POST create a room
  router.post('/', async (req, res) => {
    try {
      const user = await getUser(req);
      const { name, description, layout } = req.body;

      const { data, error } = await supabaseAdmin
        .from('rooms')
        .insert({
          name,
          description,
          layout: layout || { grid: [3, 3], artworks: [] },
          created_by: user.id,
          is_public: true
        })
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
