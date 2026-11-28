// Vercel Serverless Function, run every morning by Vercel Cron (see vercel.json):
//  1. emails clients a reminder about tomorrow's confirmed appointments (each one only once),
//  2. emails the office today's agenda,
//  3. creates the month's retainer invoices that are due and emails those marked for automatic sending, and
//  4. on the 1st (or the first run after it) emails partners last month's practice report.
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

const money = (n) => 'R ' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',');
const day = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

function invoiceBody(i, f) {
  const sub = Number(i.amount), vat = Math.round(sub * Number(i.vat_rate || 0)) / 100, total = sub + vat;
  const cell = 'padding:8px 6px;border-bottom:1px solid #e3e3e3;font-size:14px';
  const bank = f.bank_account ? `Bank: ${esc(f.bank_name || '')} · Account holder: ${esc(f.bank_holder || f.trading_name || '')}<br>Account no.: ${esc(f.bank_account)} · Branch code: ${esc(f.bank_branch || '')}${f.bank_type ? ' · ' + esc(f.bank_type) : ''}<br>Reference: ${esc(i.number)}` : 'Please contact us for our banking details.';
  return `<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;color:#a07a12">${f.vat_registered ? 'TAX INVOICE' : 'INVOICE'} ${esc(i.number)}</p>
<p>Dear ${esc(i.attention || i.client || 'Sir/Madam')},</p><p>Please find your invoice for ${esc(i.description.split(' · ').pop())} below.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0">
<tr><td style="${cell}"><b>${esc(i.client || '')}</b><br><span style="color:#666;font-size:13px">Date: ${day(i.issue_date)} · Due: ${day(i.due_date)}${f.vat_no ? ' · Our VAT no.: ' + esc(f.vat_no) : ''}</span></td></tr>
<tr><td style="${cell}">${esc(i.description)}<span style="float:right">${money(sub)}</span></td></tr>
${vat ? `<tr><td style="${cell}">VAT (${Number(i.vat_rate)}%)<span style="float:right">${money(vat)}</span></td></tr>` : ''}
<tr><td style="${cell};font-weight:bold">Total due<span style="float:right">${money(total)}</span></td></tr></table>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#444;line-height:1.6">${bank}</p>
${f.footer ? `<p style="font-size:13px;color:#666">${esc(f.footer)}</p>` : ''}<p>Kind regards,<br>${esc(f.trading_name || 'Labour Law Alliance')}</p>`;
}

function reportBody(r) {
  const row = (a, b) => `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e5e5">${a}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #e5e5e5"><b>${b}</b></td></tr>`;
  const label = new Date(r.month + 'T12:00:00Z').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
  return { label, html: `<p style="margin-top:0"><b>Practice report: ${esc(label)}</b></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px">
${row('New enquiries', r.enquiries)}${row('Became clients', r.became_clients)}${row('Matters opened', r.matters_opened)}${row('Matters closed', r.matters_closed)}${row('Matters open now', r.matters_open)}
${row('Fees billed', money(r.billed))}${row('Fees received', money(r.received))}${row('Received into trust', money(r.trust_in))}${row('Overdue now', money(r.overdue.total) + ' (' + r.overdue.count + ')')}</table>
<p style="margin-top:18px"><b>Where enquiries came from</b><br>${(r.sources || []).map((x) => esc(x.source) + ': ' + x.n).join(' · ') || 'No enquiries.'}</p>
<p style="margin-top:18px"><b>Time limits in the next 30 days</b></p>${(r.upcoming || []).length ? '<ul>' + r.upcoming.map((u) => `<li>${day(u.due)}: ${esc(u.title)}${u.ref ? ' (' + esc(u.ref) + ')' : ''}</li>`).join('') + '</ul>' : '<p>Nothing due.</p>'}
<p><a href="https://labourlawalliance.co.za/admin#dashboard" style="color:#1a5fb4">Open the CRM</a></p>` };
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
// Retainer invoices
let invoiced = 0, invoicesEmailed = 0;
try {
  const rr = await rpc('retainers_due', { p_key: REMINDER_KEY }); const rd = rr.ok ? await rr.json() : null;
  if (rd && rd.invoices) {
    invoiced = rd.invoices.length;
    const sent = [];
    for (const i of rd.invoices) {
      if (!i.email_auto || !i.email) continue;
      const ff = rd.firm || {};
      const ok = await send(i.email, `Invoice ${i.number} from ${ff.trading_name || 'Labour Law Alliance'}`, shell('Invoice ' + i.number, invoiceBody(i, ff), `${esc(ff.address1 || '')}, ${esc(ff.address2 || '')} · Calls ${esc(ff.phone || '')} · ${esc(ff.email || '')}`), `Invoice ${i.number}: ${i.description}. Due ${i.due_date}. Reply to this email with any questions.`, office[0]);
      if (ok) sent.push(i.id);
    }
    if (sent.length) { await rpc('mark_invoices_sent', { p_key: REMINDER_KEY, p_ids: sent }); invoicesEmailed = sent.length; }
  }
} catch (err) { console.error('Retainer invoices failed', err); }

// Monthly practice report
let reportSent = false;
try {
  const mr = await rpc('monthly_report_due', { p_key: REMINDER_KEY }); const rep = mr.ok ? await mr.json() : null;
  if (rep && rep.due) {
    const to = (rep.recipients || []).length ? rep.recipients : office;
    const b = reportBody(rep);
    let all = to.length > 0;
    for (const addr of to) { if (!(await send(addr, `Practice report: ${b.label}`, shell('Practice report', b.html, 'Sent on the 1st of each month by the Labour Law Alliance CRM. Turn it off in Company settings.'), `Practice report for ${b.label}: ${rep.enquiries} enquiries, ${rep.matters_opened} matters opened, fees billed ${money(rep.billed)}, received ${money(rep.received)}.`))) all = false; }
    if (all) { await rpc('mark_report_sent', { p_key: REMINDER_KEY, p_month: rep.month }); reportSent = true; }
  }
} catch (err) { console.error('Monthly report failed', err); }

return res.status(200).json({ configured: true, reminded, agendaSent, invoiced, invoicesEmailed, reportSent });
}
