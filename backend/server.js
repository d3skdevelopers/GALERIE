import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'server working' });
});

// Direct article route - NO IMPORT, just here
app.post('/api/articles', (req, res) => {
  res.json({ 
    success: true, 
    received: req.body,
    message: 'direct post works' 
  });
});

app.get('/api/articles/test', (req, res) => {
  res.json({ message: 'direct test works' });
});

export default app;