import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

export default function pushRoutes(supabase) {
  
  // Test route
  router.get('/test', (req, res) => {
    res.json({ message: 'Pushes route is working' });
  });

  // Push an article
  router.post('/article/:articleId', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user has push tickets
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_tickets')
        .eq('id', decoded.userId)
        .single();

      if (!profile || profile.push_tickets <= 0) {
        throw new Error('No push tickets remaining');
      }

      // Check if already pushed
      const { data: existing } = await supabase
        .from('article_pushes')
        .select('*')
        .eq('article_id', req.params.articleId)
        .eq('user_id', decoded.userId)
        .single();

      if (existing) {
        throw new Error('Already pushed this article');
      }

      // Insert push
      const { error } = await supabase
        .from('article_pushes')
        .insert({
          article_id: req.params.articleId,
          user_id: decoded.userId
        });

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get user's push history
  router.get('/my-pushes', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const { data, error } = await supabase
        .from('article_pushes')
        .select('*, articles(title)')
        .eq('user_id', decoded.userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}