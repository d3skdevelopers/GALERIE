import express from 'express';

const router = express.Router();

export default function articleRoutes(supabase, supabaseAdmin) {

  const getUser = async (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid or expired token');
    return user;
  };

  // POST create article
  router.post('/', async (req, res) => {
    try {
      const user = await getUser(req);
      const { title, body, artworkIds, isDraft } = req.body;

      if (!title || !body) {
        return res.status(400).json({ error: 'Title and body are required' });
      }

      const { data, error } = await supabaseAdmin
        .from('articles')
        .insert({
          title,
          body,
          author_id:   user.id,
          artwork_ids: artworkIds || [],
          push_count:  0,
          is_draft:    isDraft === true,
          published_at: new Date().toISOString()
        })
        .select('*, author:author_id(username, full_name, avatar_url)')
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error('Create article error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET featured articles (most pushed) — public, uses admin for cross-user read
  router.get('/featured', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('*, author:author_id(username, full_name, avatar_url)')
        .eq('is_draft', false)
        .order('push_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET recent articles
  router.get('/recent', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('*, author:author_id(username, full_name, avatar_url)')
        .eq('is_draft', false)
        .order('published_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET single article
  router.get('/:id', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('*, author:author_id(username, full_name, avatar_url)')
        .eq('id', req.params.id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: 'Article not found' });
    }
  });

  // GET articles by artwork
  router.get('/by-artwork/:artworkId', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('*, author:author_id(username, full_name, avatar_url)')
        .eq('is_draft', false)
        .contains('artwork_ids', [req.params.artworkId])
        .order('push_count', { ascending: false })
        .limit(10);

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET articles by author
  router.get('/by-author/:userId', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('*, author:author_id(username, full_name, avatar_url)')
        .eq('author_id', req.params.userId)
        .eq('is_draft', false)
        .order('published_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
