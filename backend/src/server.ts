import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreboardRouter } from './routes/scoreboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use('/api', scoreboardRouter);

// Serve the built frontend so there's a single deployed URL to bookmark.
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Fantasy Dashboard backend listening on http://localhost:${port}`);
});
