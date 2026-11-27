// Vercel Serverless Function: receives both website forms and emails them via Resend (https://resend.com).
// Required environment variables (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   your Resend API key
//   CONTACT_TO       where submissions go, e.g. info@labourlawalliance.co.za
//   CONTACT_FROM     a sender on a domain you verified in Resend, e.g. "Labour Law Alliance <website@labourlawalliance.co.za>"

const LIMITS = { first_name: 100, last_name: 100, email: 200, phone: 50, relationship: 20, region: 150, subject: 200, message: 5000 };

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (body.website) return res.status(200).json({ ok: true });

  const form = body.form === 'enquiry' ? 'enquiry' : 'contact';
  const d = {};
  for (const [k, max] of Object.entries(LIMITS)) d[k] = clean(body[k], max);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email);
  if (form === 'contact') {
    if (!d.first_name || !d.last_name || !d.subject || !d.message || !emailOk) {
      return res.status(400).json({ error: 'Please complete all required fields.' });
    }
  } else if (d.email && !emailOk) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  } else if (!d.email && !d.phone) {
    return res.status(400).json({ error: 'Please give an email address or phone number.' });
  }

  const { RESEND_API_KEY, CONTACT_TO, CONTACT_FROM } = process.env;
  if (!RESEND_API_KEY || !CONTACT_TO || !CONTACT_FROM) {
    console.error('Form not configured: set RESEND_API_KEY, CONTACT_TO and CONTACT_FROM');
    return res.status(500).json({ error: 'Form is not configured yet.' });
  }

  const name = `${d.first_name} ${d.last_name}`.trim() || 'Website visitor';
  const subject = form === 'enquiry'
    ? `New consultation enquiry – ${name}`
    : `Website contact: ${d.subject}`;

  const rows = form === 'enquiry'
    ? [['Name', name], ['Email', d.email], ['Phone', d.phone], ['Relationship to Matter', d.relationship], ['Region/Location', d.region], ['Nature of Request/Message', d.message]]
    : [['Name', name], ['Email', d.email], ['Subject', d.subject], ['Message', d.message]];

  const html = `<h2 style="font-family:Arial,sans-serif">${esc(form === 'enquiry' ? 'Enquiry Form' : 'Contact Us')} – labourlawalliance.co.za</h2>
<table cellpadding="8" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="border:1px solid #ddd;background:#f7f7f7;font-weight:bold;vertical-align:top">${esc(k)}</td><td style="border:1px solid #ddd;white-space:pre-wrap">${esc(v) || '—'}</td></tr>`).join('\n')}
</table>`;
  const text = rows.map(([k, v]) => `${k}: ${v || '—'}`).join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: CONTACT_TO.split(',').map((s) => s.trim()),
        reply_to: emailOk ? d.email : undefined,
        subject,
        html,
        text,
      }),
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      return res.status(502).json({ error: 'Could not send message.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Could not send message.' });
  }
}
