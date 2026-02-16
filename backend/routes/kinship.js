export default function kinshipRoutes(supabase) {
  const router = express.Router();

  // Get kinship map for an artwork
  router.get('/:artworkId', async (req, res) => {
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

    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  // Trigger kinship calculation (admin only)
  router.post('/calculate/:artworkId', async (req, res) => {
    // This would call your kinship algorithm
    // For now, return placeholder
    res.json({ message: 'Kinship calculation triggered' });
  });

  return router;
}