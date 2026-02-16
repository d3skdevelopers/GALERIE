export default function exhibitionRoutes(supabase) {
  const router = express.Router();

  // Get all exhibitions
  router.get('/', async (req, res) => {
    const { data, error } = await supabase
      .from('exhibitions')
      .select('*')
      .eq('is_public', true)
      .order('opening_date', { ascending: false });

    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  // Get single exhibition with rooms
  router.get('/:id', async (req, res) => {
    const { data: exhibition, error: exError } = await supabase
      .from('exhibitions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (exError) return res.status(404).json({ error: exError });

    // Get rooms
    if (exhibition.room_ids?.length > 0) {
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .in('id', exhibition.room_ids);
      
      exhibition.rooms = rooms;
    }

    res.json(exhibition);
  });

  // Create exhibition
  router.post('/', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { title, description, roomIds, openingDate, closingDate } = req.body;

      const { data, error } = await supabase
        .from('exhibitions')
        .insert({
          title,
          description,
          curator_ids: [decoded.userId],
          room_ids: roomIds || [],
          opening_date: openingDate,
          closing_date: closingDate,
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