/* Labour Law Alliance – practice CRM (phase 1).
   Data lives in Supabase; row-level security only lets signed-in staff read or change it. */
(function () {
  'use strict';
  var sb = supabase.createClient('https://ktsvmkfrrxuijmgjdbwr.supabase.co', 'sb_publishable_E-C0YA_K3UpDWbbWqS9Lng__7pR26p9');
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- Dates ---------- */
  var DAY = 864e5;
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function D(s) { if (!s) return null; if (s instanceof Date) return s; return new Date(String(s).length === 10 ? s + 'T00:00:00' : s); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function ymd(d) { d = D(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysLeft(d) { var x = D(d); x = new Date(x.getFullYear(), x.getMonth(), x.getDate()); return Math.round((x - today()) / DAY); }
  function fmt(d) { return d ? D(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
  function fmtT(d) { return D(d).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }); }
  function fmtDT(d) { return fmt(d) + ' ' + fmtT(d); }
  function localInput(d) { d = D(d); return ymd(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function money(n) { return n == null || n === '' ? '—' : 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/,/g, ' '); }
  function parsePreferred(s) { if (!s) return null; var m = String(s).match(/(\d{4}-\d{2}-\d{2})/); if (m) return D(m[1]); var t = Date.parse(String(s).replace(/^[A-Za-z]+,?\s+/, '')); return isNaN(t) ? null : new Date(t); }

  /* ---------- Labour-law time limits ---------- */
  var RULES = [
    { id: 'ud', label: 'Refer unfair dismissal to CCMA / council', from: 'Date of dismissal (or final decision)', law: 'LRA s191(1)(b)(i)', span: '30 days', calc: function (d) { return addDays(d, 30); } },
    { id: 'ulp', label: 'Refer unfair labour practice', from: 'Date of the act or omission', law: 'LRA s191(1)(b)(ii)', span: '90 days', calc: function (d) { return addDays(d, 90); } },
    { id: 'disc', label: 'Refer unfair discrimination', from: 'Date of the act or omission', law: 'EEA s10(2)', span: '6 months', calc: function (d) { return addMonths(d, 6); } },
    { id: 'arb', label: 'Request arbitration / refer to Labour Court', from: 'Date of certificate of outcome', law: 'LRA s191(11)', span: '90 days', calc: function (d) { return addDays(d, 90); } },
    { id: 'con', label: 'Conciliation to be completed', from: 'Date dispute was referred', law: 'LRA s135(2)', span: '30 days', calc: function (d) { return addDays(d, 30); } },
    { id: 'rev', label: 'Apply to Labour Court to review award', from: 'Date award was served', law: 'LRA s145(1)(a)', span: '6 weeks', calc: function (d) { return addDays(d, 42); } },
    { id: 'res', label: 'Apply to rescind default award', from: 'Date client learnt of the award', law: 'CCMA Rule 32', span: '14 days', calc: function (d) { return addDays(d, 14); } },
    { id: 'aw', label: 'Arbitrator to issue award', from: 'Date arbitration concluded', law: 'LRA s138(7)(a)', span: '14 days', calc: function (d) { return addDays(d, 14); } },
    { id: '189a', label: 'Earliest dismissal date, large-scale retrenchment', from: 'Date of s189(3) notice', law: 'LRA s189A(7)–(8)', span: '60 days', calc: function (d) { return addDays(d, 60); } }
  ];
  var rule = function (id) { return RULES.find(function (r) { return r.id === id; }); };

  var STAGES = ['Intake', 'Referred', 'Conciliation', 'Arbitration', 'Award', 'Review / enforce', 'Closed'];
  var LEAD_STAGES = [['new', 'New enquiry'], ['contacted', 'Contacted'], ['consultation_booked', 'Consultation booked'], ['quote_sent', 'Quote sent'], ['client', 'Engaged'], ['lost', 'Lost'], ['closed', 'Closed']];
  var leadLabel = function (s) { var x = LEAD_STAGES.find(function (p) { return p[0] === s; }); return x ? x[1] : s; };
  var FORMS = { booking: 'Booking', enquiry: 'Consultation enquiry', contact: 'Contact message', manual: 'Added by staff' };
  var KINDS = [['consultation', 'Consultation'], ['meeting', 'Client meeting'], ['call', 'Phone / video call'], ['hearing', 'Disciplinary hearing'], ['ccma', 'CCMA / council'], ['court', 'Labour Court']];
  var kindLabel = function (k) { var x = KINDS.find(function (p) { return p[0] === k; }); return x ? x[1] : k; };
  var DISPUTES = ['Unfair dismissal (misconduct)', 'Unfair dismissal (incapacity)', 'Unfair dismissal (operational requirements)', 'Constructive dismissal', 'Automatically unfair dismissal (s187)', 'Unfair labour practice', 'Unfair discrimination (EEA)', 'Retrenchment (s189 / s189A)', 'Disciplinary hearing (chairing)', 'Disciplinary hearing (initiating)', 'Review of arbitration award', 'Restraint of trade', 'Employment contracts and policies', 'Labour law compliance / advice', 'Training or workshop', 'Other'];
  var FORUMS = ['CCMA', 'Bargaining council', 'Labour Court', 'Labour Appeal Court', 'Internal hearing', 'Consultation process', 'Advice only'];

  /* ---------- State ---------- */
  var S = { user: null, leads: [], clients: [], matters: [], appts: [], deadlines: [], notes: {}, ui: { inboxSel: null, inboxTab: 'All', matterTab: 'Overview', weekStart: null, clientQ: '', matterQ: '' } };
  var byId = function (arr, id) { return arr.find(function (x) { return x.id === id; }); };
  var clientName = function (id) { var c = byId(S.clients, id); return c ? c.name : '—'; };
  var leadName = function (l) { return ((l.first_name || '') + ' ' + (l.last_name || '')).trim() || 'No name'; };

  /* ---------- UI helpers ---------- */
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.add('hidden'); }, 2800); }
  function pill(text, cls) { return '<span class="pill ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function urg(n) { return n < 0 ? pill(Math.abs(n) + ' days overdue', 'p-red') : n === 0 ? pill('Today', 'p-red') : n <= 3 ? pill(n + ' day' + (n > 1 ? 's' : ''), 'p-red') : n <= 14 ? pill(n + ' days', 'p-amber') : pill(n + ' days'); }
  function stagePill(s) { return pill(s, s === 'Closed' ? 'p-green' : s === 'Intake' ? 'p-gold' : (s === 'Arbitration' || s === 'Review / enforce') ? 'p-red' : 'p-blue'); }
  function leadPill(s) { return pill(leadLabel(s), { new: 'p-gold', contacted: 'p-blue', consultation_booked: 'p-violet', quote_sent: 'p-amber', client: 'p-green', lost: 'p-red', closed: '' }[s]); }
  function dateBox(d) { d = D(d); return '<div class="date"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString('en-ZA', { month: 'short' }) + '</span></div>'; }
  function head(eyebrow, title, sub, acts) { return '<div class="top"><div><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>'; }
  function empty(text) { return '<div class="empty">' + text + '</div>'; }
  function phoneLinks(phone, email, subject) {
    var a = [];
    if (phone) { var digits = phone.replace(/[^\d+]/g, ''); var wa = digits.replace(/^\+/, '').replace(/^0/, '27'); a.push('<a class="btn sm" href="tel:' + esc(digits) + '">Call</a>'); a.push('<a class="btn sm" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>'); }
    if (email) a.push('<a class="btn sm" href="mailto:' + esc(email) + (subject ? '?subject=' + encodeURIComponent(subject) : '') + '">Email</a>');
    return a.join(' ');
  }

  /* ---------- Generic form modal ---------- */
  function fieldHtml(f, v) {
    var id = 'm-' + f.k, req = f.req ? ' required' : '', val = v == null ? '' : v;
    var cls = 'fld' + (f.full ? ' full' : '');
    if (f.type === 'checkbox') return '<div class="' + cls + ' check"><input type="checkbox" id="' + id + '"' + (val ? ' checked' : '') + '><label for="' + id + '" style="font-weight:400">' + esc(f.label) + '</label></div>';
    var input;
    if (f.type === 'select') input = '<select id="' + id + '"' + req + '>' + (f.blank ? '<option value="">' + esc(f.blank) + '</option>' : '') + f.options.map(function (o) { var ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(ov) + '"' + (String(ov) === String(val) ? ' selected' : '') + '>' + esc(ol) + '</option>'; }).join('') + '</select>';
    else if (f.type === 'textarea') input = '<textarea id="' + id + '"' + req + '>' + esc(val) + '</textarea>';
    else input = '<input id="' + id + '" type="' + (f.type || 'text') + '" value="' + esc(val) + '"' + req + (f.step ? ' step="' + f.step + '"' : '') + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
    return '<div class="' + cls + '"><label for="' + id + '">' + esc(f.label) + (f.req ? ' *' : '') + '</label>' + input + (f.hint ? '<span class="hint" id="' + id + '-hint">' + f.hint + '</span>' : '') + '</div>';
  }
  function readField(f) {
    var el = $('m-' + f.k); if (!el) return undefined;
    if (f.type === 'checkbox') return el.checked;
    var v = el.value.trim();
    if (v === '') return null;
    if (f.type === 'number') return Number(v);
    if (f.type === 'datetime-local') return new Date(v).toISOString();
    return v;
  }
  /* opts: {title, fields, values, save(data) -> Promise<error|null>, del() , extra, onInput} */
  function openForm(opts) {
    var vals = opts.values || {};
    $('modal-root').innerHTML = '<div class="modal-bg" id="mbg"><form class="modal" id="mform" novalidate><div class="mh"><h2>' + esc(opts.title) + '</h2><button type="button" class="x" id="mx" aria-label="Close">&times;</button></div><div class="mb"><div class="f">' +
      opts.fields.map(function (f) { return fieldHtml(f, vals[f.k]); }).join('') + (opts.extra || '') + '</div></div><div class="mf"><span class="msg" id="mmsg"></span>' + (opts.del ? '<button type="button" class="btn danger" id="mdel">Delete</button>' : '') + '<button type="button" class="btn" id="mcancel">Cancel</button><button type="submit" class="btn pri" id="msave">' + esc(opts.saveLabel || 'Save') + '</button></div></form></div>';
    var formEl;
    // Only clear the modal if it is still this form; a save may already have opened the next form.
    var close = function () { document.removeEventListener('keydown', onKey); if ($('mform') === formEl) $('modal-root').innerHTML = ''; };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    formEl = $('mform');
    document.addEventListener('keydown', onKey);
    $('mx').onclick = close; $('mcancel').onclick = close;
    $('mbg').addEventListener('mousedown', function (e) { if (e.target.id === 'mbg') close(); });
    if (opts.onInput) { $('mform').addEventListener('input', opts.onInput); $('mform').addEventListener('change', opts.onInput); opts.onInput(); }
    if (opts.del) $('mdel').onclick = async function () {
      if (this.dataset.confirm !== '1') { this.dataset.confirm = '1'; this.textContent = 'Click again to delete'; return; }
      var err = await opts.del(); if (err) { $('mmsg').textContent = err; return; } close();
    };
    $('mform').onsubmit = async function (e) {
      e.preventDefault();
      var data = {}, missing = [];
      opts.fields.forEach(function (f) { if (f.skip) return; var v = readField(f); data[f.k] = v; if (f.req && (v == null || v === '')) missing.push(f.label); });
      if (missing.length) { $('mmsg').textContent = 'Please fill in: ' + missing.join(', '); return; }
      $('msave').disabled = true; $('mmsg').className = 'msg'; $('mmsg').textContent = 'Saving…';
      var err = await opts.save(data);
      $('msave').disabled = false;
      if (err) { $('mmsg').textContent = err; return; }
      close();
    };
    var first = $('mform').querySelector('input,select,textarea'); if (first) first.focus();
  }
  function dbErr(r) { return r.error ? (r.error.message || 'Could not save') : null; }

  /* ---------- Data ---------- */
  async function loadAll() {
    var res = await Promise.all([
      sb.from('leads').select('*').order('created_at', { ascending: false }).limit(2000),
      sb.from('clients').select('*').order('name'),
      sb.from('matters').select('*').order('created_at', { ascending: false }),
      sb.from('appointments').select('*').order('starts_at'),
      sb.from('deadlines').select('*').order('due_date')
    ]);
    var bad = res.find(function (r) { return r.error; });
    if (bad) { $('view').innerHTML = '<div class="callout p-red">Could not load data: ' + esc(bad.error.message) + '</div>'; return false; }
    S.leads = res[0].data; S.clients = res[1].data; S.matters = res[2].data; S.appts = res[3].data; S.deadlines = res[4].data;
    return true;
  }
  async function loadNotes(matterId) {
    var r = await sb.from('matter_notes').select('*').eq('matter_id', matterId).order('created_at', { ascending: false });
    S.notes[matterId] = r.data || [];
  }
  function upsertLocal(arr, row) { var i = arr.findIndex(function (x) { return x.id === row.id; }); if (i >= 0) arr[i] = row; else arr.unshift(row); }

  /* All dated items across the practice */
  function agenda() {
    var out = [];
    S.matters.forEach(function (m) {
      if (m.stage === 'Closed') return;
      if (m.next_date) out.push({ date: D(m.next_date), what: m.next_step || 'Next step', ref: m.ref, title: m.title, kind: 'Diary', law: '', matter: m.id });
      if (m.key_rule && m.key_date) { var r = rule(m.key_rule); out.push({ date: r.calc(D(m.key_date)), what: r.label, ref: m.ref, title: m.title, kind: 'Time limit', law: r.law, matter: m.id }); }
    });
    S.deadlines.forEach(function (d) { if (d.done) return; var m = byId(S.matters, d.matter_id); out.push({ date: D(d.due_date), what: d.title, ref: m ? m.ref : '', title: m ? m.title : '', kind: 'Deadline', law: '', matter: d.matter_id, deadlineId: d.id }); });
    S.appts.forEach(function (a) { if (a.status !== 'scheduled') return; var m = byId(S.matters, a.matter_id); out.push({ date: D(a.starts_at), what: a.title + ' · ' + fmtT(a.starts_at), ref: m ? m.ref : '', title: a.location || '', kind: kindLabel(a.kind), law: '', appt: a.id }); });
    out.forEach(function (x) { x.left = daysLeft(x.date); });
    return out.sort(function (a, b) { return a.date - b.date; });
  }

  /* ---------- Navigation ---------- */
  var NAV = [
    { grp: 'Overview' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inbox', label: 'Inbox', n: function () { return S.leads.filter(function (l) { return !l.seen_at; }).length; }, hot: true },
    { grp: 'Work' },
    { id: 'pipeline', label: 'Pipeline', n: function () { return S.leads.filter(function (l) { return l.status === 'new'; }).length; } },
    { id: 'matters', label: 'Matters', n: function () { return S.matters.filter(function (m) { return m.stage !== 'Closed'; }).length; } },
    { id: 'deadlines', label: 'Deadlines', n: function () { return agenda().filter(function (d) { return d.left <= 7 && (d.kind === 'Time limit' || d.kind === 'Deadline' || d.kind === 'Diary'); }).length; }, hot: true },
    { id: 'appointments', label: 'Appointments' },
    { grp: 'Clients & money' },
    { id: 'clients', label: 'Clients' },
    { id: 'quotes', label: 'Quotes & invoices', soon: true },
    { id: 'payments', label: 'Payments', soon: true },
    { grp: 'Growth' },
    { id: 'website', label: 'Website', soon: true },
    { grp: 'Firm' },
    { id: 'documents', label: 'Document centre', soon: true },
    { id: 'settings', label: 'Company settings', soon: true }
  ];
  function renderNav(cur) {
    $('nav').innerHTML = NAV.map(function (n) {
      if (n.grp) return '<div class="grp">' + n.grp + '</div>';
      var c = n.n ? n.n() : 0;
      return '<a href="#' + n.id + '" class="' + (n.id === cur ? 'on' : '') + (n.soon ? ' soon' : '') + '">' + n.label + (n.soon ? '<span class="soon-tag">Soon</span>' : c ? '<span class="n' + (n.hot ? ' hot' : '') + '">' + c + '</span>' : '') + '</a>';
    }).join('');
  }

  var V = {};

  /* ---------- Dashboard ---------- */
  V.dashboard = function () {
    var ag = agenda().filter(function (d) { return d.left >= -7; });
    var open = S.matters.filter(function (m) { return m.stage !== 'Closed'; });
    var wkEnd = addDays(today(), 7);
    var apptsWeek = S.appts.filter(function (a) { return a.status === 'scheduled' && D(a.starts_at) >= today() && D(a.starts_at) < wkEnd; });
    var newLeads = S.leads.filter(function (l) { return l.status === 'new'; });
    var maxStage = Math.max(1, Math.max.apply(null, STAGES.map(function (s) { return S.matters.filter(function (m) { return m.stage === s; }).length; })));
    var srcCounts = {}; S.leads.forEach(function (l) { var k = l.page || (l.form === 'manual' ? 'Added by staff' : 'Unknown page'); srcCounts[k] = (srcCounts[k] || 0) + 1; });
    var srcRows = Object.keys(srcCounts).map(function (k) { return [k, srcCounts[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    var srcMax = Math.max(1, srcRows.length ? srcRows[0][1] : 1);
    return head(new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 'Dashboard', 'Deadlines, appointments and new enquiries across the practice.', '<button class="btn pri" data-act="new-lead">New enquiry</button><button class="btn" data-act="new-matter">New matter</button>') +
      '<div class="grid g4">' +
      '<a class="panel stat" href="#matters" style="text-decoration:none;color:inherit"><b>' + open.length + '</b><span>Open matters</span></a>' +
      '<a class="panel stat" href="#deadlines" style="text-decoration:none;color:inherit"><b style="color:var(--red)">' + ag.filter(function (d) { return d.left <= 7 && d.left >= 0 && /Time limit|Deadline|Diary/.test(d.kind); }).length + '</b><span>Deadlines in the next 7 days</span></a>' +
      '<a class="panel stat" href="#appointments" style="text-decoration:none;color:inherit"><b>' + apptsWeek.length + '</b><span>Appointments in the next 7 days</span></a>' +
      '<a class="panel stat" href="#inbox" style="text-decoration:none;color:inherit"><b>' + newLeads.length + '</b><span>New enquiries to answer</span></a></div>' +
      '<div class="grid g21"><div class="panel"><div class="hd"><h2>Coming up</h2><a href="#deadlines">All deadlines</a></div><div class="list">' +
      (ag.filter(function (d) { return d.left <= 21; }).map(function (d) { return '<div class="row">' + dateBox(d.date) + '<div class="grow"><b>' + esc(d.what) + '</b><div class="meta">' + [d.kind, d.ref, d.title, d.law].filter(Boolean).map(esc).join(' · ') + '</div></div>' + urg(d.left) + '</div>'; }).join('') || empty('Nothing due in the next three weeks.')) +
      '</div></div><div class="grid" style="align-content:start"><div class="panel"><div class="hd"><h2>New enquiries</h2><a href="#inbox">Inbox</a></div><div class="list">' +
      (newLeads.slice(0, 5).map(function (l) { return '<div class="row"><div class="grow"><a href="#inbox" data-lead="' + l.id + '"><b>' + esc(leadName(l)) + '</b></a><div class="meta">' + esc(FORMS[l.form] || l.form) + ' · ' + fmtDT(l.created_at) + '</div></div></div>'; }).join('') || empty('No new enquiries.')) +
      '</div></div><div class="panel"><div class="hd"><h2>Matters by stage</h2></div><div class="list">' +
      STAGES.map(function (s) { var n = S.matters.filter(function (m) { return m.stage === s; }).length; return '<div class="row" style="align-items:center;padding:6px 0"><div class="grow">' + s + '</div><div style="flex:0 0 90px" class="bar"><i style="width:' + (n / maxStage * 100) + '%"></i></div><span class="mono" style="width:18px;text-align:right">' + n + '</span></div>'; }).join('') +
      '</div></div><div class="panel"><div class="hd"><h2>Pages that bring enquiries</h2></div>' +
      (srcRows.length ? srcRows.map(function (r) { return '<div class="row" style="align-items:center;padding:6px 0"><div class="grow" style="word-break:break-all">' + esc(r[0]) + '</div><div style="flex:0 0 70px" class="bar"><i style="width:' + (r[1] / srcMax * 100) + '%"></i></div><span class="mono" style="width:18px;text-align:right">' + r[1] + '</span></div>'; }).join('') : empty('Shows once enquiries arrive.')) +
      '</div></div></div>';
  };

  /* ---------- Inbox ---------- */
  V.inbox = function () {
    var tabs = ['All', 'Unread', 'Bookings', 'Enquiries', 'Contact messages'];
    var t = S.ui.inboxTab;
    var list = S.leads.filter(function (l) { return t === 'All' || (t === 'Unread' && !l.seen_at) || (t === 'Bookings' && l.form === 'booking') || (t === 'Enquiries' && l.form === 'enquiry') || (t === 'Contact messages' && l.form === 'contact'); });
    var sel = byId(S.leads, S.ui.inboxSel) || null;
    return head('Inbox', 'Website submissions', 'Every contact, consultation and booking form from the website arrives here and is also emailed to info@labourlawalliance.co.za.') +
      '<div class="banner"><span class="led"></span><b>Website forms</b><span class="meta">Live</span><span class="led off" style="margin-left:12px"></span><b>info@ mailbox</b><span class="meta">Reading domain email inside the CRM comes in phase 3</span></div>' +
      '<div class="subtabs">' + tabs.map(function (x) { return '<button data-inboxtab="' + x + '" class="' + (x === t ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div class="panel inbox"><div class="ilist">' + (list.map(function (l) {
        var what = l.form === 'booking' ? (l.service || 'Consultation') + (l.preferred_date ? ' · ' + l.preferred_date + ' ' + (l.preferred_time || '') : '') : (l.subject || l.service || (l.message || '').slice(0, 80));
        return '<button class="imsg' + (l.seen_at ? '' : ' unread') + (sel && sel.id === l.id ? ' on' : '') + '" data-lead="' + l.id + '"><span class="dot"></span><span style="flex:1;min-width:0"><span style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(leadName(l)) + '</b><span class="mono">' + fmt(l.created_at) + '</span></span><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(what) + '</span><span style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">' + pill(FORMS[l.form] || l.form, 'p-gold') + leadPill(l.status) + '</span></span></button>';
      }).join('') || empty('Nothing here.')) + '</div><div class="iread">' + (sel ? leadReader(sel) : empty('Choose a message on the left.')) + '</div></div>';
  };
  function leadReader(l) {
    var fields = [['Email', l.email], ['Phone', l.phone], ['Preferred date', l.preferred_date], ['Preferred time', l.preferred_time], ['Meeting type', l.meeting], ['Service', l.service], ['Relationship', l.relationship], ['Region', l.region], ['Subject', l.subject], ['Message', l.message], ['Sent from page', l.page], ['Reference', l.ref]];
    var client = l.client_id && byId(S.clients, l.client_id), matter = l.matter_id && byId(S.matters, l.matter_id);
    return '<div style="display:flex;flex-direction:column;gap:12px"><div><div class="meta">' + esc(FORMS[l.form] || l.form) + ' · ' + fmtDT(l.created_at) + '</div><h2 style="margin-top:4px">' + esc(leadName(l)) + '</h2></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + phoneLinks(l.phone, l.email, 'Your enquiry with Labour Law Alliance') + '</div>' +
      '<dl class="kv">' + fields.filter(function (x) { return x[1]; }).map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="f"><div class="fld"><label for="l-status">Pipeline stage</label><select id="l-status">' + LEAD_STAGES.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === l.status ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="l-value">Expected fee (R)</label><input type="number" id="l-value" step="100" value="' + (l.est_value == null ? '' : l.est_value) + '"></div>' +
      '<div class="fld full"><label for="l-notes">Notes</label><textarea id="l-notes" placeholder="Calls made, advice given, next steps…">' + esc(l.notes || '') + '</textarea></div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn pri" data-act="save-lead" data-id="' + l.id + '">Save</button>' +
      (client ? '<a class="btn" href="#clients" data-client="' + client.id + '">Client: ' + esc(client.name) + '</a>' : '<button class="btn" data-act="lead-to-client" data-id="' + l.id + '">Make client and open matter</button>') +
      (matter ? '<a class="btn" href="#matter=' + matter.id + '">Matter ' + esc(matter.ref) + '</a>' : '') +
      '<button class="btn" data-act="lead-appt" data-id="' + l.id + '">Book appointment</button><span class="msg" id="l-msg"></span></div></div>';
  }
  async function markSeen(l) {
    if (l.seen_at) return;
    var r = await sb.from('leads').update({ seen_at: new Date().toISOString() }).eq('id', l.id).select().single();
    if (!r.error) { upsertLocal(S.leads, r.data); renderNav(current()); }
  }

  /* ---------- Pipeline ---------- */
  V.pipeline = function () {
    var cols = LEAD_STAGES.filter(function (s) { return s[0] !== 'closed'; });
    return head('Pipeline', 'From enquiry to client', 'Each enquiry moves from first contact to a signed engagement. Change the stage in the lead, or drag a card to another column.', '<button class="btn pri" data-act="new-lead">New enquiry</button>') +
      '<div class="board">' + cols.map(function (s) {
        var ls = S.leads.filter(function (l) { return l.status === s[0]; });
        var total = ls.reduce(function (a, l) { return a + Number(l.est_value || 0); }, 0);
        return '<div class="col" data-drop="' + s[0] + '"><h3><span>' + s[1] + '</span><span>' + ls.length + '</span></h3>' + ls.map(function (l) {
          return '<button class="card" draggable="true" data-drag="' + l.id + '" data-lead="' + l.id + '"><b>' + esc(leadName(l)) + '</b><span class="meta">' + esc(l.service || l.subject || FORMS[l.form] || '') + '</span><span class="meta">' + fmt(l.created_at) + (l.page ? ' · ' + esc(l.page) : '') + '</span>' + (l.est_value ? '<span class="mono">' + money(l.est_value) + '</span>' : '') + '</button>';
        }).join('') + '<span class="mono" style="margin-top:auto">' + (total ? money(total) : '') + '</span></div>';
      }).join('') + '</div>';
  };

  /* ---------- Clients ---------- */
  V.clients = function () {
    var q = S.ui.clientQ.toLowerCase();
    var list = S.clients.filter(function (c) { return !q || [c.name, c.contact_person, c.email, c.phone, c.id_or_reg_no].join(' ').toLowerCase().indexOf(q) >= 0; });
    return head('Clients', 'Employers and individuals', 'FICA and POPIA status is tracked for each client. Click a client to edit, or to see their matters and appointments.', '<button class="btn pri" data-act="new-client">Add client</button>') +
      '<input type="search" id="client-q" placeholder="Search by name, contact, email, phone or ID / registration number" value="' + esc(S.ui.clientQ) + '">' +
      '<div class="panel"><div class="tbl"><table><tr><th>Client</th><th>Type</th><th>Contact</th><th>Fee plan</th><th>Matters</th><th>FICA</th><th>POPIA</th></tr>' +
      (list.map(function (c) {
        var nm = S.matters.filter(function (m) { return m.client_id === c.id; });
        return '<tr class="click" data-client="' + c.id + '"><td><b>' + esc(c.name) + '</b>' + (c.contact_person ? '<div class="meta">' + esc(c.contact_person) + '</div>' : '') + '</td><td>' + esc({ individual: 'Individual', employer: 'Employer', union: 'Trade union' }[c.kind]) + '</td><td class="mono">' + esc(c.phone || '') + '<br>' + esc(c.email || '') + '</td><td>' + esc(c.fee_plan || '—') + '</td><td class="mono">' + nm.filter(function (m) { return m.stage !== 'Closed'; }).length + ' open / ' + nm.length + '</td><td>' + pill({ done: 'Done', partial: 'Partial', outstanding: 'Outstanding' }[c.fica_status], c.fica_status === 'done' ? 'p-green' : c.fica_status === 'partial' ? 'p-amber' : 'p-red') + '</td><td>' + (c.popia_consent ? pill('Signed', 'p-green') : pill('Outstanding', 'p-red')) + '</td></tr>';
      }).join('') || '<tr><td colspan="7">' + empty(S.clients.length ? 'No clients match.' : 'No clients yet. Add one, or turn an enquiry into a client from the inbox.') + '</td></tr>') +
      '</table></div></div>';
  };
  var CLIENT_FIELDS = [
    { k: 'name', label: 'Client name', req: true },
    { k: 'kind', label: 'Type', type: 'select', options: [['individual', 'Individual (employee)'], ['employer', 'Employer'], ['union', 'Trade union']] },
    { k: 'contact_person', label: 'Contact person (for employers)' },
    { k: 'id_or_reg_no', label: 'ID or company registration no.' },
    { k: 'email', label: 'Email', type: 'email' },
    { k: 'phone', label: 'Phone', type: 'tel' },
    { k: 'address', label: 'Address', full: true },
    { k: 'employees', label: 'Number of employees', type: 'number' },
    { k: 'fee_plan', label: 'Fee plan', type: 'select', blank: 'Not agreed yet', options: ['Hourly', 'Fixed fee', 'Monthly retainer', 'Contingency', 'Pro bono'] },
    { k: 'fica_status', label: 'FICA documents', type: 'select', options: [['outstanding', 'Outstanding'], ['partial', 'Partial'], ['done', 'Done']] },
    { k: 'popia_consent', label: 'POPIA consent signed', type: 'checkbox' },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true }
  ];
  function editClient(c, after) {
    var isNew = !c || !c.id;
    var extra = '';
    if (!isNew) {
      var ms = S.matters.filter(function (m) { return m.client_id === c.id; });
      extra = '<div class="fld full"><span class="lbl">Matters</span>' + (ms.map(function (m) { return '<div><a href="#matter=' + m.id + '" data-close>' + esc(m.ref) + ' · ' + esc(m.title) + '</a> ' + stagePill(m.stage) + '</div>'; }).join('') || '<span class="meta">None yet</span>') + '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' + phoneLinks(c.phone, c.email) + '<button type="button" class="btn sm" data-act="new-matter" data-client="' + c.id + '">New matter for this client</button></div></div>';
    }
    openForm({
      title: isNew ? 'Add client' : 'Client: ' + c.name, fields: CLIENT_FIELDS, values: c || { kind: 'individual', fica_status: 'outstanding' }, extra: extra,
      save: async function (d) {
        var r = isNew ? await sb.from('clients').insert(Object.assign(d, c && c.lead_id ? { lead_id: c.lead_id } : {})).select().single() : await sb.from('clients').update(d).eq('id', c.id).select().single();
        if (r.error) return dbErr(r);
        upsertLocal(S.clients, r.data); S.clients.sort(function (a, b) { return a.name.localeCompare(b.name); });
        toast(isNew ? 'Client added' : 'Client saved'); if (after) after(r.data); else render();
      },
      del: isNew ? null : async function () {
        if (S.matters.some(function (m) { return m.client_id === c.id; })) return 'This client has matters. Delete or move those first.';
        var r = await sb.from('clients').delete().eq('id', c.id); if (r.error) return dbErr(r);
        S.clients = S.clients.filter(function (x) { return x.id !== c.id; }); toast('Client deleted'); render();
      }
    });
  }

  /* ---------- Matters ---------- */
  V.matters = function () {
    var q = S.ui.matterQ.toLowerCase();
    var list = S.matters.filter(function (m) { return !q || [m.ref, m.title, m.case_no, m.other_party, clientName(m.client_id), m.dispute_type].join(' ').toLowerCase().indexOf(q) >= 0; });
    return head('Matters', 'Every case, by stage', 'A dispute moves from intake through the CCMA or bargaining council to award, review and closure. Click a matter to open its file.', '<button class="btn pri" data-act="new-matter">New matter</button>') +
      (S.matters.length ? '<div class="board">' + STAGES.map(function (s) {
        var ms = list.filter(function (m) { return m.stage === s; });
        return '<div class="col"><h3><span>' + s + '</span><span>' + ms.length + '</span></h3>' + ms.map(function (m) { return '<a class="card" href="#matter=' + m.id + '" style="text-decoration:none;color:inherit"><span class="mono">' + esc(m.ref) + '</span><b>' + esc(m.title) + '</b><span class="meta">' + esc(m.dispute_type || '') + '</span>' + (m.next_date ? '<span class="meta">Next: ' + fmt(m.next_date) + '</span>' : '') + '</a>'; }).join('') + '</div>';
      }).join('') + '</div>' : '') +
      '<input type="search" id="matter-q" placeholder="Search by reference, title, case number, client or other party" value="' + esc(S.ui.matterQ) + '">' +
      '<div class="panel"><div class="tbl"><table><tr><th>Matter</th><th>Client</th><th>Type</th><th>Forum & case no.</th><th>Stage</th><th>Next step</th></tr>' +
      (list.map(function (m) { return '<tr class="click" data-matter="' + m.id + '"><td><span class="mono">' + esc(m.ref) + '</span><br><b>' + esc(m.title) + '</b></td><td>' + esc(clientName(m.client_id)) + '<div class="meta">for the ' + esc(m.acting_for) + '</div></td><td>' + esc(m.dispute_type || '—') + '</td><td>' + esc(m.forum || '—') + '<br><span class="mono">' + esc(m.case_no || '') + '</span></td><td>' + stagePill(m.stage) + '</td><td>' + (m.next_date ? esc(m.next_step || '') + '<br><span class="mono">' + fmt(m.next_date) + '</span> ' + urg(daysLeft(m.next_date)) : '—') + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty(S.matters.length ? 'No matters match.' : 'No matters yet. Open one with “New matter”, or from an enquiry in the inbox.') + '</td></tr>') +
      '</table></div></div>';
  };
  function matterFields() {
    return [
      { k: 'client_id', label: 'Client', type: 'select', req: true, blank: 'Choose a client', options: S.clients.map(function (c) { return [c.id, c.name]; }), hint: '<a href="#" data-act="quick-client">+ Add a new client</a>' },
      { k: 'title', label: 'Matter title', req: true, ph: 'e.g. T. Mokoena v Ridgeway Logistics' },
      { k: 'acting_for', label: 'We act for', type: 'select', options: [['employee', 'Employee'], ['employer', 'Employer'], ['union', 'Trade union']] },
      { k: 'other_party', label: 'Other party' },
      { k: 'dispute_type', label: 'Type of matter', type: 'select', blank: 'Choose…', options: DISPUTES },
      { k: 'forum', label: 'Forum', type: 'select', blank: 'Choose…', options: FORUMS },
      { k: 'case_no', label: 'Case number', ph: 'e.g. GAJB 18842-26' },
      { k: 'stage', label: 'Stage', type: 'select', options: STAGES },
      { k: 'key_rule', label: 'Time limit that applies', type: 'select', blank: 'None', options: RULES.map(function (r) { return [r.id, r.span + ': ' + r.label]; }) },
      { k: 'key_date', label: 'Date the time limit runs from', type: 'date', hint: 'Choose a time limit to work out the deadline.' },
      { k: 'next_step', label: 'Next step', ph: 'e.g. Conciliation at CCMA Johannesburg' },
      { k: 'next_date', label: 'Next step date', type: 'date' },
      { k: 'attorney', label: 'Responsible attorney' },
      { k: 'fee_arrangement', label: 'Fee arrangement', ph: 'e.g. Hourly R 1 950' },
      { k: 'value_sought', label: 'What the client wants', full: true, ph: 'e.g. Reinstatement or 12 months’ compensation' },
      { k: 'notes', label: 'Background', type: 'textarea', full: true }
    ];
  }
  function keyDateHint() {
    var r = $('m-key_rule'), d = $('m-key_date'), h = $('m-key_date-hint');
    if (!r || !h) return;
    if (!r.value) { h.textContent = 'Choose a time limit to work out the deadline.'; return; }
    var ru = rule(r.value);
    $('m-key_date').previousElementSibling.textContent = ru.from;
    if (!d.value) { h.textContent = ru.span + ' from this date (' + ru.law + ').'; return; }
    var due = ru.calc(D(d.value)), n = daysLeft(due);
    h.innerHTML = '<b style="color:var(--' + (n < 0 ? 'red' : n <= 10 ? 'amber' : 'green') + ')">Deadline ' + fmt(due) + (n < 0 ? ', ' + Math.abs(n) + ' days ago: condonation needed' : ', ' + n + ' days left') + '</b> · ' + ru.law;
  }
  function editMatter(m, preset) {
    var isNew = !m || !m.id;
    openForm({
      title: isNew ? 'New matter' : 'Edit ' + m.ref, fields: matterFields(), values: m || Object.assign({ stage: 'Intake', acting_for: 'employee' }, preset || {}), onInput: keyDateHint,
      save: async function (d) {
        var r = isNew ? await sb.from('matters').insert(Object.assign(d, preset && preset.lead_id ? { lead_id: preset.lead_id } : {})).select().single() : await sb.from('matters').update(d).eq('id', m.id).select().single();
        if (r.error) return dbErr(r);
        upsertLocal(S.matters, r.data);
        if (isNew && preset && preset.lead_id) { var lr = await sb.from('leads').update({ matter_id: r.data.id, status: 'client' }).eq('id', preset.lead_id).select().single(); if (!lr.error) upsertLocal(S.leads, lr.data); }
        toast(isNew ? 'Matter ' + r.data.ref + ' opened' : 'Matter saved');
        if (isNew) location.hash = 'matter=' + r.data.id; else render();
      },
      del: isNew ? null : async function () { var r = await sb.from('matters').delete().eq('id', m.id); if (r.error) return dbErr(r); S.matters = S.matters.filter(function (x) { return x.id !== m.id; }); toast('Matter deleted'); location.hash = 'matters'; }
    });
  }
  function matterDetail(m) {
    var tabs = ['Overview', 'Deadlines', 'File notes', 'Appointments'];
    var t = S.ui.matterTab, si = STAGES.indexOf(m.stage), r = m.key_rule && rule(m.key_rule), c = byId(S.clients, m.client_id);
    var body = '';
    if (t === 'Overview') body = '<div class="grid g2"><dl class="kv"><dt>Client</dt><dd>' + (c ? '<a href="#" data-client="' + c.id + '">' + esc(c.name) + '</a>' : '—') + '</dd><dt>We act for</dt><dd>' + esc(m.acting_for) + '</dd><dt>Other party</dt><dd>' + esc(m.other_party || '—') + '</dd><dt>Type</dt><dd>' + esc(m.dispute_type || '—') + '</dd><dt>Forum</dt><dd>' + esc(m.forum || '—') + '</dd><dt>Case number</dt><dd>' + esc(m.case_no || '—') + '</dd><dt>Attorney</dt><dd>' + esc(m.attorney || '—') + '</dd><dt>Opened</dt><dd>' + fmt(m.created_at) + '</dd></dl>' +
      '<dl class="kv"><dt>What the client wants</dt><dd>' + esc(m.value_sought || '—') + '</dd><dt>Fee arrangement</dt><dd>' + esc(m.fee_arrangement || '—') + '</dd><dt>Next step</dt><dd>' + (m.next_date ? esc(m.next_step || '') + ', ' + fmt(m.next_date) + ' ' + urg(daysLeft(m.next_date)) : esc(m.next_step || '—')) + '</dd>' +
      (r && m.key_date ? '<dt>Time limit</dt><dd>' + esc(r.label) + ': <b>' + fmt(r.calc(D(m.key_date))) + '</b> ' + urg(daysLeft(r.calc(D(m.key_date)))) + '<div class="meta">' + r.span + ' from ' + fmt(m.key_date) + ' · ' + r.law + '</div></dd>' : '') +
      '<dt>Background</dt><dd>' + esc(m.notes || '—') + '</dd></dl></div>' + (c ? '<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">' + phoneLinks(c.phone, c.email, m.ref + ' – ' + m.title) + '</div>' : '');
    if (t === 'Deadlines') {
      var ds = S.deadlines.filter(function (d) { return d.matter_id === m.id; });
      body = (r && m.key_date ? '<div class="callout ' + (daysLeft(r.calc(D(m.key_date))) <= 14 ? 'p-amber' : 'p-blue') + '" style="margin-bottom:12px"><b>' + esc(r.label) + ': ' + fmt(r.calc(D(m.key_date))) + '</b> · ' + r.span + ' from ' + r.from.toLowerCase() + ' (' + fmt(m.key_date) + ') · ' + r.law + '</div>' : '<p class="meta">No statutory time limit set. Edit the matter to add one.</p>') +
        '<div class="list">' + ds.map(function (d) { return '<div class="row" style="align-items:center">' + dateBox(d.due_date) + '<div class="grow"><b' + (d.done ? ' style="text-decoration:line-through;opacity:.6"' : '') + '>' + esc(d.title) + '</b></div>' + (d.done ? pill('Done', 'p-green') : urg(daysLeft(d.due_date))) + '<button class="btn sm" data-act="toggle-deadline" data-id="' + d.id + '">' + (d.done ? 'Reopen' : 'Mark done') + '</button><button class="btn sm danger" data-act="del-deadline" data-id="' + d.id + '">Delete</button></div>'; }).join('') + '</div>' +
        '<form id="dl-form" class="f" style="margin-top:12px;grid-template-columns:2fr 1fr auto;align-items:end"><div class="fld"><label for="dl-title">Add a deadline</label><input type="text" id="dl-title" placeholder="e.g. File bundle with CCMA"></div><div class="fld"><label for="dl-date">Due</label><input type="date" id="dl-date"></div><button class="btn pri" type="submit">Add</button></form>';
    }
    if (t === 'File notes') {
      var ns = S.notes[m.id];
      body = '<form id="note-form" class="f" style="grid-template-columns:1fr"><div class="fld"><label for="note-body">Add a file note</label><textarea id="note-body" placeholder="Call with client, advice given, instructions received…"></textarea></div><div><button class="btn pri" type="submit">Save note</button></div></form><div class="list" style="margin-top:12px">' +
        (ns ? (ns.map(function (n) { return '<div class="row"><div class="grow"><div class="meta">' + fmtDT(n.created_at) + '</div><div style="white-space:pre-wrap">' + esc(n.body) + '</div></div></div>'; }).join('') || empty('No file notes yet.')) : '<p class="meta">Loading…</p>') + '</div>';
    }
    if (t === 'Appointments') {
      var as = S.appts.filter(function (a) { return a.matter_id === m.id; });
      body = '<div style="margin-bottom:10px"><button class="btn pri" data-act="new-appt" data-matter="' + m.id + '">New appointment</button></div><div class="list">' + (as.map(function (a) { return '<div class="row" style="align-items:center">' + dateBox(a.starts_at) + '<div class="grow"><b>' + esc(a.title) + '</b><div class="meta">' + fmtT(a.starts_at) + ' · ' + kindLabel(a.kind) + (a.location ? ' · ' + esc(a.location) : '') + '</div></div>' + pill(a.status, a.status === 'scheduled' ? 'p-blue' : a.status === 'done' ? 'p-green' : '') + '<button class="btn sm" data-appt="' + a.id + '">Open</button></div>'; }).join('') || empty('No appointments linked to this matter.')) + '</div>';
    }
    return '<div><a href="#matters">← All matters</a></div>' + head(esc(m.ref) + (m.forum ? ' · ' + esc(m.forum) : ''), esc(m.title), esc(m.dispute_type || '') + ' · acting for the ' + esc(m.acting_for), '<button class="btn pri" data-act="edit-matter" data-id="' + m.id + '">Edit matter</button>') +
      '<div class="panel"><div class="meta" style="margin-bottom:6px">Stage (click to move)</div><div class="steps">' + STAGES.map(function (s, i) { return '<button data-stage="' + esc(s) + '" class="' + (i < si ? 'done' : i === si ? 'now' : '') + '">' + s + '</button>'; }).join('') + '</div></div>' +
      '<div class="panel"><div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button role="tab" class="' + (x === t ? 'on' : '') + '" data-mtab="' + x + '">' + x + '</button>'; }).join('') + '</div><div style="padding-top:14px">' + body + '</div></div>';
  }

  /* ---------- Deadlines ---------- */
  V.deadlines = function () {
    var ag = agenda();
    var overdue = ag.filter(function (d) { return d.left < 0 && /Time limit|Deadline|Diary/.test(d.kind); });
    var up = ag.filter(function (d) { return d.left >= 0; });
    var line = function (d) { return '<div class="row">' + dateBox(d.date) + '<div class="grow"><b>' + esc(d.what) + '</b><div class="meta">' + [d.ref, d.title, d.law].filter(Boolean).map(esc).join(' · ') + '</div></div><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">' + pill(d.kind, d.kind === 'Time limit' ? 'p-gold' : d.kind === 'Deadline' ? 'p-violet' : d.kind === 'Diary' ? '' : 'p-blue') + urg(d.left) + (d.matter ? '<a class="meta" href="#matter=' + d.matter + '">Open matter</a>' : '') + '</div></div>'; };
    return head('Deadlines', 'Time limits and diary', 'Statutory time limits are worked out from the key date on each matter. Hand-added deadlines, next steps and appointments are listed with them.') +
      '<div class="grid g21"><div class="grid" style="align-content:start">' + (overdue.length ? '<div class="panel" style="border-color:var(--red)"><div class="hd"><h2 style="color:var(--red)">Overdue</h2></div><div class="list">' + overdue.map(line).join('') + '</div></div>' : '') +
      '<div class="panel"><div class="hd"><h2>Upcoming</h2></div><div class="list">' + (up.map(line).join('') || empty('Nothing upcoming. Deadlines appear here once matters have a time limit, next step or appointment.')) + '</div></div></div>' +
      '<div class="grid" style="align-content:start"><div class="panel"><div class="hd"><h2>Deadline calculator</h2></div><div class="fld"><label for="c-rule">What needs to happen</label><select id="c-rule">' + RULES.map(function (r) { return '<option value="' + r.id + '">' + r.label + '</option>'; }).join('') + '</select></div><div class="fld" style="margin-top:10px"><label for="c-date" id="c-l"></label><input type="date" id="c-date" value="' + ymd(today()) + '"></div><div class="callout p-blue" id="c-out" style="margin-top:12px"></div></div>' +
      '<div class="panel"><h2 style="margin-bottom:8px">Time limits used</h2><div class="list">' + RULES.map(function (r) { return '<div class="row"><div class="grow"><b>' + r.span + '</b> · ' + r.label + '<div class="meta">From ' + r.from.toLowerCase() + ' · ' + r.law + '</div></div></div>'; }).join('') + '</div><p class="meta">Periods under the Act are calendar days. CCMA Rule periods exclude weekends and public holidays, so check rule-based dates against the Rules. A late referral needs a condonation application.</p></div></div></div>';
  };

  /* ---------- Appointments ---------- */
  function weekStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); var wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
  V.appointments = function () {
    var ws = S.ui.weekStart || weekStart(new Date());
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(ws, i); });
    var pendingBookings = S.leads.filter(function (l) { return l.form === 'booking' && !S.appts.some(function (a) { return a.lead_id === l.id; }) && ['new', 'contacted'].indexOf(l.status) >= 0; });
    var upcoming = S.appts.filter(function (a) { return D(a.starts_at) >= today(); });
    return head('Appointments', 'Consultations, meetings and set-downs', 'Website bookings wait below until you confirm them. CCMA dates and hearings linked to matters show here too.', '<button class="btn pri" data-act="new-appt">New appointment</button>') +
      (pendingBookings.length ? '<div class="panel" style="border-color:#d3a728"><div class="hd"><h2>Website bookings to confirm</h2></div><div class="list">' + pendingBookings.map(function (l) { return '<div class="row" style="align-items:center"><div class="grow"><b>' + esc(leadName(l)) + '</b><div class="meta">Asked for ' + esc(l.preferred_date || '') + ' ' + esc(l.preferred_time || '') + ' · ' + esc(l.meeting || '') + ' · ' + esc(l.service || '') + '</div></div>' + phoneLinks(l.phone, l.email, 'Your consultation with Labour Law Alliance') + '<button class="btn sm pri" data-act="lead-appt" data-id="' + l.id + '">Confirm</button></div>'; }).join('') + '</div></div>' : '') +
      '<div class="panel"><div class="hd"><h2>Week of ' + fmt(ws) + '</h2><div style="display:flex;gap:6px"><button class="btn sm" data-week="-7">← Previous</button><button class="btn sm" data-week="0">This week</button><button class="btn sm" data-week="7">Next →</button></div></div><div class="week">' +
      days.map(function (d) {
        var as = S.appts.filter(function (a) { return ymd(a.starts_at) === ymd(d); }).sort(function (a, b) { return D(a.starts_at) - D(b.starts_at); });
        return '<div class="day' + (ymd(d) === ymd(today()) ? ' today' : '') + '"><h3>' + d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }) + '</h3>' + as.map(function (a) { return '<button class="appt k-' + a.kind + (a.status === 'cancelled' ? ' cancelled' : '') + '" data-appt="' + a.id + '"><span class="mono">' + fmtT(a.starts_at) + '</span><b style="font-size:13px">' + esc(a.title) + '</b><span class="meta">' + esc(a.location || kindLabel(a.kind)) + '</span></button>'; }).join('') + '</div>';
      }).join('') + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' + KINDS.map(function (k) { return '<span class="pill" style="border-left:3px solid ' + ({ ccma: 'var(--red)', court: 'var(--red)', hearing: 'var(--amber)', consultation: '#d3a728' }[k[0]] || 'var(--blue)') + '">' + k[1] + '</span>'; }).join('') + '</div></div>' +
      '<div class="panel"><div class="hd"><h2>All upcoming</h2></div><div class="tbl"><table><tr><th>When</th><th>What</th><th>Type</th><th>Where</th><th>Linked to</th><th>Status</th></tr>' + (upcoming.map(function (a) { var m = byId(S.matters, a.matter_id); return '<tr class="click" data-appt="' + a.id + '"><td class="mono">' + fmtDT(a.starts_at) + '</td><td><b>' + esc(a.title) + '</b></td><td>' + kindLabel(a.kind) + '</td><td>' + esc(a.location || '') + '</td><td>' + (m ? esc(m.ref) : a.client_id ? esc(clientName(a.client_id)) : '') + '</td><td>' + pill(a.status, a.status === 'scheduled' ? 'p-blue' : a.status === 'done' ? 'p-green' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('No upcoming appointments.') + '</td></tr>') + '</table></div></div>';
  };
  function apptFields() {
    return [
      { k: 'title', label: 'Title', req: true, full: true, ph: 'e.g. Consultation: Pieter van Wyk' },
      { k: 'starts_at', label: 'Date and time', type: 'datetime-local', req: true },
      { k: 'duration_min', label: 'Length (minutes)', type: 'number', step: 15 },
      { k: 'kind', label: 'Type', type: 'select', options: KINDS },
      { k: 'location', label: 'Where', ph: 'Office (Fourways), Teams, CCMA Johannesburg…' },
      { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
      { k: 'client_id', label: 'Client', type: 'select', blank: 'Not linked', options: S.clients.map(function (c) { return [c.id, c.name]; }) },
      { k: 'status', label: 'Status', type: 'select', options: [['scheduled', 'Scheduled'], ['done', 'Done'], ['cancelled', 'Cancelled']] },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true }
    ];
  }
  function editAppt(a, preset) {
    var isNew = !a || !a.id;
    var vals = a ? Object.assign({}, a, { starts_at: localInput(a.starts_at) }) : Object.assign({ duration_min: 60, kind: 'consultation', status: 'scheduled' }, preset || {});
    openForm({
      title: isNew ? 'New appointment' : 'Appointment', fields: apptFields(), values: vals,
      save: async function (d) {
        if (preset && preset.lead_id) d.lead_id = preset.lead_id;
        var r = isNew ? await sb.from('appointments').insert(d).select().single() : await sb.from('appointments').update(d).eq('id', a.id).select().single();
        if (r.error) return dbErr(r);
        upsertLocal(S.appts, r.data); S.appts.sort(function (x, y) { return D(x.starts_at) - D(y.starts_at); });
        if (isNew && preset && preset.lead_id) { var l = byId(S.leads, preset.lead_id); if (l && (l.status === 'new' || l.status === 'contacted')) { var lr = await sb.from('leads').update({ status: 'consultation_booked' }).eq('id', l.id).select().single(); if (!lr.error) upsertLocal(S.leads, lr.data); } }
        toast(isNew ? 'Appointment booked' : 'Appointment saved'); render();
      },
      del: isNew ? null : async function () { var r = await sb.from('appointments').delete().eq('id', a.id); if (r.error) return dbErr(r); S.appts = S.appts.filter(function (x) { return x.id !== a.id; }); toast('Appointment deleted'); render(); }
    });
  }

  /* ---------- Lead actions ---------- */
  function newLead() {
    openForm({
      title: 'New enquiry', fields: [
        { k: 'first_name', label: 'First name', req: true }, { k: 'last_name', label: 'Last name' },
        { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' },
        { k: 'relationship', label: 'Acting for', type: 'select', options: ['Employee', 'Employer', 'Union'] },
        { k: 'source', label: 'How they found us', type: 'select', options: ['Phone call', 'WhatsApp', 'Walk-in', 'Referral', 'Google search', 'Google Business Profile', 'Facebook', 'LinkedIn', 'Other'] },
        { k: 'service', label: 'What it is about', type: 'select', blank: 'Choose…', options: DISPUTES },
        { k: 'est_value', label: 'Expected fee (R)', type: 'number', step: 100 },
        { k: 'message', label: 'Notes from the call', type: 'textarea', full: true }
      ], values: { relationship: 'Employee', source: 'Phone call' },
      save: async function (d) {
        d.form = 'contact'; d.status = 'new'; d.ref = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())); d.seen_at = new Date().toISOString(); d.subject = d.service || 'Enquiry by ' + (d.source || 'phone');
        var r = await sb.from('leads').insert(d).select().single();
        if (r.error) return dbErr(r);
        upsertLocal(S.leads, r.data); toast('Enquiry added to the pipeline'); render();
      }
    });
  }
  async function leadToClient(l) {
    var preset = { name: leadName(l), email: l.email, phone: l.phone, kind: /employer/i.test(l.relationship || '') ? 'employer' : 'individual', lead_id: l.id, fica_status: 'outstanding' };
    editClient(preset, async function (client) {
      var lr = await sb.from('leads').update({ client_id: client.id, status: 'client' }).eq('id', l.id).select().single();
      if (!lr.error) upsertLocal(S.leads, lr.data);
      editMatter(null, { client_id: client.id, lead_id: l.id, title: client.name + (l.service ? ': ' + l.service : ''), notes: l.message || null, acting_for: client.kind === 'employer' ? 'employer' : 'employee' });
    });
  }
  function leadAppt(l) {
    var d = parsePreferred(l.preferred_date), t = (l.preferred_time || '').match(/(\d{1,2}):(\d{2})/);
    if (d && t) d.setHours(+t[1], +t[2]); else if (d) d.setHours(9, 0);
    editAppt(null, { lead_id: l.id, title: 'Consultation: ' + leadName(l), starts_at: d ? localInput(d) : '', kind: 'consultation', location: /teams|video|online/i.test(l.meeting || '') ? 'Teams' : /phone/i.test(l.meeting || '') ? 'Phone' : 'Office, Fourways', client_id: l.client_id || '', notes: [l.service, l.message].filter(Boolean).join('\n\n') });
  }

  /* ---------- Router ---------- */
  function current() { var h = location.hash.slice(1); if (h.indexOf('matter=') === 0) return 'matters'; if (h.indexOf('lead=') === 0) return 'inbox'; return V[h] ? h : 'dashboard'; }
  function render() {
    var h = location.hash.slice(1), cur = current();
    renderNav(cur);
    if (h.indexOf('lead=') === 0) { var ref = h.slice(5); var l = S.leads.find(function (x) { return x.ref === ref || x.id === ref; }); if (l) { S.ui.inboxSel = l.id; markSeen(l); } history.replaceState(null, '', '#inbox'); }
    if (h.indexOf('matter=') === 0) {
      var m = byId(S.matters, h.slice(7));
      if (!m) { $('view').innerHTML = empty('That matter was not found. <a href="#matters">All matters</a>'); return; }
      if (S.ui.matterTab === 'File notes' && !S.notes[m.id]) loadNotes(m.id).then(render);
      $('view').innerHTML = matterDetail(m);
    } else $('view').innerHTML = V[cur]();
    bind();
  }
  function bind() {
    var v = $('view');
    var cq = $('client-q'); if (cq) cq.oninput = function () { S.ui.clientQ = cq.value; var p = cq.selectionStart; render(); var n = $('client-q'); n.focus(); n.setSelectionRange(p, p); };
    var mq = $('matter-q'); if (mq) mq.oninput = function () { S.ui.matterQ = mq.value; var p = mq.selectionStart; render(); var n = $('matter-q'); n.focus(); n.setSelectionRange(p, p); };
    var cr = $('c-rule'); if (cr) { var cu = function () { var r = rule(cr.value); $('c-l').textContent = r.from; var dv = $('c-date').value; if (!dv) return; var due = r.calc(D(dv)), n = daysLeft(due); $('c-out').innerHTML = '<b>' + fmt(due) + '</b> · ' + (n < 0 ? Math.abs(n) + ' days ago' : n + ' days from today') + '<br><span class="meta">' + r.span + ', ' + r.law + '</span>'; }; cr.onchange = cu; $('c-date').oninput = cu; cu(); }
    var dlf = $('dl-form'); if (dlf) dlf.onsubmit = async function (e) { e.preventDefault(); var t = $('dl-title').value.trim(), d = $('dl-date').value; if (!t || !d) { toast('Add a description and a date'); return; } var mid = location.hash.slice(8); var r = await sb.from('deadlines').insert({ matter_id: mid, title: t, due_date: d }).select().single(); if (r.error) { toast(r.error.message); return; } S.deadlines.push(r.data); S.deadlines.sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; }); toast('Deadline added'); render(); };
    var nf = $('note-form'); if (nf) nf.onsubmit = async function (e) { e.preventDefault(); var b = $('note-body').value.trim(); if (!b) return; var mid = location.hash.slice(8); var r = await sb.from('matter_notes').insert({ matter_id: mid, body: b }).select().single(); if (r.error) { toast(r.error.message); return; } (S.notes[mid] = S.notes[mid] || []).unshift(r.data); toast('Note saved'); render(); };
    // Pipeline drag and drop
    v.querySelectorAll('[data-drag]').forEach(function (c) { c.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', c.dataset.drag); }); });
    v.querySelectorAll('[data-drop]').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.style.outline = '2px dashed #d3a728'; });
      col.addEventListener('dragleave', function () { col.style.outline = ''; });
      col.addEventListener('drop', async function (e) { e.preventDefault(); col.style.outline = ''; var id = e.dataTransfer.getData('text/plain'); var r = await sb.from('leads').update({ status: col.dataset.drop }).eq('id', id).select().single(); if (r.error) { toast(r.error.message); return; } upsertLocal(S.leads, r.data); toast('Moved to ' + leadLabel(col.dataset.drop)); render(); });
    });
  }
  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-act],[data-lead],[data-client],[data-matter],[data-appt],[data-inboxtab],[data-mtab],[data-stage],[data-week],[data-close]');
    if (!el) return;
    if (el.hasAttribute('data-close') && !el.dataset.act) { $('modal-root').innerHTML = ''; return; }
    var act = el.dataset.act, id = el.dataset.id;
    if (act) {
      e.preventDefault();
      if (act === 'new-lead') return newLead();
      if (act === 'new-client') return editClient(null);
      if (act === 'quick-client') { var keep = {}; matterFields().forEach(function (f) { var x = $('m-' + f.k); if (x) keep[f.k] = x.value; }); return editClient(null, function (c) { keep.client_id = c.id; editMatter(null, keep); }); }
      if (act === 'new-matter') { if (!S.clients.length) { toast('Add a client first'); return editClient(null, function (c) { editMatter(null, { client_id: c.id }); }); } return editMatter(null, el.dataset.client ? { client_id: el.dataset.client } : null); }
      if (act === 'edit-matter') return editMatter(byId(S.matters, id));
      if (act === 'new-appt') return editAppt(null, el.dataset.matter ? { matter_id: el.dataset.matter, client_id: (byId(S.matters, el.dataset.matter) || {}).client_id } : null);
      if (act === 'lead-to-client') return leadToClient(byId(S.leads, id));
      if (act === 'lead-appt') return leadAppt(byId(S.leads, id));
      if (act === 'save-lead') {
        var upd = { status: $('l-status').value, notes: $('l-notes').value.trim() || null, est_value: $('l-value').value === '' ? null : Number($('l-value').value) };
        el.disabled = true; var r = await sb.from('leads').update(upd).eq('id', id).select().single(); el.disabled = false;
        if (r.error) { $('l-msg').textContent = r.error.message; return; }
        upsertLocal(S.leads, r.data); toast('Saved'); render(); return;
      }
      if (act === 'toggle-deadline') { var d = byId(S.deadlines, id); var r2 = await sb.from('deadlines').update({ done: !d.done }).eq('id', id).select().single(); if (r2.error) { toast(r2.error.message); return; } upsertLocal(S.deadlines, r2.data); render(); return; }
      if (act === 'del-deadline') { var r3 = await sb.from('deadlines').delete().eq('id', id); if (r3.error) { toast(r3.error.message); return; } S.deadlines = S.deadlines.filter(function (x) { return x.id !== id; }); render(); return; }
      return;
    }
    if (el.dataset.inboxtab) { S.ui.inboxTab = el.dataset.inboxtab; return render(); }
    if (el.dataset.mtab) { S.ui.matterTab = el.dataset.mtab; return render(); }
    if (el.dataset.week) { var dw = +el.dataset.week; S.ui.weekStart = dw ? addDays(S.ui.weekStart || weekStart(new Date()), dw) : weekStart(new Date()); return render(); }
    if (el.dataset.stage) { var mid = location.hash.slice(8); var r4 = await sb.from('matters').update({ stage: el.dataset.stage }).eq('id', mid).select().single(); if (r4.error) { toast(r4.error.message); return; } upsertLocal(S.matters, r4.data); toast('Stage: ' + el.dataset.stage); return render(); }
    if (el.dataset.lead) { e.preventDefault(); var l = byId(S.leads, el.dataset.lead); S.ui.inboxSel = l.id; markSeen(l); if (current() !== 'inbox') location.hash = 'inbox'; else render(); return; }
    if (el.dataset.client) { e.preventDefault(); $('modal-root').innerHTML = ''; return editClient(byId(S.clients, el.dataset.client)); }
    if (el.dataset.matter) { location.hash = 'matter=' + el.dataset.matter; return; }
    if (el.dataset.appt) { $('modal-root').innerHTML = ''; return editAppt(byId(S.appts, el.dataset.appt)); }
  });
  window.addEventListener('hashchange', function () { if (location.hash.indexOf('#matter=') === 0) S.ui.matterTab = S.ui.matterTab || 'Overview'; if (S.user) { render(); window.scrollTo(0, 0); } });

  /* ---------- Auth ---------- */
  function show(view) { $('login').classList.toggle('hidden', view !== 'login'); $('app').classList.toggle('hidden', view !== 'app'); }
  async function start() {
    var res = await sb.auth.getSession();
    if (!res.data.session) return show('login');
    var ok = await sb.rpc('is_staff');
    if (ok.error || !ok.data) { await sb.auth.signOut(); $('login-msg').textContent = 'This account is not on the staff list. Ask the administrator to add you.'; return show('login'); }
    sb.rpc('link_staff');
    S.user = res.data.session.user;
    $('who').textContent = S.user.email;
    show('app');
    if (await loadAll()) render();
  }
  $('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!$('password').value) { $('login-msg').className = 'msg'; $('login-msg').textContent = 'Enter your password, or use the sign-in link.'; return; }
    var btn = e.target.querySelector('button'); btn.disabled = true; $('login-msg').className = 'msg'; $('login-msg').textContent = '';
    var r = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    btn.disabled = false;
    if (r.error) { $('login-msg').textContent = 'Sign in failed: ' + r.error.message; return; }
    $('password').value = ''; start();
  });
  $('magic').addEventListener('click', async function () {
    var email = $('email').value.trim();
    if (!email) { $('login-msg').className = 'msg'; $('login-msg').textContent = 'Enter your email first.'; return; }
    this.disabled = true;
    var r = await sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + '/admin', shouldCreateUser: false } });
    this.disabled = false;
    if (r.error) { $('login-msg').className = 'msg'; $('login-msg').textContent = 'Could not send link: ' + r.error.message; return; }
    $('login-msg').className = 'msg ok'; $('login-msg').textContent = 'Check ' + email + ' for your sign-in link (look in Junk too).';
  });
  $('setpw').addEventListener('click', function () {
    openForm({ title: 'Set your password', fields: [{ k: 'pw', label: 'New password (at least 8 characters)', type: 'password', req: true, full: true }, { k: 'pw2', label: 'Repeat password', type: 'password', req: true, full: true }], saveLabel: 'Save password',
      save: async function (d) { if (d.pw.length < 8) return 'Use at least 8 characters.'; if (d.pw !== d.pw2) return 'The two passwords do not match.'; var r = await sb.auth.updateUser({ password: d.pw }); if (r.error) return r.error.message; toast('Password saved. You can now sign in with it.'); } });
  });
  $('logout').addEventListener('click', async function () { await sb.auth.signOut(); S.user = null; show('login'); });
  sb.auth.onAuthStateChange(function (event) { if (event === 'SIGNED_OUT') { S.user = null; show('login'); } });
  start();
})();
