import express from 'express';

const router = express.Router();

export default function articleRoutes(supabase) {
  
  // GET test
  router.get('/test', (req, res) => {
    res.json({ message: 'articles route works' });
  });

  // POST - create article
  router.post('/', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'No token' });
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { title, body, artworkIds } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({ error: 'Title and body required' });
      }

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

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET featured articles
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

  // GET recent articles
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

  // GET articles for a specific artwork
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

  // GET single article
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

  // UPDATE article
  router.put('/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
      
      const token = authHeader.split(' ')[1];
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

      const { title, body, artworkIds } = req.body;

      const { data: article } = await supabase
        .from('articles')
        .select('author_id')
        .eq('id', req.params.id)
        .single();

      if (!article) return res.status(404).json({ error: 'Article not found' });
      if (article.author_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

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

  // DELETE article
  router.delete('/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
      
      const token = authHeader.split(' ')[1];
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

      const { data: article } = await supabase
        .from('articles')
        .select('author_id')
        .eq('id', req.params.id)
        .single();

      if (!article) return res.status(404).json({ error: 'Article not found' });
      if (article.author_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

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