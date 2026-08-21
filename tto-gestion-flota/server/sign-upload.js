require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY; // keep secret (service_role)

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_URL and SERVICE_ROLE_KEY must be set in environment. See server/.env.example');
}

// POST /api/sign-upload
// Body: { bucket: 'ttocc-archivos', path: 'uploads/miarchivo.jpg', expires: 600 }
app.post('/api/sign-upload', async (req, res) => {
  try {
    // TODO: authenticate the caller here (JWT/session) before signing
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
    if (!signRes.ok) {
      // return the upstream body for debugging
      return res.status(signRes.status).send(text);
    }

    const data = JSON.parse(text);
    return res.json({ signedUrl: data.signedURL });
  } catch (err) {
    console.error('Error in /api/sign-upload', err);
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sign service listening on ${PORT}`));
