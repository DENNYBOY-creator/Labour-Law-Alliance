// Vercel Serverless Function, run every morning by Vercel Cron (see vercel.json):
//  1. emails clients a reminder about tomorrow's confirmed appointments (each one only once), and
//  2. emails the office today's agenda.
// Needs the Vercel environment variable REMINDER_KEY, copied from CRM → Company settings → Calendar & reminders.
// Calling it by hand is harmless: it never returns personal data and never sends the same reminder twice.
const SUPABASE_URL = 'https://ktsvmkfrrxuijmgjdbwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E-C0YA_K3UpDWbbWqS9Lng__7pR26p9';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (d) => new Date(d).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const time = (d) => new Date(d).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' });
const rpc = (fn, body) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function shell(title, inner, footer) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="margin:0;background:#f1f1f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f1"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#fff">
<tr><td height="8" style="height:8px;line-height:8px;font-size:0;background:#16203b;background-image:linear-gradient(90deg,#16203b 0%,#349cfc 35%,#d3a728 70%,#fd5d14 100%)">&nbsp;</td></tr>
<tr><td style="padding:28px 36px 6px"><img src="https://labourlawalliance.co.za/assets/images/logo.png?v=2" width="150" alt="Labour Law Alliance" style="display:block;border:0"></td></tr>
<tr><td style="padding:14px 36px 26px;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#1d1d1d">${inner}</td></tr>
<tr><td style="padding:14px 36px;background:#16203b;font-family:Arial,sans-serif;font-size:12px;color:#c9cfdb">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const { REMINDER_KEY, RESEND_API_KEY, CONTACT_FROM, CONTACT_TO } = process.env;
  if (!REMINDER_KEY) return res.status(200).json({ configured: false });
  if (!RESEND_API_KEY || !CONTACT_FROM) return res.status(200).json({ configured: false, error: 'Email is not configured.' });

  let data;
  try { const r = await rpc('reminders_due', { p_key: REMINDER_KEY }); data = r.ok ? await r.json() : null; } catch (err) { console.error(err); }
  if (!data) return res.status(200).json({ configured: false, error: 'REMINDER_KEY does not match the CRM. Copy it again from Company settings.' });

  const office = String(CONTACT_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const send = async (to, subject, html, text, replyTo) => {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: CONTACT_FROM, to: [to], reply_to: replyTo, subject, html, text }) });
    if (!r.ok) console.error('Resend error', r.status, await r.text());
    return r.ok;
  };
  const f = data.firm || {};
  let reminded = 0, agendaSent = false;

  if (data.enabled) {
    const done = [];
    for (const a of data.reminders || []) {
      const where = a.location ? (/teams|video|online/i.test(a.location) ? 'by video call (we will send the link)' : /phone/i.test(a.location) ? 'by phone (we will call you)' : `at ${a.location}`) : '';
      const what = a.kind === 'ccma' ? 'your CCMA / bargaining council date' : a.kind === 'court' ? 'your Labour Court date' : 'your appointment with us';
      const inner = `<p>Dear ${esc(a.name || 'Sir/Madam')},</p><p>This is a reminder of ${what} <b>tomorrow, ${esc(when(a.starts_at))}</b>${where ? ' ' + esc(where) : ''}.</p>` +
        (a.kind === 'consultation' ? '<p>Please bring your employment contract, any letters from your employer (such as a notice of hearing or dismissal letter) and your last three payslips.</p>' : '') +
        `<p>If you need to change the time, reply to this email or call ${esc(f.phone || '')}.</p><p>Kind regards,<br>${esc(f.name || 'Labour Law Alliance')}</p>`;
      const ok = await send(a.email, `Reminder: ${a.kind === 'ccma' || a.kind === 'court' ? 'your date' : 'your appointment'} tomorrow at ${time(a.starts_at)}`, shell('Reminder', inner, `${esc(f.address1 || '')}, ${esc(f.address2 || '')} · Calls ${esc(f.phone || '')} · WhatsApp ${esc(f.whatsapp || '')}`), `Reminder: ${when(a.starts_at)} ${where}\nTo change it, reply or call ${f.phone || ''}.`, office[0]);
      if (ok) done.push(a.id);
    }
    if (done.length) { await rpc('mark_reminded', { p_key: REMINDER_KEY, p_ids: done }); reminded = done.length; }
  }

  if (data.agenda_enabled && office.length && (data.agenda || []).length) {
    const rows = data.agenda.map((x) => `<tr><td style="padding:6px 10px 6px 0;font-family:Arial,sans-serif;font-size:13px;color:#555;white-space:nowrap;vertical-align:top">${x.status === 'deadline' ? 'Due today' : esc(time(x.at))}</td><td style="padding:6px 0;font-size:15px">${esc(x.title)}${x.ref ? ` <span style="color:#777">(${esc(x.ref)})</span>` : ''}${x.location ? `<br><span style="font-size:13px;color:#777">${esc(x.location)}</span>` : ''}${x.status === 'provisional' ? ' <span style="color:#b46a00">· to confirm</span>' : ''}</td></tr>`).join('');
    agendaSent = await send(office[0], `Today: ${data.agenda.length} item${data.agenda.length > 1 ? 's' : ''} in the diary`, shell('Today', `<p style="margin-top:0"><b>Today’s diary</b></p><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table><p><a href="https://labourlawalliance.co.za/admin#deadlines" style="color:#1a5fb4">Open the CRM</a></p>`, 'Sent every morning by the Labour Law Alliance CRM.'), data.agenda.map((x) => `${x.status === 'deadline' ? 'Due' : time(x.at)} ${x.title}`).join('\n'));
  }
  return res.status(200).json({ configured: true, reminded, agendaSent });
}
