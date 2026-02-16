import express from 'express';

const app = express();

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;