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
import routes from './routes.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

app.use('/api', routes);

app.listen(PORT, () => {
    console.log(`DB Agent Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
});
