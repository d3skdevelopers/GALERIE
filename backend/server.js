import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json());

// Test routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import all routes
import authRoutes from './routes/auth.js';
import artworkRoutes from './routes/artworks.js';
import roomRoutes from './routes/rooms.js';
import exhibitionRoutes from './routes/exhibitions.js';
import voteRoutes from './routes/votes.js';
import kinshipRoutes from './routes/kinship.js';
import searchRoutes from './routes/search.js';

// Use all routes
app.use('/api/auth', authRoutes(supabase, supabaseAdmin));
app.use('/api/artworks', artworkRoutes(supabase, supabaseAdmin));
app.use('/api/rooms', roomRoutes(supabase));
app.use('/api/exhibitions', exhibitionRoutes(supabase));
app.use('/api/votes', voteRoutes(supabase));
app.use('/api/kinship', kinshipRoutes(supabase));
app.use('/api/search', searchRoutes(supabase));

export default app;