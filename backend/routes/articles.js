import express from 'express';

const router = express.Router();

export default function articleRoutes(supabase) {
  
  // Test GET
  router.get('/test', (req, res) => {
    res.json({ message: 'Articles route is working' });
  });

  // Test POST - no auth required
  router.post('/ping', (req, res) => {
    res.json({ 
      message: 'POST ping working',
      body: req.body,
      headers: req.headers['content-type']
    });
  });

  // Get featured articles
  router.get('/featured', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
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
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20);

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
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: 'Article not found' });
    }
  });

  // CREATE article - simplified version
  router.post('/', async (req, res) => {
    try {
      // Log everything for debugging
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);

      // Get auth header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'No token' });
      }

      // Get user from token
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        console.log('User error:', userError);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { title, body } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({ error: 'Title and body required' });
      }

      // Insert article
      const { data, error } = await supabase
        .from('articles')
        .insert({
          title,
          body,
          author_id: user.id,
          push_count: 0
        })
        .select()
        .single();

      if (error) throw error;
      
      res.json(data);
    } catch (error) {
      console.log('Server error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}