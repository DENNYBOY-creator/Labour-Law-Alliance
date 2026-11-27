import { randomUUID } from 'node:crypto';
// Vercel Serverless Function: receives both website forms and emails them via Resend (https://resend.com).
// Required environment variables (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   your Resend API key
//   CONTACT_TO       where submissions go, e.g. info@labourlawalliance.co.za
//   CONTACT_FROM     a sender on a domain you verified in Resend, e.g. "Labour Law Alliance <website@labourlawalliance.co.za>"

const LIMITS = { first_name: 100, last_name: 100, email: 200, phone: 50, relationship: 20, region: 150, subject: 200, message: 5000, preferred_date: 60, preferred_time: 20, service: 150, meeting: 40 };

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

  const form = ['enquiry', 'booking'].includes(body.form) ? body.form : 'contact';
  const d = {};
  for (const [k, max] of Object.entries(LIMITS)) d[k] = clean(body[k], max);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email);
  if (form === 'contact') {
    if (!d.first_name || !d.last_name || !d.subject || !d.message || !emailOk) {
      return res.status(400).json({ error: 'Please complete all required fields.' });
    }
  } else if (form === 'booking') {
    if (!d.first_name || !d.last_name || !emailOk || !d.phone || !d.preferred_date || !d.preferred_time) {
      return res.status(400).json({ error: 'Please choose a date and time and complete all required fields.' });
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
  const subject = form === 'booking'
    ? `Appointment request – ${name} – ${d.preferred_date} ${d.preferred_time}`
    : form === 'enquiry'
    ? `New consultation enquiry – ${name}`
    : `Website contact: ${d.subject}`;

  const rows = form === 'booking'
    ? [["Full Name", name], ['Email Address', d.email], ['Phone Number', d.phone], ['Preferred Date', d.preferred_date], ['Preferred Time', d.preferred_time], ['Meeting Type', d.meeting], ['Service', d.service], ['Relationship to Matter', d.relationship], ['Message', d.message]]
    : form === 'enquiry'
    ? [["Full Name", name], ['Email Address', d.email], ['Phone Number', d.phone], ['Relationship to Matter', d.relationship], ['Region/Location', d.region], ['Nature of Request/Message', d.message]]
    : [["Full Name", name], ['Email Address', d.email], ['Subject', d.subject], ['Message', d.message]];

  const ref = randomUUID();
  const re = form === "booking" ? "Appointment Request" : form === "enquiry" ? "Consultation Enquiry" : "Contact Message";
  const intro = form === "booking"
    ? "A new appointment request has come in from the website."
    : form === "enquiry"
    ? "A new consultation enquiry has come in from the website."
    : "A new message has come in from the website contact form.";
  const html = renderEmail({ ref, re, intro, rows });
  const text = `YOUR REF: ${ref}\nRE: ${re}\n\n${intro}\n\n` + rows.map(([k, v]) => `${k}: ${v || '—'}`).join('\n');

  // Save the lead in the CRM and email the office at the same time.
  // The visitor sees success if at least one of the two worked, so no enquiry is lost.
  const [saved, emailed] = await Promise.all([saveLead(form, ref, d), sendEmail()]);
  if (!saved && !emailed) return res.status(502).json({ error: 'Could not send message.' });
  return res.status(200).json({ ok: true });

  async function sendEmail() {
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
      if (!r.ok) { console.error('Resend error', r.status, await r.text()); return false; }
      return true;
    } catch (err) {
      console.error('Resend failed', err);
      return false;
    }
  }
}

// ---- CRM (Supabase). The publishable key is public by design: database rules only let it ADD leads, never read them. ----
const SUPABASE_URL = 'https://ktsvmkfrrxuijmgjdbwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E-C0YA_K3UpDWbbWqS9Lng__7pR26p9';
const LEAD_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'relationship', 'region', 'service', 'subject', 'message', 'preferred_date', 'preferred_time', 'meeting'];

async function saveLead(form, ref, d) {
  const lead = { form, ref };
  for (const k of LEAD_FIELDS) if (d[k]) lead[k] = d[k];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(lead),
    });
    if (!r.ok) { console.error('Supabase error', r.status, await r.text()); return false; }
    return true;
  } catch (err) {
    console.error('Supabase failed', err);
    return false;
  }
}

// ---- Branded email layout (table-based with inline styles so it renders the same in Gmail and Outlook) ----
const SITE = 'https://labourlawalliance.co.za';
const FIRM = {
  logo: `${SITE}/assets/images/logo.png?v=2`,
  addr1: 'Prism Business Park, Ruby Cl',
  addr2: 'Fourways, Johannesburg, 2191',
  phone: '069 771 1060', tel: '+27697711060',
  wa: '068 008 9790', waLink: 'https://wa.me/27680089790',
  email: 'info@labourlawalliance.co.za',
  web: 'labourlawalliance.co.za',
};
const SERIF = "Georgia,'Times New Roman',Times,serif";
const SANS = "Arial,Helvetica,sans-serif";
const linkStyle = 'color:#1a5fb4;text-decoration:underline';

function cell(k, v) {
  let val = esc(v) || '&mdash;';
  if (v && /email/i.test(k)) val = `<a href="mailto:${esc(v)}" style="${linkStyle}">${esc(v)}</a>`;
  if (v && /phone/i.test(k)) val = `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}" style="${linkStyle}">${esc(v)}</a>`;
  return `<tr>
<td width="38%" valign="top" style="padding:12px 0;border-bottom:1px solid #e3e3e3;font-family:${SERIF};font-size:16px;line-height:1.5;font-weight:bold;color:#1d1d1d">${esc(k)}</td>
<td valign="top" style="padding:12px 0;border-bottom:1px solid #e3e3e3;font-family:${SERIF};font-size:16px;line-height:1.5;color:#1d1d1d;white-space:pre-wrap">${val}</td>
</tr>`;
}

function renderEmail({ ref, re, intro, rows }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(re)}</title></head>
<body style="margin:0;padding:0;background:#f1f1f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f1"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:10px 10px 0 0;overflow:hidden">
<tr><td height="8" style="height:8px;line-height:8px;font-size:0;background:#16203b;background-image:linear-gradient(90deg,#16203b 0%,#349cfc 35%,#d3a728 70%,#fd5d14 100%)">&nbsp;</td></tr>
<tr><td style="padding:36px 40px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" align="left" width="45%" style="padding-right:12px"><a href="https://${FIRM.web}"><img src="${FIRM.logo}" width="170" alt="Labour Law Alliance" style="display:block;width:170px;height:auto;border:0"></a></td>
    <td valign="middle" align="right" style="font-family:${SANS};font-size:13px;line-height:1.6;color:#444">
      ${FIRM.addr1}<br>${FIRM.addr2}<br>
      <a href="tel:${FIRM.tel}" style="color:#444;text-decoration:none">${FIRM.phone}</a> (calls)<br>
      <a href="${FIRM.waLink}" style="color:#444;text-decoration:none">${FIRM.wa}</a> (WhatsApp)<br><a href="mailto:${FIRM.email}" style="color:#444;text-decoration:none">${FIRM.email}</a>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:34px 40px 0;font-family:${SANS};font-size:13px;font-weight:bold;letter-spacing:2px;color:#a07a12">NEW FORM SUBMISSION</td></tr>
<tr><td style="padding:14px 40px 0"><div style="border-top:2px solid #1d1d1d;line-height:0;font-size:0">&nbsp;</div></td></tr>
<tr><td style="padding:30px 40px 0">
  <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:${SERIF};font-size:17px;color:#1d1d1d">
    <tr><td style="padding:4px 18px 4px 0;font-weight:bold;white-space:nowrap">YOUR REF</td><td style="padding:4px 0;word-break:break-all">: ${esc(ref)}</td></tr>
    <tr><td style="padding:4px 18px 4px 0;font-weight:bold">RE</td><td style="padding:4px 0">: ${esc(re)}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:26px 40px 8px;font-family:${SERIF};font-size:17px;color:#1d1d1d">${esc(intro)}</td></tr>
<tr><td style="padding:0 40px 36px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows.map(([k, v]) => cell(k, v)).join('\n')}
  </table>
</td></tr>
<tr><td style="padding:18px 40px;background:#16203b;font-family:${SANS};font-size:12px;line-height:1.6;color:#c9cfdb">
  Sent from the website form at <a href="https://${FIRM.web}" style="color:#d3a728;text-decoration:none">${FIRM.web}</a>. Reply to this email to respond to the sender directly.<br><a href="${SITE}/admin#lead=${esc(ref)}" style="color:#d3a728;text-decoration:none">Open this lead in the CRM &rarr;</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
