import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

export default function authRoutes(supabase, supabaseAdmin) {
  
  // Sign up
  router.post('/signup', async (req, res) => {
    try {
      const { email, password, username, fullName } = req.body;

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) throw authError;

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
          full_name: fullName,
          voting_tickets: 5
        });

      if (profileError) throw profileError;

      // Generate JWT
      const token = jwt.sign(
        { userId: authData.user.id, email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ token, user: authData.user });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Sign in
  router.post('/signin', async (req, res) => {
    try {
      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const token = jwt.sign(
        { userId: data.user.id, email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ token, user: data.user });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  // Get current user
  router.get('/me', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('No token');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (error) throw error;

      res.json(user);
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  return router;
}