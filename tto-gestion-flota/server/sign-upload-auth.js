require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
const jwt = require('jsonwebtoken'); // npm i jsonwebtoken
const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY; // keep secret (service_role)
const SIGN_UPLOAD_API_KEY = process.env.SIGN_UPLOAD_API_KEY || null; // optional simple api-key
const SIGN_UPLOAD_JWT_SECRET = process.env.SIGN_UPLOAD_JWT_SECRET || null; // optional JWT secret to validate incoming user tokens

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_URL and SERVICE_ROLE_KEY must be set in environment. See server/.env.example');
}

// Authentication middleware
function authenticateRequest(req, res, next) {
  // Option 1: x-api-key header
  const apiKeyHeader = req.header('x-api-key');
  if (SIGN_UPLOAD_API_KEY && apiKeyHeader && apiKeyHeader === SIGN_UPLOAD_API_KEY) {
    return next();
  }

  // Option 2: Bearer JWT validated with SIGN_UPLOAD_JWT_SECRET (HMAC)
  const auth = req.header('authorization') || '';
  if (SIGN_UPLOAD_JWT_SECRET && auth.startsWith('Bearer ')) {
    const token = auth.substring(7).trim();
    try {
      const payload = jwt.verify(token, SIGN_UPLOAD_JWT_SECRET);
      req.user = payload;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'invalid_token' });
    }
  }

  return res.status(401).json({ error: 'unauthorized', message: 'No valid authentication method configured or token missing.' });
}

// POST /api/sign-upload (authenticated)
app.post('/api/sign-upload', authenticateRequest, async (req, res) => {
  try {
    const { bucket = 'ttocc-archivos', path, expires = 600 } = req.body || {};
    if (!path) return res.status(400).json({ error: 'path is required' });

    const signUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
    const signRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ expires_in: expires })
    });

    const text = await signRes.text();
    if (!signRes.ok) return res.status(signRes.status).send(text);

    const data = JSON.parse(text);
    return res.json({ signedUrl: data.signedURL });
  } catch (err) {
    console.error('Error in /api/sign-upload', err);
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sign service (auth) listening on ${PORT}`));
