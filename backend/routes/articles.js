import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

export default function articleRoutes(supabase) {
  
  // Test route
  router.get('/test', (req, res) => {
    res.json({ message: 'Articles route is working' });
  });

  // Get featured articles (most pushed, time-decay)
  router.get('/featured', async (req, res) => {
    try {
      // Simple ranking: push_count / days_since_published
      const { data, error } = await supabase
        .from('articles')
        .select(`
          *,
          author:author_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .order('push_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get recent articles
  router.get('/recent', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          *,
          author:author_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .order('published_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get articles for a specific artwork
  router.get('/artwork/:artworkId', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          *,
          author:author_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .contains('artwork_ids', [req.params.artworkId])
        .order('push_count', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get single article
  router.get('/:id', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          *,
          author:author_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('id', req.params.id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: 'Article not found' });
    }
  });

  // Create article
  router.post('/', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { title, body, artworkIds } = req.body;

      // Check if user has approved artworks (can write)
      const { data: artworks } = await supabase
        .from('artworks')
        .select('id')
        .eq('artist_id', decoded.userId)
        .eq('is_approved', true)
        .limit(1);

      if (!artworks || artworks.length === 0) {
        throw new Error('Must have approved artwork to write');
      }

      const { data, error } = await supabase
        .from('articles')
        .insert({
          title,
          body,
          author_id: decoded.userId,
          artwork_ids: artworkIds || []
        })
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update article
  router.put('/:id', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { title, body, artworkIds } = req.body;

      // Check ownership
      const { data: article } = await supabase
        .from('articles')
        .select('author_id')
        .eq('id', req.params.id)
        .single();

      if (!article) throw new Error('Article not found');
      if (article.author_id !== decoded.userId) throw new Error('Not authorized');

      const { data, error } = await supabase
        .from('articles')
        .update({
          title,
          body,
          artwork_ids: artworkIds,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete article
  router.delete('/:id', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check ownership
      const { data: article } = await supabase
        .from('articles')
        .select('author_id')
        .eq('id', req.params.id)
        .single();

      if (!article) throw new Error('Article not found');
      if (article.author_id !== decoded.userId) throw new Error('Not authorized');

      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', req.params.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}