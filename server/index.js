/**
 * @fileoverview Express Server Entry Point - Main HTTP server for Coolkonyha.
 * 
 * Configures Express application with:
 * - CORS for cross-origin requests
 * - Body parser for JSON payloads
 * - API routes under /api prefix
 * 
 * Server runs on port 3001 by default.
 * 
 * @see server/routes.js - API endpoints
 * @author Coolkonyha Development Team
 * @version 1.0.0
 */
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import routes from './routes.js';

const app = express();
const PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(cors());
app.use(bodyParser.json());

// Serve the canonical VERSION file (project root) as plain text.
// Registered before the public/ static middleware so it takes precedence
// over any same-named file that middleware would otherwise serve.
app.get('/VERSION', (req, res) => {
  res.type('text/plain').sendFile(join(__dirname, '..', 'VERSION'));
});

// Serve static assets (logos, etc.) from the public/ directory
app.use(express.static(join(__dirname, '..', 'public')));
// Serve ui_design directory for previewing designs
app.use('/ui_design', express.static(join(__dirname, '..', 'ui_design')));

// Serve the main SPA (index.html) at the root
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '..', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(join(__dirname, '..', 'index.html'));
});

app.use('/api', routes);

app.listen(PORT, () => {
    console.log(`DB Agent Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
});
