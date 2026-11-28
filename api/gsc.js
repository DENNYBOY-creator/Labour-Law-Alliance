// Vercel Serverless Function: Google Search Console data for the CRM's Website tab.
// Setup: create a Google Cloud service account with the Search Console API enabled, add its email as a
// user on the labourlawalliance.co.za property, and paste its JSON key into the Vercel environment
// variable GSC_SERVICE_ACCOUNT. Without it, this returns { connected: false }.
import { createSign } from 'node:crypto';
import { denyUnlessStaff } from './_auth.js';

const SITE = 'sc-domain:labourlawalliance.co.za';
let cached = { token: null, exp: 0 };

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function accessToken(sa) {
  if (cached.token && cached.exp > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256'); signer.update(`${head}.${claims}`);
  const jwt = `${head}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || 'Google sign-in failed');
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function query(token, body) {
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Search Console query failed');
  return j.rows || [];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (await denyUnlessStaff(req, res)) return;
  const raw = process.env.GSC_SERVICE_ACCOUNT;
  if (!raw) return res.status(200).json({ connected: false });
  let sa;
  try { sa = JSON.parse(raw); } catch { return res.status(200).json({ connected: false, error: 'GSC_SERVICE_ACCOUNT is not valid JSON. Paste the whole key file.' }); }

  const days = Math.min(Math.max(Number(req.query.days) || 28, 7), 90);
  const end = new Date(Date.now() - 2 * 864e5); // Search Console data lags about 2 days
  const start = new Date(end.getTime() - (days - 1) * 864e5);
  const d = (x) => x.toISOString().slice(0, 10);
  const base = { startDate: d(start), endDate: d(end) };
  try {
    const token = await accessToken(sa);
    const [byDate, queries, pages, pageQueries] = await Promise.all([
      query(token, { ...base, dimensions: ['date'], rowLimit: 100 }),
      query(token, { ...base, dimensions: ['query'], rowLimit: 50 }),
      query(token, { ...base, dimensions: ['page'], rowLimit: 100 }),
      query(token, { ...base, dimensions: ['page', 'query'], rowLimit: 500 }),
    ]);
    const map = (rows, keys) => rows.map((r) => { const o = { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }; keys.forEach((k, i) => { o[k] = r.keys[i]; }); return o; });
    return res.status(200).json({ connected: true, account: sa.client_email, start: base.startDate, end: base.endDate, byDate: map(byDate, ['date']), queries: map(queries, ['query']), pages: map(pages, ['page']), pageQueries: map(pageQueries, ['page', 'query']) });
  } catch (err) {
    console.error('GSC failed', err);
    return res.status(200).json({ connected: false, error: String(err.message || err) });
  }
}
