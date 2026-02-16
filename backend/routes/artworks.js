import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';

const upload = multer({ dest: '/tmp' });
const router = express.Router();

export default function artworkRoutes(supabase, supabaseAdmin) {
  
  // Get all approved artworks
  router.get('/', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('artworks')
        .select('*, profiles(username, full_name)')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get single artwork
  router.get('/:id', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('artworks')
        .select('*, profiles(username, full_name)')
        .eq('id', req.params.id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: 'Artwork not found' });
    }
  });

  // Upload new artwork (goes to voting)
  router.post('/', upload.single('file'), async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { title, description, year, medium } = req.body;
      const file = req.file;

      if (!file) throw new Error('No file uploaded');

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
      const { data: artwork, error: fetchError } = await supabase
        .from('artworks')
        .select('owned_by')
        .eq('id', req.params.id)
        .single();

      if (fetchError) throw fetchError;
      if (artwork.owned_by !== decoded.userId) throw new Error('Not owner');

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