// Vercel Serverless Function: the CRM inbox for the domain mailbox (e.g. info@labourlawalliance.co.za).
// Reads mail over IMAP from the Afrihost mail server; sends replies through Resend and files a copy in Sent.
// Environment variables (Vercel → Settings → Environment Variables), entered by the firm:
//   MAIL_USER  the mailbox address, e.g. info@labourlawalliance.co.za
//   MAIL_PASS  the mailbox password
//   MAIL_HOST  optional, defaults to thragg.aserv.co.za (port 993, SSL)
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { randomUUID } from 'node:crypto';
import { denyUnlessStaff, SUPABASE_URL, SUPABASE_KEY } from './_auth.js';

const cfg = () => ({ user: process.env.MAIL_USER, pass: process.env.MAIL_PASS, host: process.env.MAIL_HOST || 'thragg.aserv.co.za', port: Number(process.env.MAIL_PORT) || 993 });
const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const addr = (a) => (a && a.value ? a.value.map((x) => ({ name: x.name || '', address: x.address || '' })) : []);

async function withImap(fn) {
  const c = cfg();
  const client = new ImapFlow({ host: c.host, port: c.port, secure: true, auth: { user: c.user, pass: c.pass }, logger: false, socketTimeout: 20000 });
  await client.connect();
  try { return await fn(client); } finally { try { await client.logout(); } catch { /* ignore */ } }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (await denyUnlessStaff(req, res)) return;
  const c = cfg();
  const action = String((req.query && req.query.action) || (req.body && req.body.action) || 'list');
  if (!c.user || !c.pass) return res.status(200).json({ configured: false });

  try {
    if (action === 'status') {
      const st = await withImap((cl) => cl.status('INBOX', { messages: true, unseen: true }));
      return res.status(200).json({ configured: true, ok: true, user: c.user, host: c.host, total: st.messages, unread: st.unseen });
    }

    if (action === 'list') {
      const limit = Math.min(Number(req.query.limit) || 40, 100);
      const out = await withImap(async (cl) => {
        const lock = await cl.getMailboxLock('INBOX');
        try {
          const total = cl.mailbox.exists;
          if (!total) return { total: 0, messages: [] };
          const from = Math.max(1, total - limit + 1);
          const msgs = [];
          for await (const m of cl.fetch(`${from}:*`, { uid: true, envelope: true, flags: true, internalDate: true })) {
            const e = m.envelope || {};
            msgs.push({ uid: m.uid, subject: e.subject || '(no subject)', date: (e.date || m.internalDate || new Date()).toISOString(), from: (e.from || []).map((x) => ({ name: x.name || '', address: x.address || '' })), seen: m.flags ? m.flags.has('\\Seen') : false, messageId: e.messageId || '' });
          }
          return { total, messages: msgs.reverse() };
        } finally { lock.release(); }
      });
      return res.status(200).json({ configured: true, user: c.user, ...out });
    }

    if (action === 'search') {
      const q = String(req.query.q || '').trim().slice(0, 80);
      if (q.length < 4) return res.status(400).json({ error: 'Search for at least 4 characters.' });
      const out = await withImap(async (cl) => {
        const lock = await cl.getMailboxLock('INBOX');
        try {
          const uids = (await cl.search({ or: [{ subject: q }, { body: q }] }, { uid: true })) || [];
          const pick = uids.slice(-30);
          const msgs = [];
          if (pick.length) {
            for await (const m of cl.fetch(pick.join(','), { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true })) {
              const e = m.envelope || {};
              msgs.push({ uid: m.uid, subject: e.subject || '(no subject)', date: (e.date || m.internalDate || new Date()).toISOString(), from: (e.from || []).map((x) => ({ name: x.name || '', address: x.address || '' })), seen: m.flags ? m.flags.has('\\Seen') : false });
            }
          }
          return msgs.reverse();
        } finally { lock.release(); }
      });
      return res.status(200).json({ configured: true, messages: out });
    }

    if (action === 'read') {
      const uid = Number(req.query.uid);
      if (!uid) return res.status(400).json({ error: 'Missing message.' });
      const msg = await withImap(async (cl) => {
        const lock = await cl.getMailboxLock('INBOX');
        try {
          const m = await cl.fetchOne(String(uid), { source: true }, { uid: true });
          if (!m) return null;
          await cl.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
          const p = await simpleParser(m.source);
          return { uid, subject: p.subject || '(no subject)', date: (p.date || new Date()).toISOString(), from: addr(p.from), to: addr(p.to), cc: addr(p.cc), messageId: p.messageId || '', references: p.references || [], text: (p.text || '').slice(0, 100000), html: p.html ? String(p.html).slice(0, 400000) : '', attachments: (p.attachments || []).map((a) => ({ filename: a.filename || 'attachment', size: a.size, contentType: a.contentType })) };
        } finally { lock.release(); }
      });
      if (!msg) return res.status(404).json({ error: 'That email was not found. It may have been moved or deleted.' });
      return res.status(200).json(msg);
    }

if (action === 'save' && req.method === 'POST') {
  // Saves one attachment into the CRM document centre, using the signed-in staff member's own access.
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } } b = b || {};
  const uid = Number(b.uid), index = Number(b.index);
  if (!uid || !Number.isInteger(index) || index < 0) return res.status(400).json({ error: 'Missing attachment.' });
  const isId = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
  const folder = String(b.folder || 'Correspondence').slice(0, 80);
  const att = await withImap(async (cl) => {
    const lock = await cl.getMailboxLock('INBOX');
    try {
      const m = await cl.fetchOne(String(uid), { source: true }, { uid: true });
      if (!m) return null;
      const p = await simpleParser(m.source);
      return (p.attachments || [])[index] || null;
    } finally { lock.release(); }
  });
  if (!att) return res.status(404).json({ error: 'That attachment was not found. The email may have been moved.' });
  if (att.size > 26214400) return res.status(413).json({ error: 'This file is larger than 25 MB.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const fname = att.filename || 'attachment';
  const path = folder.replace(/[^\w\- ]+/g, '_') + '/' + randomUUID() + '-' + fname.replace(/[^\w.\- ]+/g, '_').slice(-120);
  const auth = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { ...auth, 'Content-Type': att.contentType || 'application/octet-stream', 'x-upsert': 'false' }, body: att.content });
  if (!up.ok) { console.error('Storage upload failed', up.status, await up.text()); return res.status(502).json({ error: 'Could not store the file.' }); }
  const row = { folder, name: String(b.name || fname).trim().slice(0, 200) || fname, storage_path: path, mime: att.contentType || null, size_bytes: att.size, client_id: isId(b.client_id) ? b.client_id : null, matter_id: isId(b.matter_id) ? b.matter_id : null };
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/documents`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) });
  if (!ins.ok) {
    console.error('Document insert failed', ins.status, await ins.text());
    await fetch(`${SUPABASE_URL}/storage/v1/object/documents`, { method: 'DELETE', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) }).catch(() => {});
    return res.status(502).json({ error: 'Could not record the document.' });
  }
  const [doc] = await ins.json();
  return res.status(200).json({ ok: true, doc });
}

if (action === 'send' && req.method === 'POST') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } } b = b || {};
      const to = String(b.to || '').trim(), subject = String(b.subject || '').trim().slice(0, 250), text = String(b.text || '').slice(0, 50000);
      if (!emailOk(to)) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (!subject || !text.trim()) return res.status(400).json({ error: 'Add a subject and a message.' });
      const { RESEND_API_KEY } = process.env;
      if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email sending is not configured.' });
      const from = `Labour Law Alliance <${c.user}>`;
      const headers = {};
      if (b.inReplyTo) { headers['In-Reply-To'] = String(b.inReplyTo).slice(0, 300); headers.References = [].concat(b.references || [], b.inReplyTo).join(' ').slice(0, 2000); }
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], reply_to: c.user, subject, text, headers }) });
      if (!r.ok) { console.error('Resend error', r.status, await r.text()); return res.status(502).json({ error: 'The email could not be sent.' }); }
      // File a copy in the mailbox's Sent folder so it shows in Outlook too.
      try {
        await withImap(async (cl) => {
          const boxes = await cl.list();
          const sent = boxes.find((x) => x.specialUse === '\\Sent') || boxes.find((x) => /^(INBOX\.)?sent( items| messages)?$/i.test(x.path));
          if (!sent) return;
          const raw = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', headers['In-Reply-To'] ? `In-Reply-To: ${headers['In-Reply-To']}` : '', '', text].filter((l, i) => l !== '' || i > 7).join('\r\n');
          await cl.append(sent.path, raw, ['\\Seen']);
        });
      } catch (err) { console.error('Could not file in Sent', err); }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('Mail failed', err);
    const msg = /auth|login|credentials|password/i.test(String(err && (err.responseText || err.message))) ? 'The mailbox rejected the password. Check MAIL_USER and MAIL_PASS in Vercel.' : 'Could not reach the mailbox: ' + String((err && (err.responseText || err.message)) || err).slice(0, 200);
    return res.status(200).json({ configured: true, ok: false, error: msg });
  }
}
