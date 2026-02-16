import multer from 'multer';
import path from 'path';

const upload = multer({ dest: 'uploads/' });

export default function artworkRoutes(supabase, supabaseAdmin) {
  const router = express.Router();

  // Get all approved artworks
  router.get('/', async (req, res) => {
    const { data, error } = await supabase
      .from('artworks')
      .select('*, profiles(username, full_name)')
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  // Get single artwork
  router.get('/:id', async (req, res) => {
    const { data, error } = await supabase
      .from('artworks')
      .select('*, profiles(username, full_name)')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error });
    res.json(data);
  });

  // Upload new artwork (goes to voting)
  router.post('/', upload.single('file'), async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { title, description, year, medium } = req.body;
      const file = req.file;

      // In production, upload to storage bucket
      const fileUrl = `/uploads/${file.filename}`;

      const { data, error } = await supabase
        .from('artworks')
        .insert({
          title,
          artist_id: decoded.userId,
          description,
          year,
          medium,
          file_url: fileUrl,
          file_type: 'html',
          is_approved: false,
          owned_by: decoded.userId,
          voting_ends: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        })
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Transfer ownership
  router.put('/:id/transfer', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { newOwnerId } = req.body;

      // Check if current user owns it
      const { data: artwork } = await supabase
        .from('artworks')
        .select('owned_by')
        .eq('id', req.params.id)
        .single();

      if (artwork.owned_by !== decoded.userId) {
        throw new Error('Not owner');
      }

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