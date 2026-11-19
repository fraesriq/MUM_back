const express = require('express');
require('../config/zod');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./index');
const errorMiddleware = require('../middlewares/error.middleware');
const rateLimit = require('express-rate-limit');
const { createAuthConfig } = require('../auth/config');
const { createApplicationTokenMiddleware, requireScope } = require('../auth/application.middleware');
const { createTokenHandler } = require('../auth/oauth.controller');
const clientRepository = require('../auth/client.repository');
const pool = require('../config/database');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const authConfig = createAuthConfig(require('../config/env').auth);
const oauthLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    error: 'temporarily_unavailable',
    error_description: 'El servicio de autorización no está disponible temporalmente.',
  }),
});

app.get('/health/live', (req, res) => res.json({ status: 'live' }));
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

app.post('/oauth/token', oauthLimiter, createTokenHandler({ authConfig, clientRepository }));

app.use('/api/v1', createApplicationTokenMiddleware({ authConfig, clientRepository }), requireScope('catalog:read'), routes);

app.use(errorMiddleware);

module.exports = app;
