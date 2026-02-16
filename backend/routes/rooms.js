export default function roomRoutes(supabase) {
  const router = express.Router();

  // Get all public rooms
  router.get('/', async (req, res) => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, spaces(name)')
      .eq('is_public', true)
      .order('created_at');

    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  // Get single room with artworks
  router.get('/:id', async (req, res) => {
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (roomError) return res.status(404).json({ error: roomError });

    // Get artwork details from layout
    const artworkIds = room.layout?.artworks?.map(a => a.id) || [];
    
    if (artworkIds.length > 0) {
      const { data: artworks } = await supabase
        .from('artworks')
        .select('*, profiles(username)')
        .in('id', artworkIds);
      
      room.artworks = artworks;
    } else {
      room.artworks = [];
    }

    res.json(room);
  });

  // Create room
  router.post('/', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { name, description, layout, spaceId } = req.body;

      const { data, error } = await supabase
        .from('rooms')
        .insert({
          name,
          description,
          layout: layout || { grid: [3, 3], artworks: [] },
          space_id: spaceId,
          created_by: decoded.userId,
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