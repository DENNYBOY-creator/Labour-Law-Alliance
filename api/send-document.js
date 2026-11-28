// Vercel Serverless Function: lets signed-in CRM staff email a quote or invoice to a client through Resend.
// The caller must send their Supabase session token; we confirm they are active staff before sending.
// Uses the same environment variables as contact.js: RESEND_API_KEY, CONTACT_TO, CONTACT_FROM.

const SUPABASE_URL = 'https://ktsvmkfrrxuijmgjdbwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E-C0YA_K3UpDWbbWqS9Lng__7pR26p9';
const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in first.' });

  // Who is calling, and are they staff?
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    const s = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_staff`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!s.ok || (await s.json()) !== true) return res.status(403).json({ error: 'Only staff can send documents.' });
  } catch (err) {
    console.error('Auth check failed', err);
    return res.status(502).json({ error: 'Could not check your sign-in. Try again.' });
  }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  const to = String(b.to || '').trim().slice(0, 200);
  const subject = String(b.subject || '').trim().slice(0, 200);
  const html = String(b.html || '').slice(0, 200000);
  const text = String(b.text || '').slice(0, 20000);
  if (!emailOk(to)) return res.status(400).json({ error: 'The client has no valid email address.' });
  if (!subject || !html) return res.status(400).json({ error: 'Nothing to send.' });

  const { RESEND_API_KEY, CONTACT_TO, CONTACT_FROM } = process.env;
  if (!RESEND_API_KEY || !CONTACT_FROM) return res.status(500).json({ error: 'Email is not configured.' });
  const office = (CONTACT_TO || '').split(',').map((x) => x.trim()).filter(emailOk);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: CONTACT_FROM, to: [to], bcc: office.length ? office : undefined, reply_to: office[0] || undefined, subject, html, text: text || undefined }),
    });
    if (!r.ok) { console.error('Resend error', r.status, await r.text()); return res.status(502).json({ error: 'The email could not be sent.' }); }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend failed', err);
    return res.status(502).json({ error: 'The email could not be sent.' });
  }
}
