import express from 'express';

const router = express.Router();

export default function authRoutes(supabase, supabaseAdmin) {

  // FIX: Helper to extract and verify Supabase token
  const getUser = async (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid or expired token');
    return user;
  };

  // FIX: Signup creates profile reliably via admin client
  router.post('/signup', async (req, res) => {
    try {
      const { email, password, username, fullName } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ error: 'Email, password, and username are required' });
      }

      // Check username not taken
      const { data: existing } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) throw authError;

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
          full_name: fullName || '',
          voting_tickets: 5,
          push_tickets: 10
        });

      if (profileError) {
        // Rollback: delete auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      // Sign in to get session
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;

      res.json({
        user: authData.user,
        session: sessionData.session
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/signin', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      res.json({ user: data.user, session: data.session });
    } catch (error) {
      console.error('Signin error:', error);
      res.status(401).json({ error: error.message });
    }
  });

  // FIX: /me uses Supabase token validation, returns full profile
  router.get('/me', async (req, res) => {
    try {
      const user = await getUser(req);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      res.json({ ...profile, email: user.email });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  // POST refresh voting tickets — enforces 7-day cooldown
  router.post('/refresh-tickets', async (req, res) => {
    try {
      const user = await getUser(req);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('last_ticket_refresh')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Enforce 7-day cooldown
      if (profile.last_ticket_refresh) {
        const daysSince = (Date.now() - new Date(profile.last_ticket_refresh).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          const daysLeft = Math.ceil(7 - daysSince);
          return res.status(429).json({
            error: `Tickets refresh weekly. ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`,
            daysRemaining: daysLeft
          });
        }
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          voting_tickets: 5,
          push_tickets: 10,
          last_ticket_refresh: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      res.json({ success: true, voting_tickets: 5, push_tickets: 10 });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
