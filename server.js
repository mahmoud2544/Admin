import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import contentRouter from './routes/content.js';
import mediaRouter from './routes/media.js';
import contactRouter from './routes/contact.js';
import analyticsRouter from './routes/analytics.js';
import trackRouter from './routes/track.js';
import authRouter from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Allow vaneymedia.com (a different host) to call these APIs.
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/content', contentRouter);
app.use('/api/media', mediaRouter);
app.use('/api/contact', contactRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/track', trackRouter);
app.use('/api/auth', authRouter);

// The admin panel itself (and tracker.js) are served as static files.
app.use(express.static(path.join(__dirname, 'public')));

// Anything else falls back to the panel (it's a single-page app).
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vaney Media server listening on port ${PORT}`);
});
