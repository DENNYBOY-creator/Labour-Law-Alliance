// Vercel Serverless Function: records one anonymous page view for the CRM's Website tab.
// No cookies, no IP address and no personal data are stored: only the page, the traffic source,
// device type and the city/country Vercel derives from the request.
import { classify, hostOf } from './_source.js';

const SUPABASE_URL = 'https://ktsvmkfrrxuijmgjdbwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E-C0YA_K3UpDWbbWqS9Lng__7pR26p9';
const BOTS = /bot|crawl|spider|slurp|preview|monitor|lighthouse|headless|pingdom|uptime|facebookexternalhit|whatsapp\/|curl|wget|python|axios|node-fetch/i;
const clean = (v, n) => String(v ?? '').trim().slice(0, n);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(204).end();
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOTS.test(ua)) return res.status(204).end();

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  let path = clean(b.p, 300);
  if (!path.startsWith('/') || path.startsWith('/admin') || path.startsWith('/api')) return res.status(204).end();
  path = path.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';

  const width = Number(b.w) || 0;
  const device = /iPad|Tablet/i.test(ua) || (width >= 600 && width < 1024 && /Mobi|Android/i.test(ua)) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) || (width && width < 600) ? 'mobile' : 'desktop';
  let city = clean(req.headers['x-vercel-ip-city'], 80);
  try { city = decodeURIComponent(city); } catch {}

  const row = {
    path,
    source: classify(b.r, b.us, b.um),
    referrer_host: hostOf(b.r) || null,
    utm_campaign: clean(b.uc, 100) || null,
    device,
    country: clean(req.headers['x-vercel-ip-country'], 2) || null,
    city: city || null,
    session: clean(b.s, 40) || null,
    landing: !!b.l,
  };
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (err) { console.error('track failed', err); }
  return res.status(204).end();
}
