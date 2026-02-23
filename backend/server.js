import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// FIX: Security headers
app.use(helmet({
  contentSecurityPolicy: false // Disabled so iframe artworks render
}));

// FIX: Rate limiting — prevents hammering the API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter for auth endpoints
  message: { error: 'Too many auth attempts, please try again later.' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// Validate env vars on startup
const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// FIX: Comprehensive CORS config
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'https://galerie-eight.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:4173'
    ];
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '10mb' }));

// Health checks
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working', timestamp: new Date().toISOString() });
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

// Mount routes
app.use('/api/auth', authRoutes(supabase, supabaseAdmin));
app.use('/api/artworks', artworkRoutes(supabase, supabaseAdmin));
app.use('/api/rooms', roomRoutes(supabase, supabaseAdmin));
app.use('/api/exhibitions', exhibitionRoutes(supabase, supabaseAdmin));
app.use('/api/votes', voteRoutes(supabase, supabaseAdmin));
app.use('/api/kinship', kinshipRoutes(supabase, supabaseAdmin));
app.use('/api/search', searchRoutes(supabase, supabaseAdmin));
app.use('/api/articles', articleRoutes(supabase, supabaseAdmin));
app.use('/api/pushes', pushRoutes(supabase, supabaseAdmin));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// FIX: Global error handler with proper format
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// FIX: Actually start the server (was missing in original)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GALERIE backend running on port ${PORT}`);
});

export default app;
