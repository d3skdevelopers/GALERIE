import express from 'express';

const router = express.Router();

export default function exhibitionRoutes(supabase, supabaseAdmin) {

  const getUser = async (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid or expired token');
    return user;
  };

  router.get('/', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('exhibitions')
        .select('*')
        .eq('is_public', true)
        .order('opening_date', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const { data: exhibition, error } = await supabaseAdmin
        .from('exhibitions')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error) throw error;

      if (exhibition.room_ids?.length > 0) {
        const { data: rooms } = await supabaseAdmin
          .from('rooms')
          .select('*')
          .in('id', exhibition.room_ids);
        exhibition.rooms = rooms || [];
      } else {
        exhibition.rooms = [];
      }

      res.json(exhibition);
    } catch (error) {
      res.status(404).json({ error: 'Exhibition not found' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const user = await getUser(req);
      const { title, description, roomIds, openingDate, closingDate } = req.body;

      if (!title) return res.status(400).json({ error: 'Title is required' });

      const { data, error } = await supabaseAdmin
        .from('exhibitions')
        .insert({
          title,
          description:  description || '',
          curator_ids:  [user.id],
          room_ids:     roomIds || [],
          opening_date: openingDate || new Date().toISOString().split('T')[0],
          closing_date: closingDate || null,
          is_public:    true
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
