import express from 'express';

const router = express.Router();

export default function kinshipRoutes(supabase) {
  
  // Test route
  router.get('/test', (req, res) => {
    res.json({ message: 'Kinship route is working' });
  });

  // Get kinship map for an artwork
  router.get('/:artworkId', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('kinship')
        .select(`
          *,
          artwork_a:artwork_a_id (*, profiles(username)),
          artwork_b:artwork_b_id (*, profiles(username))
        `)
        .or(`artwork_a_id.eq.${req.params.artworkId},artwork_b_id.eq.${req.params.artworkId}`)
        .order('similarity_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Trigger kinship calculation (admin only - placeholder)
  router.post('/calculate/:artworkId', async (req, res) => {
    try {
      // This would call your kinship algorithm
      res.json({ message: 'Kinship calculation triggered (placeholder)' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}