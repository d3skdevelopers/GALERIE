import express from 'express';
import multer from 'multer';

const upload = multer({ dest: '/tmp' });
const router = express.Router();

export default function searchRoutes(supabase) {
  
  // Test route
  router.get('/test', (req, res) => {
    res.json({ message: 'Search route is working' });
  });

  // Search endpoint
  router.post('/', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // TODO: Implement actual kinship analysis
      // For now, return empty results
      
      res.json({
        high: [],
        moderate: [],
        distant: []
      });

    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  return router;
}