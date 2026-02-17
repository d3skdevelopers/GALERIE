import express from 'express';

const router = express.Router();

// This is the absolute simplest version
export default function articleRoutes() {
  
  // GET test
  router.get('/test', (req, res) => {
    res.json({ message: 'articles route works' });
  });

  // POST test - accepts anything
  router.post('/', (req, res) => {
    res.json({ 
      success: true, 
      received: req.body,
      message: 'post received'
    });
  });

  return router;
}