import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Supabase clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Import routes
import authRoutes from './routes/auth.js';
import artworkRoutes from './routes/artworks.js';
import roomRoutes from './routes/rooms.js';
import exhibitionRoutes from './routes/exhibitions.js';
import voteRoutes from './routes/votes.js';
import kinshipRoutes from './routes/kinship.js';

// Use routes
app.use('/api/auth', authRoutes(supabase, supabaseAdmin));
app.use('/api/artworks', artworkRoutes(supabase, supabaseAdmin));
app.use('/api/rooms', roomRoutes(supabase));
app.use('/api/exhibitions', exhibitionRoutes(supabase));
app.use('/api/votes', voteRoutes(supabase));
app.use('/api/kinship', kinshipRoutes(supabase));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`GALERIE backend running on port ${port}`);
});