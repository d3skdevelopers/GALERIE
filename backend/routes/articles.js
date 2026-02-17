import express from 'express';

const router = express.Router();

export default function articleRoutes(supabase) {
  
  // Test route
  router.get('/test', (req, res) => {
    res.json({ message: 'Articles route is working' });
  });

  // Get featured articles (most pushed, time-decay)
  router.get('/featured', async (req, res) => {
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

  // Create article (simplified)
  router.post('/', async (req, res) => {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }
      
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // Get user from Supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        console.error('User error:', userError);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const { title, body, artworkIds } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({ error: 'Title and body required' });
      }

      // Optional: Check if user has approved artworks
      // You can enable this later if needed
      /*
      const { data: artworks } = await supabase
        .from('artworks')
        .select('id')
        .eq('artist_id', user.id)
        .eq('is_approved', true)
        .limit(1);

      if (!artworks || artworks.length === 0) {
        return res.status(403).json({ error: 'Must have approved artwork to write' });
      }
      */

      // Insert article
      const { data, error } = await supabase
        .from('articles')
        .insert({
          title,
          body,
          author_id: user.id,
          artwork_ids: artworkIds || [],
          push_count: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        return res.status(400).json({ error: error.message });
      }

      res.json(data);
    } catch (error) {
      console.error('Create article error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update article
  router.put('/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
      
      const token = authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'No token provided' });

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

      const { title, body, artworkIds } = req.body;

      // Check ownership
      const { data: article, error: fetchError } = await supabase
        .from('articles')
        .select('author_id')
        .eq('id', req.params.id)
        .single();

      if (fetchError || !article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      if (article.author_id !== user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

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
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
      
      const token = authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'No token provided' });

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

      // Check ownership
      const { data: article, error: fetchError } = await supabase
        .from('articles')
        .select('author_id')
        .eq('id', req.params.id)
        .single();

      if (fetchError || !article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      if (article.author_id !== user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

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