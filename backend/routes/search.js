import express from 'express';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
}

export default function searchRoutes(supabase, supabaseAdmin) {

  router.get('/test', (req, res) => {
    res.json({ message: 'Search route is working' });
  });

  // GET text search across artworks, artists, articles
  router.get('/', async (req, res) => {
    try {
      const { q, type = 'all' } = req.query;
      if (!q || q.trim().length < 2) return res.json({ artworks: [], artists: [], articles: [] });

      const term    = q.trim();
      const results = { artworks: [], artists: [], articles: [] };

      if (type === 'all' || type === 'artworks') {
        const { data } = await supabaseAdmin
          .from('artworks')
          .select('*, profiles!artworks_artist_id_fkey(username, full_name)')
          .eq('is_approved', true)
          .or(`title.ilike.%${term}%,description.ilike.%${term}%,medium.ilike.%${term}%`)
          .limit(10);
        results.artworks = data || [];
      }

      if (type === 'all' || type === 'artists') {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${term}%,full_name.ilike.%${term}%,bio.ilike.%${term}%`)
          .limit(10);
        results.artists = data || [];
      }

      if (type === 'all' || type === 'articles') {
        const { data } = await supabaseAdmin
          .from('articles')
          .select('*, author:author_id(username, full_name)')
          .eq('is_draft', false)
          .or(`title.ilike.%${term}%,body.ilike.%${term}%`)
          .limit(10);
        results.articles = data || [];
      }

      res.json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // POST file-based similarity search
  router.post('/', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const fileExt = req.file.originalname.split('.').pop().toLowerCase();
      let queryFeatures = null;
      if (req.body?.features) {
        try { queryFeatures = JSON.parse(req.body.features); } catch {}
      }

      const { data: artworks } = await supabaseAdmin
        .from('artworks')
        .select('id, title, file_type, features, profiles!artworks_artist_id_fkey(username)')
        .eq('is_approved', true)
        .limit(200);

      if (!artworks || artworks.length === 0) {
        return res.json({ high: [], moderate: [], distant: [], method: 'none' });
      }

      const withVectors = artworks.filter(a => Array.isArray(a.features) && a.features.length > 0);
      const useVectors  = queryFeatures && withVectors.length > 0;

      const scored = artworks.map(artwork => {
        let score = 0;
        if (useVectors && Array.isArray(artwork.features) && artwork.features.length > 0) {
          score = cosineSimilarity(queryFeatures, artwork.features);
        } else {
          const isHtml    = ['html', 'htm', 'js'].includes(fileExt);
          const artIsHtml = ['html', 'htm', 'js'].includes(artwork.file_type || '');
          if (artwork.file_type === fileExt)  score = 0.60;
          else if (isHtml && artIsHtml)        score = 0.55;
          else                                 score = 0.10;
        }
        return { id: artwork.id, title: artwork.title, artist: `@${artwork.profiles?.username}`, score: Math.round(score * 100) };
      }).sort((a, b) => b.score - a.score);

      res.json({
        high:     scored.filter(r => r.score >= 70).slice(0, 5),
        moderate: scored.filter(r => r.score >= 40 && r.score < 70).slice(0, 5),
        distant:  scored.filter(r => r.score >= 15 && r.score < 40).slice(0, 5),
        method:   useVectors ? 'vector' : 'type-match'
      });
    } catch (error) {
      console.error('File search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  return router;
}
