import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(cors({
  origin: ['https://galerie-eight.vercel.app', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Test routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'server working' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
import authRoutes from './routes/auth.js';
import artworkRoutes from './routes/artworks.js';
import roomRoutes from './routes/rooms.js';
import exhibitionRoutes from './routes/exhibitions.js';
import voteRoutes from './routes/votes.js';
import kinshipRoutes from './routes/kinship.js';
import searchRoutes from './routes/search.js';
import articleRoutes from './routes/articles.js';
import pushRoutes from './routes/pushes.js';

// Use routes
app.use('/api/auth', authRoutes(supabase, supabaseAdmin));
app.use('/api/artworks', artworkRoutes(supabase, supabaseAdmin));
app.use('/api/rooms', roomRoutes(supabase));
app.use('/api/exhibitions', exhibitionRoutes(supabase));
app.use('/api/votes', voteRoutes(supabase));
app.use('/api/kinship', kinshipRoutes(supabase));
app.use('/api/search', searchRoutes(supabase));
app.use('/api/articles', articleRoutes()); // Note: no supabase passed
app.use('/api/pushes', pushRoutes(supabase));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

export default app;