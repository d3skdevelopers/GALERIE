import express from 'express';

const router = express.Router();

export default function pushRoutes(supabase, supabaseAdmin) {

  const getUser = async (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid or expired token');
    return user;
  };

  // POST push an article
  router.post('/article/:articleId', async (req, res) => {
    try {
      const user = await getUser(req);

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('push_tickets')
        .eq('id', user.id)
        .single();

      if (!profile || profile.push_tickets <= 0) {
        return res.status(400).json({ error: 'No push tickets remaining this week' });
      }

      const { data: existing } = await supabaseAdmin
        .from('article_pushes')
        .select('id')
        .eq('article_id', req.params.articleId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) return res.status(400).json({ error: 'Already pushed this article' });

      const { data: article } = await supabaseAdmin
        .from('articles')
        .select('id, push_count')
        .eq('id', req.params.articleId)
        .single();

      if (!article) return res.status(404).json({ error: 'Article not found' });

      const { error: pushError } = await supabaseAdmin
        .from('article_pushes')
        .insert({ article_id: req.params.articleId, user_id: user.id });

      if (pushError) throw pushError;

      await supabaseAdmin
        .from('articles')
        .update({ push_count: (article.push_count || 0) + 1 })
        .eq('id', req.params.articleId);

      await supabaseAdmin
        .from('profiles')
        .update({ push_tickets: profile.push_tickets - 1 })
        .eq('id', user.id);

      res.json({ success: true, ticketsRemaining: profile.push_tickets - 1 });
    } catch (error) {
      console.error('Push error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // GET user's own push history
  router.get('/my-pushes', async (req, res) => {
    try {
      const user = await getUser(req);
      const { data, error } = await supabaseAdmin
        .from('article_pushes')
        .select('*, articles(id, title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
