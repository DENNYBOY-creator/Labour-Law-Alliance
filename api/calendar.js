// Vercel Serverless Function: private calendar feed (iCalendar / .ics) for Outlook, Google Calendar and phones.
// The link contains a secret token created in CRM → Company settings → Calendar & reminders.
// Without the right token it returns nothing.
const SUPABASE_URL = 'https://ktsvmkfrrxuijmgjdbwr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E-C0YA_K3UpDWbbWqS9Lng__7pR26p9';

const RULES = {
  ud: ['Refer unfair dismissal to CCMA / council', 30, 'd', 'LRA s191(1)(b)(i)'],
  ulp: ['Refer unfair labour practice', 90, 'd', 'LRA s191(1)(b)(ii)'],
  disc: ['Refer unfair discrimination', 6, 'm', 'EEA s10(2)'],
  arb: ['Request arbitration / refer to Labour Court', 90, 'd', 'LRA s191(11)'],
  con: ['Conciliation to be completed', 30, 'd', 'LRA s135(2)'],
  rev: ['Apply to Labour Court to review award', 42, 'd', 'LRA s145(1)(a)'],
  res: ['Apply to rescind default award', 14, 'd', 'CCMA Rule 32'],
  aw: ['Arbitrator to issue award', 14, 'd', 'LRA s138(7)(a)'],
  '189a': ['Earliest dismissal date, large-scale retrenchment', 60, 'd', 'LRA s189A(7)-(8)'],
};

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const day = (s) => String(s).slice(0, 10).replace(/-/g, '');
const nextDay = (s) => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const fold = (line) => { const out = []; let s = line; while (Buffer.byteLength(s) > 74) { let n = 74; while (Buffer.byteLength(s.slice(0, n)) > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); };

export default async function handler(req, res) {
  const token = String((req.query && req.query.t) || '');
  if (token.length < 32) return res.status(404).send('Not found');
  let feed;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/calendar_feed`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }) });
    feed = r.ok ? await r.json() : null;
  } catch (err) { console.error('calendar feed failed', err); }
  if (!feed) return res.status(404).send('Not found');

  const now = stamp(Date.now());
  const ev = [];
  const add = (lines) => ev.push(['BEGIN:VEVENT', `DTSTAMP:${now}`, ...lines, 'END:VEVENT']);
  for (const a of feed.appointments || []) {
    const end = new Date(new Date(a.start).getTime() + (a.minutes || 60) * 60000);
    add([`UID:appt-${a.id}@labourlawalliance.co.za`, `DTSTART:${stamp(a.start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc((a.status === 'provisional' ? '[To confirm] ' : '') + a.title)}`, a.location ? `LOCATION:${esc(a.location)}` : '', a.ref ? `DESCRIPTION:${esc('Matter ' + a.ref)}` : '', a.status === 'provisional' ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED'].filter(Boolean));
  }
  for (const d of feed.deadlines || []) add([`UID:deadline-${d.id}@labourlawalliance.co.za`, `DTSTART;VALUE=DATE:${day(d.date)}`, `DTEND;VALUE=DATE:${nextDay(d.date)}`, `SUMMARY:${esc('Deadline: ' + d.title + (d.ref ? ' (' + d.ref + ')' : ''))}`, 'TRANSP:TRANSPARENT']);
  for (const m of feed.matters || []) {
    const r = RULES[m.rule]; if (!r) continue;
    const due = new Date(m.key_date + 'T00:00:00Z');
    if (r[2] === 'm') due.setUTCMonth(due.getUTCMonth() + r[1]); else due.setUTCDate(due.getUTCDate() + r[1]);
    const iso = due.toISOString().slice(0, 10);
    add([`UID:limit-${m.id}@labourlawalliance.co.za`, `DTSTART;VALUE=DATE:${day(iso)}`, `DTEND;VALUE=DATE:${nextDay(iso)}`, `SUMMARY:${esc('Time limit: ' + r[0] + ' (' + m.ref + ')')}`, `DESCRIPTION:${esc(m.title + ' · ' + r[3])}`, 'TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Time limit in 7 days: ' + m.ref)}`, 'TRIGGER:-P7D', 'END:VALARM']);
  }
  for (const c of feed.compliance || []) add([`UID:compliance-${c.id}@labourlawalliance.co.za`, `DTSTART;VALUE=DATE:${day(c.date)}`, `DTEND;VALUE=DATE:${nextDay(c.date)}`, `SUMMARY:${esc('Compliance: ' + c.title + ' (' + c.client + ')')}`, 'TRANSP:TRANSPARENT']);

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Labour Law Alliance//Practice CRM//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Labour Law Alliance CRM', 'X-WR-TIMEZONE:Africa/Johannesburg', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H', ...ev.flat(), 'END:VCALENDAR'];
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="labour-law-alliance.ics"');
  res.setHeader('Cache-Control', 'private, max-age=900');
  res.setHeader('X-Robots-Tag', 'noindex');
  return res.status(200).send(lines.map(fold).join('\r\n') + '\r\n');
}
