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
  function money(n) { if (n == null || n === '') return '—'; n = Number(n); var p = Math.abs(n).toFixed(2).split('.'); return (n < 0 ? '-' : '') + 'R ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (p[1] === '00' ? '' : '.' + p[1]); }
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
  var S = { user: null, leads: [], clients: [], matters: [], appts: [], deadlines: [], notes: {}, settings: {}, staff: [], quotes: [], invoices: [], items: [], payments: [], docs: [], me: {}, ui: { inboxSel: null, inboxTab: 'All', matterTab: 'Overview', weekStart: null, clientQ: '', matterQ: '' } };
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
      sb.from('deadlines').select('*').order('due_date'),
      sb.from('company_settings').select('*').eq('id', 1).single(),
      sb.from('staff').select('*').order('email'),
      sb.from('quotes').select('*').order('created_at', { ascending: false }),
      sb.from('invoices').select('*').order('created_at', { ascending: false }),
      sb.from('line_items').select('*').order('sort'),
      sb.from('payments').select('*').order('received_on', { ascending: false }),
      sb.from('documents').select('*').order('created_at', { ascending: false })
    ]);
    var bad = res.find(function (r) { return r.error; });
    if (bad) { $('view').innerHTML = '<div class="callout p-red">Could not load data: ' + esc(bad.error.message) + '</div>'; return false; }
    S.leads = res[0].data; S.clients = res[1].data; S.matters = res[2].data; S.appts = res[3].data; S.deadlines = res[4].data;
    S.settings = res[5].data; S.staff = res[6].data; S.quotes = res[7].data; S.invoices = res[8].data; S.items = res[9].data; S.payments = res[10].data; S.docs = res[11].data;
    S.me = S.staff.find(function (s) { return S.user && (s.email || '').toLowerCase() === (S.user.email || '').toLowerCase(); }) || {};
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
    { id: 'quotes', label: 'Quotes & invoices', n: function () { return S.invoices.filter(function (i) { return invState(i).key === 'overdue'; }).length; }, hot: true },
    { id: 'payments', label: 'Payments' },
    { grp: 'Growth' },
    { id: 'website', label: 'Website' },
    { grp: 'Firm' },
    { id: 'documents', label: 'Document centre' },
    { id: 'settings', label: 'Company settings' }
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
    var tabs = ['All', 'Unread', 'Bookings', 'Enquiries', 'Contact messages', 'Email (info@)'];
    var t = S.ui.inboxTab;
    if (t === 'Email (info@)') return head('Inbox', 'Email and website submissions', 'Website forms and the info@ mailbox in one place.') + '<div class="subtabs">' + tabs.map(function (x) { return '<button data-inboxtab="' + x + '" class="' + (x === t ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>' + mailView();
    var list = S.leads.filter(function (l) { return t === 'All' || (t === 'Unread' && !l.seen_at) || (t === 'Bookings' && l.form === 'booking') || (t === 'Enquiries' && l.form === 'enquiry') || (t === 'Contact messages' && l.form === 'contact'); });
    var sel = byId(S.leads, S.ui.inboxSel) || null;
    return head('Inbox', 'Website submissions', 'Every contact, consultation and booking form from the website arrives here and is also emailed to info@labourlawalliance.co.za.') +
      '<div class="banner"><span class="led"></span><b>Website forms</b><span class="meta">Live</span>' + mailBanner() + '</div>' +
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
      '<button class="btn" data-act="lead-appt" data-id="' + l.id + '">Book appointment</button>' + (client ? '<button class="btn" data-act="lead-quote" data-id="' + l.id + '">Send quote</button>' : '') + '<span class="msg" id="l-msg"></span></div></div>';
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
    var tabs = ['Overview', 'Deadlines', 'File notes', 'Appointments', 'Billing', 'Documents'];
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
    if (t === 'Billing') body = matterBilling(m);
    if (t === 'Documents') body = matterDocs(m);
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

  /* =====================================================================
     PHASE 2: company settings, quotes, invoices, payments, documents
     ===================================================================== */
  var P2 = {};
  var round2 = function (n) { return Math.round(Number(n || 0) * 100) / 100; };
  var R2 = function (n) { n = Number(n || 0); var p = Math.abs(n).toFixed(2).split('.'); return (n < 0 ? '-' : '') + 'R ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + p[1]; };
  var ROLES = [['partner', 'Partner'], ['attorney', 'Attorney'], ['candidate_attorney', 'Candidate attorney'], ['reception', 'Reception'], ['bookkeeper', 'Bookkeeper']];
  var roleLabel = function (r) { var x = ROLES.find(function (p) { return p[0] === r; }); return x ? x[1] : r; };
  var isPartner = function () { return S.me && S.me.role === 'partner'; };
  var canMoney = function () { return S.me && (S.me.role === 'partner' || S.me.role === 'bookkeeper'); };
  var FOLDERS = ['Contracts', 'Client agreements', 'CCMA & Labour Court', 'Workplace templates', 'Correspondence', 'Evidence', 'Firm policies', 'General'];

  function itemsOf(kind, id) { return S.items.filter(function (i) { return i[kind + '_id'] === id; }).sort(function (a, b) { return a.sort - b.sort; }); }
  function totals(items, vatRate) { var sub = round2(items.reduce(function (s, i) { return s + Number(i.qty || 0) * Number(i.unit_price || 0); }, 0)); var vat = round2(sub * Number(vatRate || 0) / 100); return { sub: sub, vat: vat, total: round2(sub + vat) }; }
  function invPaid(inv) { return round2(S.payments.filter(function (p) { return p.invoice_id === inv.id; }).reduce(function (s, p) { return s + Number(p.amount); }, 0)); }
  function invTotal(inv) { return totals(itemsOf('invoice', inv.id), inv.vat_rate).total; }
  function invState(inv) {
    if (inv.status === 'cancelled') return { key: 'cancelled', label: 'Cancelled', cls: '' };
    var tot = invTotal(inv), paid = invPaid(inv), bal = round2(tot - paid);
    if (tot > 0 && bal <= 0) return { key: 'paid', label: 'Paid', cls: 'p-green', bal: 0 };
    if (inv.status === 'draft') return { key: 'draft', label: 'Draft', cls: 'p-gold', bal: bal };
    if (inv.due_date && daysLeft(inv.due_date) < 0) return { key: 'overdue', label: paid > 0 ? 'Part paid, overdue' : 'Overdue', cls: 'p-red', bal: bal };
    if (paid > 0) return { key: 'part', label: 'Part paid', cls: 'p-amber', bal: bal };
    return { key: 'sent', label: 'Sent', cls: 'p-blue', bal: bal };
  }
  var quotePill = function (s) { return pill({ draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined' }[s], { draft: 'p-gold', sent: 'p-blue', accepted: 'p-green', declined: 'p-red' }[s]); };

  /* ----- Branded document (quote / invoice), email-safe HTML ----- */
  function docHtml(kind, d) {
    var st = S.settings || {}, c = byId(S.clients, d.client_id) || {}, m = byId(S.matters, d.matter_id);
    var items = itemsOf(kind, d.id), t = totals(items, d.vat_rate), isQ = kind === 'quote';
    var paid = isQ ? 0 : invPaid(d), bal = round2(t.total - paid);
    var cell = 'padding:8px 6px;border-bottom:1px solid #e3e3e3;font-family:Georgia,serif;font-size:14px;color:#1d1d1d';
    var bank = st.bank_account ? 'Bank: ' + esc(st.bank_name || '') + ' · Account holder: ' + esc(st.bank_holder || st.trading_name || '') + '<br>Account no.: ' + esc(st.bank_account) + ' · Branch code: ' + esc(st.bank_branch || '') + (st.bank_type ? ' · ' + esc(st.bank_type) : '') : 'Banking details: please contact us.';
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(d.number) + '</title><style>@media print{.noprint{display:none}body{background:#fff!important}}</style></head><body style="margin:0;background:#f1f1f1">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f1"><tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#fff">' +
      '<tr><td height="8" style="height:8px;line-height:8px;font-size:0;background:#16203b;background-image:linear-gradient(90deg,#16203b 0%,#349cfc 35%,#d3a728 70%,#fd5d14 100%)">&nbsp;</td></tr>' +
      '<tr><td style="padding:30px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td valign="top"><img src="https://labourlawalliance.co.za/assets/images/logo.png?v=2" width="160" alt="' + esc(st.trading_name || 'Labour Law Alliance') + '" style="display:block;width:160px;height:auto;border:0"></td>' +
      '<td valign="top" align="right" style="font-family:Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#444">' + [st.legal_name || st.trading_name, st.address1, st.address2, st.phone ? 'Calls ' + st.phone : '', st.whatsapp ? 'WhatsApp ' + st.whatsapp : '', st.email, st.reg_no ? 'Reg. no. ' + st.reg_no : '', st.vat_registered && st.vat_no ? 'VAT no. ' + st.vat_no : ''].filter(Boolean).map(esc).join('<br>') + '</td></tr></table></td></tr>' +
      '<tr><td style="padding:26px 36px 0;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;color:#a07a12">' + (isQ ? 'QUOTATION' : (st.vat_registered ? 'TAX INVOICE' : 'INVOICE')) + '</td></tr>' +
      '<tr><td style="padding:10px 36px 0"><div style="border-top:2px solid #1d1d1d;line-height:0;font-size:0">&nbsp;</div></td></tr>' +
      '<tr><td style="padding:18px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Georgia,serif;font-size:14px;color:#1d1d1d"><tr>' +
      '<td valign="top"><b>To</b><br>' + esc(c.name || '') + (c.contact_person ? '<br>Attention: ' + esc(c.contact_person) : '') + (c.address ? '<br>' + esc(c.address) : '') + (c.email ? '<br>' + esc(c.email) : '') + (c.id_or_reg_no ? '<br>' + esc(c.id_or_reg_no) : '') + '</td>' +
      '<td valign="top" align="right"><b>No. ' + esc(d.number) + '</b><br>Date: ' + fmt(d.issue_date) + '<br>' + (isQ ? (d.valid_until ? 'Valid until: ' + fmt(d.valid_until) : '') : (d.due_date ? 'Due: ' + fmt(d.due_date) : '')) + (m ? '<br>Matter: ' + esc(m.ref) : '') + '</td></tr></table></td></tr>' +
      '<tr><td style="padding:20px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><th align="left" style="' + cell + ';font-family:Arial;font-size:11px;letter-spacing:1px;color:#666">DESCRIPTION</th><th align="right" style="' + cell + ';font-family:Arial;font-size:11px;color:#666">QTY</th><th align="right" style="' + cell + ';font-family:Arial;font-size:11px;color:#666">RATE</th><th align="right" style="' + cell + ';font-family:Arial;font-size:11px;color:#666">AMOUNT</th></tr>' +
      items.map(function (i) { return '<tr><td style="' + cell + '">' + esc(i.description) + '</td><td align="right" style="' + cell + '">' + Number(i.qty) + '</td><td align="right" style="' + cell + ';white-space:nowrap">' + R2(i.unit_price) + '</td><td align="right" style="' + cell + ';white-space:nowrap">' + R2(Number(i.qty) * Number(i.unit_price)) + '</td></tr>'; }).join('') +
      '<tr><td colspan="3" align="right" style="' + cell + '">Subtotal</td><td align="right" style="' + cell + ';white-space:nowrap">' + R2(t.sub) + '</td></tr>' +
      (Number(d.vat_rate) ? '<tr><td colspan="3" align="right" style="' + cell + '">VAT ' + Number(d.vat_rate) + '%</td><td align="right" style="' + cell + ';white-space:nowrap">' + R2(t.vat) + '</td></tr>' : '') +
      '<tr><td colspan="3" align="right" style="' + cell + ';font-weight:bold">Total' + (d.monthly ? ' per month' : '') + '</td><td align="right" style="' + cell + ';font-weight:bold;white-space:nowrap">' + R2(t.total) + '</td></tr>' +
      (!isQ && paid ? '<tr><td colspan="3" align="right" style="' + cell + '">Paid</td><td align="right" style="' + cell + '">' + R2(paid) + '</td></tr><tr><td colspan="3" align="right" style="' + cell + ';font-weight:bold">Balance due</td><td align="right" style="' + cell + ';font-weight:bold">' + R2(bal) + '</td></tr>' : '') +
      '</table></td></tr>' +
      (d.notes ? '<tr><td style="padding:16px 36px 0;font-family:Georgia,serif;font-size:14px;color:#1d1d1d;white-space:pre-wrap">' + esc(d.notes) + '</td></tr>' : '') +
      '<tr><td style="padding:18px 36px 28px;font-family:Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#444">' + (isQ ? 'To accept this quotation, reply to this email or call us.' : bank + '<br>Please use <b>' + esc(d.number) + '</b> as your payment reference.') + '</td></tr>' +
      '<tr><td style="padding:14px 36px;background:#16203b;font-family:Arial,sans-serif;font-size:12px;color:#c9cfdb">' + esc(st.document_footer || '') + '</td></tr>' +
      '</table></td></tr></table></body></html>';
  }
  function printHtml(html) {
    var w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups for this site to print.'); return; }
    w.document.open(); w.document.write(html.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body>')); w.document.close();
  }
  async function emailDoc(to, subject, html, text) {
    var s = await sb.auth.getSession(); var token = s.data.session && s.data.session.access_token;
    var r = await fetch('/api/send-document', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ to: to, subject: subject, html: html, text: text }) });
    var j = await r.json().catch(function () { return {}; });
    return r.ok ? null : (j.error || 'The email could not be sent.');
  }

  /* ----- Quote / invoice editor ----- */
  function linesEditor(items) {
    var rows = (items.length ? items : [{ description: '', qty: 1, unit_price: S.settings.hourly_rate || '' }]).map(lineRow).join('');
    return '<div class="fld full"><span class="lbl">Items</span><div class="tbl"><table id="lines"><tr><th>Description</th><th style="width:80px">Qty</th><th style="width:130px">Rate (R)</th><th style="width:120px;text-align:right">Amount</th><th></th></tr>' + rows + '</table></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button type="button" class="btn sm" data-act="add-line">+ Add line</button>' + ['Consultation (1 hour)', 'Drafting LRA Form 7.11 referral', 'Attendance at CCMA conciliation', 'Attendance at CCMA arbitration', 'Chairing disciplinary hearing (per day)', 'Disbursements'].map(function (s) { return '<button type="button" class="btn sm" data-act="add-line" data-desc="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<div id="doc-totals" style="text-align:right;margin-top:8px"></div></div>';
  }
  function lineRow(i) { return '<tr class="line"><td><input type="text" class="l-d" value="' + esc(i.description || '') + '" placeholder="Work done or fee item"></td><td><input type="number" class="l-q" step="0.25" value="' + esc(i.qty == null ? 1 : i.qty) + '"></td><td><input type="number" class="l-p" step="0.01" value="' + esc(i.unit_price == null ? '' : i.unit_price) + '"></td><td class="mono l-a" style="text-align:right">—</td><td><button type="button" class="btn sm danger" data-act="del-line" aria-label="Remove line">×</button></td></tr>'; }
  function readLines() { return Array.prototype.map.call(document.querySelectorAll('#lines tr.line'), function (tr, i) { return { description: tr.querySelector('.l-d').value.trim(), qty: Number(tr.querySelector('.l-q').value || 0), unit_price: Number(tr.querySelector('.l-p').value || 0), sort: i }; }).filter(function (l) { return l.description; }); }
  function updateTotals() {
    var box = $('doc-totals'); if (!box) return;
    document.querySelectorAll('#lines tr.line').forEach(function (tr) { tr.querySelector('.l-a').textContent = R2(Number(tr.querySelector('.l-q').value || 0) * Number(tr.querySelector('.l-p').value || 0)); });
    var vr = $('m-vat_rate') ? Number($('m-vat_rate').value || 0) : 0, t = totals(readLines(), vr);
    box.innerHTML = 'Subtotal <b>' + R2(t.sub) + '</b>' + (vr ? ' · VAT ' + vr + '% <b>' + R2(t.vat) + '</b>' : '') + ' · Total <b style="font-size:16px">' + R2(t.total) + '</b>';
  }
  P2['add-line'] = function (el) { var tb = $('lines'); tb.insertAdjacentHTML('beforeend', lineRow({ description: el.dataset.desc || '', qty: 1, unit_price: /Consultation/.test(el.dataset.desc || '') ? (S.settings.hourly_rate || '') : '' })); updateTotals(); };
  P2['del-line'] = function (el) { el.closest('tr').remove(); updateTotals(); };
  async function saveLines(kind, id, lines) {
    var del = await sb.from('line_items').delete().eq(kind + '_id', id); if (del.error) return dbErr(del);
    if (lines.length) { var ins = await sb.from('line_items').insert(lines.map(function (l) { var o = Object.assign({}, l); o[kind + '_id'] = id; return o; })).select(); if (ins.error) return dbErr(ins); S.items = S.items.filter(function (i) { return i[kind + '_id'] !== id; }).concat(ins.data); }
    else S.items = S.items.filter(function (i) { return i[kind + '_id'] !== id; });
    return null;
  }
  function docFields(kind, d) {
    var st = S.settings || {};
    var f = [
      { k: 'client_id', label: 'Client', type: 'select', req: true, blank: 'Choose a client', options: S.clients.map(function (c) { return [c.id, c.name]; }) },
      { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.filter(function (m) { return !d.client_id || m.client_id === d.client_id; }).map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
      { k: 'issue_date', label: 'Date', type: 'date', req: true }
    ];
    if (kind === 'quote') f.push({ k: 'valid_until', label: 'Valid until', type: 'date' }, { k: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['declined', 'Declined']] }, { k: 'monthly', label: 'This is a monthly fee (retainer)', type: 'checkbox' });
    else f.push({ k: 'due_date', label: 'Due date', type: 'date' }, { k: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['sent', 'Sent'], ['cancelled', 'Cancelled']] });
    f.push({ k: 'vat_rate', label: 'VAT %', type: 'number', step: 0.01, hint: st.vat_registered ? 'You are VAT registered.' : 'Not VAT registered: leave at 0.' });
    f.push({ k: 'notes', label: kind === 'quote' ? 'Scope and terms shown on the quote' : 'Note shown on the invoice', type: 'textarea', full: true });
    return f;
  }
  function editDoc(kind, d, preset) {
    var isNew = !d || !d.id, st = S.settings || {}, tbl = kind === 'quote' ? 'quotes' : 'invoices';
    var vals = d ? Object.assign({}, d) : Object.assign({ issue_date: ymd(today()), status: 'draft', vat_rate: st.vat_registered ? st.vat_rate : 0 }, kind === 'quote' ? { valid_until: ymd(addDays(today(), 14)) } : { due_date: ymd(addDays(today(), st.payment_terms_days || 14)) }, preset || {});
    var items = d ? itemsOf(kind, d.id) : (preset && preset._items) || [];
    var title = isNew ? (kind === 'quote' ? 'New quote' : 'New invoice') : (kind === 'quote' ? 'Quote ' : 'Invoice ') + d.number;
    var extraBtns = isNew ? '' : '<div class="fld full" style="flex-direction:row;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="doc-print" data-kind="' + kind + '" data-id="' + d.id + '">Print / save PDF</button><button type="button" class="btn sm" data-act="doc-email" data-kind="' + kind + '" data-id="' + d.id + '">Email to client</button>' +
      (kind === 'quote' ? '<button type="button" class="btn sm" data-act="quote-to-invoice" data-id="' + d.id + '">Turn into invoice</button>' : '<button type="button" class="btn sm" data-act="new-payment" data-invoice="' + d.id + '">Record payment</button>') + '<span class="meta">Save first if you changed anything.</span></div>';
    openForm({
      title: title, fields: docFields(kind, vals), values: vals, extra: linesEditor(items) + extraBtns, onInput: updateTotals,
      save: async function (data) {
        var lines = readLines();
        if (!lines.length) return 'Add at least one line item.';
        delete data._items;
        var r;
        if (isNew) {
          var num = await sb.rpc('next_doc_number', { kind: kind }); if (num.error) return dbErr(num);
          data.number = num.data;
          if (preset && preset.lead_id) data.lead_id = preset.lead_id;
          if (preset && preset.quote_id) data.quote_id = preset.quote_id;
          r = await sb.from(tbl).insert(data).select().single();
        } else r = await sb.from(tbl).update(data).eq('id', d.id).select().single();
        if (r.error) return dbErr(r);
        upsertLocal(S[tbl], r.data);
        var le = await saveLines(kind, r.data.id, lines); if (le) return le;
        if (isNew && kind === 'quote' && preset && preset.lead_id) { var lr = await sb.from('leads').update({ status: 'quote_sent', est_value: totals(lines, data.vat_rate).total }).eq('id', preset.lead_id).select().single(); if (!lr.error) upsertLocal(S.leads, lr.data); }
        toast((kind === 'quote' ? 'Quote ' : 'Invoice ') + r.data.number + ' saved'); render();
      },
      del: isNew ? null : async function () {
        if (kind === 'invoice' && invPaid(d) > 0) return 'Payments are recorded against this invoice. Cancel it instead of deleting.';
        var r = await sb.from(tbl).delete().eq('id', d.id); if (r.error) return dbErr(r);
        S[tbl] = S[tbl].filter(function (x) { return x.id !== d.id; }); S.items = S.items.filter(function (i) { return i[kind + '_id'] !== d.id; }); toast('Deleted'); render();
      }
    });
    var cs = $('m-client_id');
    if (cs) cs.addEventListener('change', function () { var ms = $('m-matter_id'); ms.innerHTML = '<option value="">Not linked</option>' + S.matters.filter(function (m) { return m.client_id === cs.value; }).map(function (m) { return '<option value="' + m.id + '">' + esc(m.ref + ' · ' + m.title) + '</option>'; }).join(''); });
  }
  P2['new-quote'] = function (el) { if (!S.clients.length) { toast('Add a client first'); return; } editDoc('quote', null, el.dataset.client ? { client_id: el.dataset.client, matter_id: el.dataset.matter || null } : null); };
  P2['new-invoice'] = function (el) { if (!S.clients.length) { toast('Add a client first'); return; } editDoc('invoice', null, el.dataset.client ? { client_id: el.dataset.client, matter_id: el.dataset.matter || null } : null); };
  P2['open-doc'] = function (el) { var k = el.dataset.kind; editDoc(k, byId(S[k === 'quote' ? 'quotes' : 'invoices'], el.dataset.id)); };
  P2['doc-print'] = function (el) { var k = el.dataset.kind, d = byId(S[k === 'quote' ? 'quotes' : 'invoices'], el.dataset.id); printHtml(docHtml(k, d)); };
  P2['doc-email'] = async function (el) {
    var k = el.dataset.kind, tbl = k === 'quote' ? 'quotes' : 'invoices', d = byId(S[tbl], el.dataset.id), c = byId(S.clients, d.client_id) || {};
    if (!c.email) { toast('Add an email address to the client first.'); return; }
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again to send to ' + c.email; return; }
    el.disabled = true; el.textContent = 'Sending…';
    var st = S.settings || {}, t = totals(itemsOf(k, d.id), d.vat_rate);
    var subject = (k === 'quote' ? 'Quotation ' : 'Invoice ') + d.number + ' from ' + (st.trading_name || 'Labour Law Alliance');
    var err = await emailDoc(c.email, subject, docHtml(k, d), (k === 'quote' ? 'Quotation ' : 'Invoice ') + d.number + '\nTotal: ' + R2(t.total) + '\n\n' + (st.trading_name || '') + '\n' + (st.phone || '') + ' · ' + (st.email || ''));
    el.disabled = false;
    if (err) { el.textContent = 'Email to client'; el.dataset.confirm = ''; toast(err); return; }
    var upd = k === 'quote' ? { status: d.status === 'draft' ? 'sent' : d.status } : { status: d.status === 'draft' ? 'sent' : d.status, sent_at: new Date().toISOString() };
    var r = await sb.from(tbl).update(upd).eq('id', d.id).select().single(); if (!r.error) upsertLocal(S[tbl], r.data);
    el.textContent = 'Sent'; toast('Emailed to ' + c.email + ' (copy to the office)'); render();
  };
  P2['quote-to-invoice'] = function (el) {
    var q = byId(S.quotes, el.dataset.id);
    $('modal-root').innerHTML = '';
    editDoc('invoice', null, { client_id: q.client_id, matter_id: q.matter_id, quote_id: q.id, vat_rate: q.vat_rate, notes: q.notes, _items: itemsOf('quote', q.id).map(function (i) { return { description: i.description, qty: i.qty, unit_price: i.unit_price }; }) });
  };
  P2['lead-quote'] = function (el) {
    var l = byId(S.leads, el.dataset.id);
    if (!l.client_id) { toast('Make the enquiry a client first, then quote.'); return; }
    editDoc('quote', null, { client_id: l.client_id, matter_id: l.matter_id || null, lead_id: l.id });
  };

  V.quotes = function () {
    var tab = S.ui.qTab || 'Invoices';
    var tabs = '<div class="subtabs">' + ['Invoices', 'Quotes'].map(function (x) { return '<button data-qtab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    var body;
    if (tab === 'Quotes') {
      body = '<div class="panel"><div class="tbl"><table><tr><th>No.</th><th>Client</th><th>Date</th><th>Valid until</th><th style="text-align:right">Total</th><th>Status</th></tr>' +
        (S.quotes.map(function (q) { var t = totals(itemsOf('quote', q.id), q.vat_rate); return '<tr class="click" data-act="open-doc" data-kind="quote" data-id="' + q.id + '"><td class="mono">' + esc(q.number) + '</td><td>' + esc(clientName(q.client_id)) + '</td><td class="mono">' + fmt(q.issue_date) + '</td><td class="mono">' + fmt(q.valid_until) + '</td><td class="mono" style="text-align:right">' + R2(t.total) + (q.monthly ? ' /month' : '') + '</td><td>' + quotePill(q.status) + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('No quotes yet.') + '</td></tr>') + '</table></div></div>';
    } else {
      var open = S.invoices.filter(function (i) { var s = invState(i); return s.key !== 'paid' && s.key !== 'cancelled' && s.key !== 'draft'; });
      body = '<div class="grid g4"><div class="panel stat"><b>' + R2(open.reduce(function (s, i) { return s + invState(i).bal; }, 0)) + '</b><span>Owed by clients</span></div><div class="panel stat"><b style="color:var(--red)">' + R2(S.invoices.filter(function (i) { return invState(i).key === 'overdue'; }).reduce(function (s, i) { return s + invState(i).bal; }, 0)) + '</b><span>Overdue</span></div><div class="panel stat"><b>' + S.invoices.filter(function (i) { return i.status === 'draft'; }).length + '</b><span>Draft invoices</span></div><div class="panel stat"><b>' + R2(S.payments.filter(function (p) { return p.account === 'business' && D(p.received_on) >= new Date(today().getFullYear(), today().getMonth(), 1); }).reduce(function (s, p) { return s + Number(p.amount); }, 0)) + '</b><span>Fees received this month</span></div></div>' +
        '<div class="panel"><div class="tbl"><table><tr><th>No.</th><th>Client</th><th>Matter</th><th>Date</th><th>Due</th><th style="text-align:right">Total</th><th style="text-align:right">Balance</th><th>Status</th></tr>' +
        (S.invoices.map(function (i) { var s = invState(i), m = byId(S.matters, i.matter_id); return '<tr class="click" data-act="open-doc" data-kind="invoice" data-id="' + i.id + '"><td class="mono">' + esc(i.number) + '</td><td>' + esc(clientName(i.client_id)) + '</td><td class="mono">' + (m ? esc(m.ref) : '—') + '</td><td class="mono">' + fmt(i.issue_date) + '</td><td class="mono">' + fmt(i.due_date) + '</td><td class="mono" style="text-align:right">' + R2(invTotal(i)) + '</td><td class="mono" style="text-align:right">' + (s.key === 'cancelled' ? '—' : R2(s.bal)) + '</td><td>' + pill(s.label, s.cls) + '</td></tr>'; }).join('') || '<tr><td colspan="8">' + empty('No invoices yet.') + '</td></tr>') + '</table></div></div>';
    }
    var warn = (S.settings && !S.settings.bank_account) ? '<div class="callout p-amber">Your bank details are not set, so invoices say “please contact us” instead. <a href="#settings">Add them in Company settings</a>.</div>' : '';
    return head('Quotes & invoices', 'Quotes and invoices', 'Numbers are issued automatically. Quotes and invoices use your firm and banking details from Company settings, and can be printed to PDF or emailed to the client.', '<button class="btn pri" data-act="new-invoice">New invoice</button><button class="btn" data-act="new-quote">New quote</button>') + warn + tabs + body;
  };

  /* ----- Payments ----- */
  function paymentFields() {
    var openInv = S.invoices.filter(function (i) { var s = invState(i).key; return s !== 'paid' && s !== 'cancelled'; });
    return [
      { k: 'client_id', label: 'Received from', type: 'select', req: true, blank: 'Choose a client', options: S.clients.map(function (c) { return [c.id, c.name]; }) },
      { k: 'invoice_id', label: 'For invoice', type: 'select', blank: 'Not for an invoice (e.g. trust deposit)', options: openInv.map(function (i) { return [i.id, i.number + ' · ' + clientName(i.client_id) + ' · balance ' + R2(invState(i).bal)]; }) },
      { k: 'amount', label: 'Amount (R)', type: 'number', step: 0.01, req: true },
      { k: 'received_on', label: 'Date received', type: 'date', req: true },
      { k: 'method', label: 'Method', type: 'select', options: ['EFT', 'Cash', 'Card', 'Payment link', 'Other'] },
      { k: 'account', label: 'Paid into', type: 'select', options: [['business', 'Business account (fees)'], ['trust', 'Trust account (client money)']], hint: 'Money held for a client goes to trust (Legal Practice Act s86).' },
      { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
      { k: 'reference', label: 'Reference on the deposit' },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true }
    ];
  }
  function editPayment(p, preset) {
    var isNew = !p || !p.id;
    openForm({
      title: isNew ? 'Record payment' : 'Payment', fields: paymentFields(), values: p || Object.assign({ received_on: ymd(today()), method: 'EFT', account: 'business' }, preset || {}),
      save: async function (d) {
        var r = isNew ? await sb.from('payments').insert(d).select().single() : await sb.from('payments').update(d).eq('id', p.id).select().single();
        if (r.error) return dbErr(r);
        upsertLocal(S.payments, r.data); S.payments.sort(function (a, b) { return a.received_on < b.received_on ? 1 : -1; });
        toast('Payment of ' + R2(r.data.amount) + ' recorded'); render();
      },
      del: isNew ? null : async function () { var r = await sb.from('payments').delete().eq('id', p.id); if (r.error) return dbErr(r); S.payments = S.payments.filter(function (x) { return x.id !== p.id; }); toast('Payment deleted'); render(); }
    });
    var inv = $('m-invoice_id');
    if (inv) inv.addEventListener('change', function () { var i = byId(S.invoices, inv.value); if (!i) return; $('m-client_id').value = i.client_id; if (!$('m-amount').value) $('m-amount').value = invState(i).bal; if (i.matter_id) $('m-matter_id').value = i.matter_id; $('m-reference').value = $('m-reference').value || i.number; });
  }
  P2['new-payment'] = function (el) { var i = el.dataset.invoice && byId(S.invoices, el.dataset.invoice); $('modal-root').innerHTML = ''; editPayment(null, i ? { invoice_id: i.id, client_id: i.client_id, matter_id: i.matter_id, amount: invState(i).bal, reference: i.number } : null); };
  P2['open-payment'] = function (el) { editPayment(byId(S.payments, el.dataset.id)); };
  P2['remind'] = async function (el) {
    var i = byId(S.invoices, el.dataset.id), c = byId(S.clients, i.client_id) || {};
    if (!c.email) { toast('Add an email address to the client first.'); return; }
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again to send'; return; }
    el.disabled = true;
    var st = S.settings || {}, s = invState(i);
    var err = await emailDoc(c.email, 'Reminder: invoice ' + i.number + ' – ' + R2(s.bal) + ' outstanding', docHtml('invoice', i), 'This is a friendly reminder that ' + R2(s.bal) + ' is outstanding on invoice ' + i.number + (i.due_date ? ', due ' + fmt(i.due_date) : '') + '.\n\n' + (st.trading_name || '') + ' · ' + (st.phone || ''));
    el.disabled = false; el.textContent = err ? 'Send reminder' : 'Reminder sent'; el.dataset.confirm = ''; toast(err || 'Reminder emailed to ' + c.email);
  };
  V.payments = function () {
    var owed = S.invoices.filter(function (i) { var k = invState(i).key; return k !== 'paid' && k !== 'cancelled' && k !== 'draft'; });
    var age = function (i) { return -daysLeft(i.issue_date); };
    var buckets = [['Under 30 days', function (a) { return a < 30; }], ['30–60 days', function (a) { return a >= 30 && a < 60; }], ['60–90 days', function (a) { return a >= 60 && a < 90; }], ['Over 90 days', function (a) { return a >= 90; }]];
    var monthStart = new Date(today().getFullYear(), today().getMonth(), 1);
    var trustIn = S.payments.filter(function (p) { return p.account === 'trust'; }).reduce(function (s, p) { return s + Number(p.amount); }, 0);
    return head('Payments', 'Money received and money owed', 'Record payments against invoices. Money held for clients goes to the trust account and is kept apart from fees.', '<button class="btn pri" data-act="new-payment">Record payment</button>') +
      '<div class="grid g4">' + buckets.map(function (b, ix) { var v = owed.filter(function (i) { return b[1](age(i)); }).reduce(function (s, i) { return s + invState(i).bal; }, 0); return '<div class="panel stat"><b' + (ix >= 2 && v ? ' style="color:var(--red)"' : '') + '>' + R2(v) + '</b><span>Owed, ' + b[0] + '</span></div>'; }).join('') + '</div>' +
      '<div class="grid g2"><div class="panel"><div class="hd"><h2>Received</h2><span class="meta">This month: ' + R2(S.payments.filter(function (p) { return p.account === 'business' && D(p.received_on) >= monthStart; }).reduce(function (s, p) { return s + Number(p.amount); }, 0)) + ' fees · Trust received to date: ' + R2(trustIn) + '</span></div><div class="tbl"><table><tr><th>Date</th><th>From</th><th>For</th><th>Method</th><th>Account</th><th style="text-align:right">Amount</th></tr>' +
      (S.payments.map(function (p) { var i = byId(S.invoices, p.invoice_id); return '<tr class="click" data-act="open-payment" data-id="' + p.id + '"><td class="mono">' + fmt(p.received_on) + '</td><td>' + esc(clientName(p.client_id)) + '</td><td class="mono">' + (i ? esc(i.number) : esc(p.reference || '—')) + '</td><td>' + esc(p.method) + '</td><td>' + pill(p.account === 'trust' ? 'Trust' : 'Business', p.account === 'trust' ? 'p-gold' : 'p-blue') + '</td><td class="mono" style="text-align:right">' + R2(p.amount) + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('No payments recorded yet.') + '</td></tr>') + '</table></div></div>' +
      '<div class="panel"><div class="hd"><h2>Still owed</h2></div><div class="tbl"><table><tr><th>Invoice</th><th>Client</th><th>Days</th><th style="text-align:right">Balance</th><th></th></tr>' +
      (owed.sort(function (a, b) { return age(b) - age(a); }).map(function (i) { var s = invState(i); return '<tr><td class="mono"><a href="#" data-act="open-doc" data-kind="invoice" data-id="' + i.id + '">' + esc(i.number) + '</a></td><td>' + esc(clientName(i.client_id)) + '</td><td class="mono">' + age(i) + (s.key === 'overdue' ? ' ' + pill('Overdue', 'p-red') : '') + '</td><td class="mono" style="text-align:right">' + R2(s.bal) + '</td><td style="white-space:nowrap"><button class="btn sm" data-act="new-payment" data-invoice="' + i.id + '">Paid</button> <button class="btn sm" data-act="remind" data-id="' + i.id + '">Send reminder</button></td></tr>'; }).join('') || '<tr><td colspan="5">' + empty('Nothing owed.') + '</td></tr>') + '</table></div></div></div>';
  };

  /* ----- Matter billing and documents tabs ----- */
  function matterBilling(m) {
    var inv = S.invoices.filter(function (i) { return i.matter_id === m.id; }), q = S.quotes.filter(function (x) { return x.matter_id === m.id; }), pay = S.payments.filter(function (p) { return p.matter_id === m.id; });
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn pri" data-act="new-invoice" data-client="' + m.client_id + '" data-matter="' + m.id + '">New invoice</button><button class="btn" data-act="new-quote" data-client="' + m.client_id + '" data-matter="' + m.id + '">New quote</button></div>' +
      '<div class="list">' + q.map(function (x) { return '<div class="row" style="align-items:center"><div class="grow"><a href="#" data-act="open-doc" data-kind="quote" data-id="' + x.id + '"><b>Quote ' + esc(x.number) + '</b></a><div class="meta">' + fmt(x.issue_date) + '</div></div><span class="mono">' + R2(totals(itemsOf('quote', x.id), x.vat_rate).total) + '</span>' + quotePill(x.status) + '</div>'; }).join('') +
      inv.map(function (x) { var s = invState(x); return '<div class="row" style="align-items:center"><div class="grow"><a href="#" data-act="open-doc" data-kind="invoice" data-id="' + x.id + '"><b>Invoice ' + esc(x.number) + '</b></a><div class="meta">' + fmt(x.issue_date) + '</div></div><span class="mono">' + R2(invTotal(x)) + '</span>' + pill(s.label, s.cls) + '</div>'; }).join('') +
      pay.map(function (p) { return '<div class="row" style="align-items:center"><div class="grow"><a href="#" data-act="open-payment" data-id="' + p.id + '"><b>Payment</b></a><div class="meta">' + fmt(p.received_on) + ' · ' + esc(p.method) + '</div></div><span class="mono">' + R2(p.amount) + '</span>' + pill(p.account === 'trust' ? 'Trust' : 'Business', p.account === 'trust' ? 'p-gold' : 'p-blue') + '</div>'; }).join('') + '</div>' +
      ((q.length + inv.length + pay.length) ? '' : empty('No quotes, invoices or payments for this matter yet.'));
  }
  function matterDocs(m) {
    var ds = S.docs.filter(function (d) { return d.matter_id === m.id; });
    return '<div style="margin-bottom:12px"><button class="btn pri" data-act="upload" data-matter="' + m.id + '" data-client="' + (m.client_id || '') + '">Upload files</button></div>' + docTable(ds);
  }

  /* ----- Document centre ----- */
  var fileSize = function (b) { return !b ? '' : b < 1024 * 1024 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; };
  function docTable(ds) {
    return '<div class="tbl"><table><tr><th>Name</th><th>Folder</th><th>Linked to</th><th>Added</th><th>Size</th><th></th></tr>' + (ds.map(function (d) { var m = byId(S.matters, d.matter_id); return '<tr><td><b>' + esc(d.name) + '</b></td><td>' + esc(d.folder) + '</td><td>' + (m ? '<a href="#matter=' + m.id + '">' + esc(m.ref) + '</a>' : d.client_id ? esc(clientName(d.client_id)) : '—') + '</td><td class="mono">' + fmt(d.created_at) + '</td><td class="mono">' + fileSize(d.size_bytes) + '</td><td style="white-space:nowrap"><button class="btn sm" data-act="doc-open" data-id="' + d.id + '">Open</button> <button class="btn sm danger" data-act="doc-del" data-id="' + d.id + '">Delete</button></td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('No documents here yet.') + '</td></tr>') + '</table></div>';
  }
  P2['doc-open'] = async function (el) { var d = byId(S.docs, el.dataset.id); var w = window.open('', '_blank'); var r = await sb.storage.from('documents').createSignedUrl(d.storage_path, 120); if (r.error) { if (w) w.close(); toast(r.error.message); return; } if (w) w.location = r.data.signedUrl; else location.href = r.data.signedUrl; };
  P2['doc-del'] = async function (el) {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again'; return; }
    var d = byId(S.docs, el.dataset.id);
    var s = await sb.storage.from('documents').remove([d.storage_path]); if (s.error) { toast(s.error.message); return; }
    var r = await sb.from('documents').delete().eq('id', d.id); if (r.error) { toast(r.error.message); return; }
    S.docs = S.docs.filter(function (x) { return x.id !== d.id; }); toast('Deleted'); render();
  };
  async function storeFile(file, meta) {
    var safe = file.name.replace(/[^\w.\- ]+/g, '_').slice(-120);
    var path = meta.folder.replace(/[^\w\- ]+/g, '_') + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) + '-' + safe;
    var up = await sb.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (up.error) return up.error.message;
    var r = await sb.from('documents').insert({ folder: meta.folder, name: meta.name || file.name, storage_path: path, mime: file.type || null, size_bytes: file.size, client_id: meta.client_id || null, matter_id: meta.matter_id || null }).select().single();
    if (r.error) { await sb.storage.from('documents').remove([path]); return r.error.message; }
    S.docs.unshift(r.data); return null;
  }
  P2['upload'] = function (el) {
    openForm({
      title: 'Upload files', saveLabel: 'Upload',
      fields: [
        { k: 'folder', label: 'Folder', type: 'select', options: FOLDERS },
        { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
        { k: 'client_id', label: 'Client', type: 'select', blank: 'Not linked', options: S.clients.map(function (c) { return [c.id, c.name]; }) }
      ],
      values: { folder: S.ui.folder && S.ui.folder !== 'All' ? S.ui.folder : (el.dataset.matter ? 'Correspondence' : 'General'), matter_id: el.dataset.matter || '', client_id: el.dataset.client || '' },
      extra: '<div class="fld full"><label for="up-files">Files (up to 25 MB each)</label><input type="file" id="up-files" multiple></div>',
      save: async function (d) {
        var files = $('up-files').files; if (!files.length) return 'Choose at least one file.';
        for (var i = 0; i < files.length; i++) { if (files[i].size > 26214400) return files[i].name + ' is larger than 25 MB.'; }
        for (var j = 0; j < files.length; j++) { $('mmsg').textContent = 'Uploading ' + (j + 1) + ' of ' + files.length + '…'; var err = await storeFile(files[j], d); if (err) return files[j].name + ': ' + err; }
        toast(files.length + ' file' + (files.length > 1 ? 's' : '') + ' uploaded'); render();
      }
    });
  };

  /* Contract templates: starting drafts with merge fields. An attorney must review every document before use. */
  var CONTRACTS = {
    'Engagement letter': { folder: 'Client agreements', fields: ['Fee arrangement', 'Scope of work'], body: function (v) { return [
      ['Engagement', 'You have asked ' + v.FIRM + ' to act for you in ' + v.MATTER + '. This letter confirms the terms on which we will do so.'],
      ['Scope of work', v['Scope of work']],
      ['Fees', 'Our fees will be charged as follows: ' + v['Fee arrangement'] + '. Disbursements such as travel, copying and courier costs are charged separately. CCMA arbitrations seldom result in a costs order, so you should expect to pay our fees regardless of the outcome unless we have agreed otherwise in writing.'],
      ['Responsible attorney', v.ATTORNEY + ' will be responsible for your matter.'],
      ['Your information', 'We process your personal information only to provide legal services to you, in line with the Protection of Personal Information Act, 2013. We keep it confidential and secure.'],
      ['Ending the mandate', 'Either of us may end this mandate on written notice. Fees for work done up to that date remain payable.'],
      ['Acceptance', 'Please sign below to confirm that you accept these terms.']]; } },
    'Contingency fee agreement': { folder: 'Client agreements', fields: ['Success fee percentage', 'Normal hourly rate'], body: function (v) { return [
      ['Agreement', 'This agreement is entered into in terms of the Contingency Fees Act 66 of 1997 between ' + v.CLIENT + ' and ' + v.FIRM + ' in respect of ' + v.MATTER + '.'],
      ['Success', 'Success means an award, order or settlement in the client’s favour that results in payment to the client.'],
      ['Success fee', 'If the matter succeeds, the client will pay a success fee of ' + v['Success fee percentage'] + ' of the total amount awarded or obtained. In terms of the Act the success fee may not exceed 25% of that amount, nor double the normal fee calculated at ' + v['Normal hourly rate'] + ' per hour.'],
      ['No success', 'If the matter does not succeed, no fee is payable, but agreed disbursements remain payable.'],
      ['Settlement', 'Any settlement offer will be communicated to the client, who alone decides whether to accept it.'],
      ['Cooling-off', 'The client may withdraw from this agreement within 14 days of signing by written notice.']]; } },
    'Employment contract': { folder: 'Contracts', fields: ['Employer', 'Employee', 'Job title', 'Start date', 'Monthly salary', 'Workplace', 'Working hours'], body: function (v) { return [
      ['Parties', 'This contract is between ' + v.Employer + ' (“the Employer”) and ' + v.Employee + ' (“the Employee”).'],
      ['Appointment', 'The Employee is appointed as ' + v['Job title'] + ' from ' + v['Start date'] + ', working at ' + v.Workplace + '. The first three months are a probationary period.'],
      ['Hours of work', v['Working hours'] + '. Overtime is worked only by agreement and paid in terms of the Basic Conditions of Employment Act.'],
      ['Remuneration', 'The Employee will earn ' + v['Monthly salary'] + ' per month, paid monthly in arrears by EFT, less lawful deductions.'],
      ['Leave', 'Annual leave of 21 consecutive days (15 working days) per annual leave cycle, sick leave and family responsibility leave as provided in the Basic Conditions of Employment Act.'],
      ['Termination', 'Either party may end this contract on notice as required by section 37 of the Basic Conditions of Employment Act. Dismissal will be for a fair reason and after a fair procedure.'],
      ['Policies', 'The Employee must comply with the Employer’s disciplinary code, policies and procedures as amended from time to time.'],
      ['Confidentiality', 'The Employee will keep the Employer’s confidential information secret during and after employment.']]; } },
    'Fixed-term contract': { folder: 'Contracts', fields: ['Employer', 'Employee', 'Job title', 'Start date', 'End date', 'Reason for the fixed term', 'Monthly salary'], body: function (v) { return [
      ['Parties', 'This fixed-term contract is between ' + v.Employer + ' and ' + v.Employee + '.'],
      ['Term', 'The Employee is employed as ' + v['Job title'] + ' from ' + v['Start date'] + ' until ' + v['End date'] + ', when this contract ends automatically.'],
      ['Reason for fixed term', 'The contract is for a fixed term because: ' + v['Reason for the fixed term'] + '. Where section 198B of the Labour Relations Act applies, a fixed term longer than three months must be justified, and the Employee may not be treated less favourably than a comparable permanent employee.'],
      ['Remuneration', v['Monthly salary'] + ' per month.'],
      ['No expectation of renewal', 'Nothing in this contract creates an expectation of renewal or of permanent employment.']]; } },
    'Restraint of trade': { folder: 'Contracts', fields: ['Employer', 'Employee', 'Restricted area', 'Restraint period'], body: function (v) { return [
      ['Parties', 'This restraint agreement is between ' + v.Employer + ' and ' + v.Employee + '.'],
      ['Protectable interests', 'The Employee will have access to the Employer’s confidential information, client relationships and trade connections, which the Employer is entitled to protect.'],
      ['Restraint', 'For ' + v['Restraint period'] + ' after employment ends, the Employee will not, within ' + v['Restricted area'] + ', be employed by or involved in a business that competes with the Employer, or solicit the Employer’s clients or staff.'],
      ['Reasonableness', 'The parties agree the restraint is reasonable. A court may enforce it in part if it finds any part unreasonable.']]; } },
    'Settlement agreement': { folder: 'CCMA & Labour Court', fields: ['Employer', 'Employee', 'Settlement amount', 'Payment date', 'Case number'], body: function (v) { return [
      ['Parties', 'This agreement settles the dispute between ' + v.Employer + ' and ' + v.Employee + ' under case number ' + v['Case number'] + '.'],
      ['Payment', 'The Employer will pay the Employee ' + v['Settlement amount'] + ' on or before ' + v['Payment date'] + ', less any tax the Employer must deduct, into the Employee’s nominated bank account.'],
      ['Full and final settlement', 'This payment is in full and final settlement of all claims arising from the Employee’s employment and its termination, including the dispute referred under the case number above.'],
      ['Withdrawal', 'The Employee will withdraw the referral within 5 days of receiving payment.'],
      ['Making it an award', 'Either party may apply for this agreement to be made an arbitration award in terms of section 142A of the Labour Relations Act.']]; } },
    'Retainer agreement': { folder: 'Client agreements', fields: ['Monthly fee', 'Services included', 'Start date'], body: function (v) { return [
      ['Parties', 'This retainer is between ' + v.CLIENT + ' and ' + v.FIRM + '.'],
      ['Services', 'For a monthly fee of ' + v['Monthly fee'] + ', from ' + v['Start date'] + ', we will provide: ' + v['Services included'] + '.'],
      ['Work outside the retainer', 'Work not listed above, such as Labour Court litigation, is quoted and charged separately.'],
      ['Payment', 'The monthly fee is invoiced in advance and payable within ' + ((S.settings && S.settings.payment_terms_days) || 14) + ' days.'],
      ['Term', 'The retainer runs month to month and either party may end it on one calendar month’s written notice.']]; } }
  };
  function contractHtml(type, v) {
    var st = S.settings || {}, secs = CONTRACTS[type].body(v);
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(type) + '</title><style>body{font-family:Georgia,serif;color:#1d1d1d;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.6}h1{font-family:Arial,sans-serif;letter-spacing:2px;font-size:18px;color:#a07a12}h2{font-family:Arial,sans-serif;font-size:14px;margin:22px 0 4px}.hd{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #16203b;padding-bottom:12px;margin-bottom:20px;font-family:Arial,sans-serif;font-size:12px;color:#444}.sig{display:flex;gap:40px;margin-top:50px}.sig div{flex:1;border-top:1px solid #444;padding-top:6px;font-size:13px}</style></head><body>' +
      '<div class="hd"><div><img src="https://labourlawalliance.co.za/assets/images/logo.png?v=2" width="150" alt=""></div><div style="text-align:right">' + [st.legal_name || st.trading_name, st.address1, st.address2, st.phone, st.email].filter(Boolean).map(esc).join('<br>') + '</div></div>' +
      '<h1>' + esc(type.toUpperCase()) + '</h1>' + secs.map(function (s, i) { return '<h2>' + (i + 1) + '. ' + esc(s[0]) + '</h2><p>' + esc(s[1]) + '</p>'; }).join('') +
      '<div class="sig"><div>Signed for ' + esc(v.SIGN1) + '<br>Date:</div><div>Signed for ' + esc(v.SIGN2) + '<br>Date:</div></div></body></html>';
  }
  function contractValues() {
    var type = $('ct-type').value, def = CONTRACTS[type], v = {};
    var c = byId(S.clients, $('ct-client').value) || {}, m = byId(S.matters, $('ct-matter').value) || {};
    var st = S.settings || {};
    v.FIRM = st.legal_name || st.trading_name || 'Labour Law Alliance'; v.CLIENT = c.name || '[Client]'; v.MATTER = m.title ? m.title + (m.ref ? ' (' + m.ref + ')' : '') : '[matter]'; v.ATTORNEY = m.attorney || '[attorney]';
    def.fields.forEach(function (f, i) { var el = $('ct-f' + i); v[f] = el && el.value.trim() ? el.value.trim() : '[' + f + ']'; });
    if (def.fields.indexOf('Case number') >= 0 && !$('ct-f' + def.fields.indexOf('Case number')).value && m.case_no) v['Case number'] = m.case_no;
    var emp = def.fields.indexOf('Employer') >= 0;
    v.SIGN1 = emp ? v.Employer : v.CLIENT; v.SIGN2 = emp ? v.Employee : v.FIRM;
    return { type: type, v: v };
  }
  function previewContract() { var p = $('ct-preview'); if (!p) return; var cv = contractValues(); p.srcdoc = contractHtml(cv.type, cv.v); }

  V.documents = function () {
    var tab = S.ui.dTab || 'Library', folder = S.ui.folder || 'All';
    var tabs = '<div class="subtabs">' + ['Library', 'Create a document'].map(function (x) { return '<button data-dtab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    if (tab === 'Library') {
      var q = (S.ui.docQ || '').toLowerCase();
      var list = S.docs.filter(function (d) { return (folder === 'All' || d.folder === folder) && (!q || (d.name + ' ' + clientName(d.client_id)).toLowerCase().indexOf(q) >= 0); });
      var counts = {}; S.docs.forEach(function (d) { counts[d.folder] = (counts[d.folder] || 0) + 1; });
      var folders = ['All'].concat(FOLDERS, Object.keys(counts).filter(function (f) { return FOLDERS.indexOf(f) < 0; }));
      return head('Document centre', 'Contracts, templates and case files', 'Files are stored privately; only signed-in staff can open them. Link files to a matter or client to find them from there.', '<button class="btn pri" data-act="upload">Upload files</button>') + tabs +
        '<div class="grid" style="grid-template-columns:minmax(0,220px) minmax(0,1fr)"><div class="panel" style="display:flex;flex-direction:column;gap:2px">' + folders.map(function (f) { var n = f === 'All' ? S.docs.length : (counts[f] || 0); return '<button class="btn" style="justify-content:space-between;border:0;' + (f === folder ? 'background:var(--soft);font-weight:600' : '') + '" data-folder="' + esc(f) + '"><span>' + esc(f) + '</span><span class="mono">' + n + '</span></button>'; }).join('') + '</div>' +
        '<div class="panel"><div class="hd"><h2>' + esc(folder === 'All' ? 'All documents' : folder) + '</h2><input type="search" id="doc-q" placeholder="Search documents" value="' + esc(S.ui.docQ || '') + '" style="max-width:260px"></div>' + docTable(list) + '</div></div>';
    }
    var types = Object.keys(CONTRACTS), type = S.ui.ctType || types[0], def = CONTRACTS[type];
    return head('Document centre', 'Create a document', 'Choose a template, link the client and matter, and fill in the details. Every template is a starting draft: an attorney must check it before it is signed.') + tabs +
      '<div class="grid g2"><div class="panel"><div class="f" style="grid-template-columns:1fr">' +
      '<div class="fld"><label for="ct-type">Template</label><select id="ct-type">' + types.map(function (t) { return '<option' + (t === type ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="ct-client">Client</label><select id="ct-client"><option value="">Choose a client</option>' + S.clients.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="ct-matter">Matter</label><select id="ct-matter"><option value="">Not linked</option>' + S.matters.map(function (m) { return '<option value="' + m.id + '">' + esc(m.ref + ' · ' + m.title) + '</option>'; }).join('') + '</select></div>' +
      def.fields.map(function (f, i) { return '<div class="fld"><label for="ct-f' + i + '">' + esc(f) + '</label><input type="text" id="ct-f' + i + '"></div>'; }).join('') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-act="ct-save">Save to document centre</button><button class="btn" data-act="ct-print">Print / save PDF</button></div><span class="msg" id="ct-msg"></span></div></div>' +
      '<div class="panel" style="padding:0;overflow:hidden"><iframe id="ct-preview" title="Document preview" style="width:100%;height:640px;border:0;background:#fff"></iframe></div></div>';
  };
  P2['ct-print'] = function () { var cv = contractValues(); printHtml(contractHtml(cv.type, cv.v)); };
  P2['ct-save'] = async function (el) {
    var cv = contractValues(), def = CONTRACTS[cv.type];
    if (!$('ct-client').value) { $('ct-msg').textContent = 'Choose a client first.'; return; }
    el.disabled = true;
    var name = cv.type + ' – ' + cv.v.CLIENT + ' – ' + ymd(today()) + '.html';
    var file = new File([contractHtml(cv.type, cv.v)], name.replace(/[\/\\]/g, '-'), { type: 'text/html' });
    var err = await storeFile(file, { folder: def.folder, name: name, client_id: $('ct-client').value, matter_id: $('ct-matter').value || null });
    el.disabled = false;
    if (err) { $('ct-msg').textContent = err; return; }
    toast('Saved to ' + def.folder); S.ui.dTab = 'Library'; S.ui.folder = def.folder; render();
  };

  /* ----- Company settings ----- */
  var SETTINGS_FIELDS = {
    'Company details': [
      { k: 'trading_name', label: 'Trading name', req: true }, { k: 'legal_name', label: 'Registered name', ph: 'e.g. Labour Law Alliance Inc.' },
      { k: 'reg_no', label: 'Company registration no.' }, { k: 'lpc_no', label: 'Legal Practice Council no.' },
      { k: 'address1', label: 'Street address' }, { k: 'address2', label: 'Suburb, city, code' },
      { k: 'phone', label: 'Phone (calls)' }, { k: 'whatsapp', label: 'WhatsApp' },
      { k: 'email', label: 'Main email', type: 'email' }, { k: 'website', label: 'Website' },
      { k: 'office_hours', label: 'Office hours' }, { k: 'document_footer', label: 'Footer on quotes and invoices', full: true }
    ],
    'Banking & invoicing': [
      { k: 'bank_name', label: 'Business account: bank' }, { k: 'bank_holder', label: 'Business account: holder' },
      { k: 'bank_account', label: 'Business account: number' }, { k: 'bank_branch', label: 'Business account: branch code' },
      { k: 'bank_type', label: 'Business account: type', ph: 'e.g. Current account' },
      { k: 'trust_bank_name', label: 'Trust account: bank' }, { k: 'trust_holder', label: 'Trust account: holder' },
      { k: 'trust_account', label: 'Trust account: number' }, { k: 'trust_branch', label: 'Trust account: branch code' },
      { k: 'vat_registered', label: 'Registered for VAT', type: 'checkbox' }, { k: 'vat_no', label: 'VAT number' }, { k: 'vat_rate', label: 'VAT rate %', type: 'number', step: 0.01 },
      { k: 'payment_terms_days', label: 'Payment terms (days)', type: 'number' }, { k: 'hourly_rate', label: 'Standard hourly rate (R)', type: 'number', step: 50 },
      { k: 'quote_prefix', label: 'Quote number prefix' }, { k: 'next_quote_no', label: 'Next quote number', type: 'number' },
      { k: 'invoice_prefix', label: 'Invoice number prefix' }, { k: 'next_invoice_no', label: 'Next invoice number', type: 'number' }
    ]
  };
  V.settings = function () {
    var tab = S.ui.sTab || 'Company details', st = S.settings || {};
    var tabs = '<div class="subtabs">' + ['Company details', 'Banking & invoicing', 'Users', 'Email', 'Integrations'].map(function (x) { return '<button data-stab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    var canEdit = canMoney();
    var body;
    if (tab === 'Email' || tab === 'Integrations') body = settings3(tab);
    else if (tab === 'Users') {
      body = '<div class="panel"><div class="hd"><h2>People with access</h2>' + (isPartner() ? '<button class="btn pri" data-act="invite-staff">Invite staff member</button>' : '') + '</div><div class="tbl"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Signed in before</th><th>Access</th><th></th></tr>' +
        S.staff.map(function (s) { return '<tr><td><b>' + esc(s.full_name || '—') + '</b></td><td class="mono">' + esc(s.email) + '</td><td>' + roleLabel(s.role) + '</td><td>' + (s.user_id ? pill('Yes', 'p-green') : pill('Not yet', 'p-amber')) + '</td><td>' + (s.active ? pill('Active', 'p-green') : pill('Removed', 'p-red')) + '</td><td>' + (isPartner() ? '<button class="btn sm" data-act="edit-staff" data-id="' + s.id + '">Edit</button>' : '') + '</td></tr>'; }).join('') + '</table></div>' +
        '<p class="meta" style="margin-top:10px">Public sign-up is closed: only people invited here can sign in. Invited staff get an email with a link to set up their login.</p></div>' +
        '<div class="panel"><h2 style="margin-bottom:8px">What each role can do</h2><div class="tbl"><table><tr><th>Role</th><th>Matters, clients, inbox, appointments</th><th>Quotes, invoices, payments</th><th>Company & banking settings</th><th>Invite and remove staff</th></tr>' +
        ROLES.map(function (r) { var y = pill('Yes', 'p-green'), n = '<span class="meta">—</span>'; return '<tr><td>' + r[1] + '</td><td>' + y + '</td><td>' + y + '</td><td>' + (r[0] === 'partner' || r[0] === 'bookkeeper' ? y : n) + '</td><td>' + (r[0] === 'partner' ? y : n) + '</td></tr>'; }).join('') + '</table></div></div>';
    } else {
      var fs = SETTINGS_FIELDS[tab];
      body = '<div class="panel"><div class="hd"><h2>' + tab + '</h2><span class="meta">Used on quotes, invoices, contracts and client emails' + (st.updated_at ? ' · last saved ' + fmtDT(st.updated_at) : '') + '</span></div>' +
        (canEdit ? '' : '<div class="callout p-amber" style="margin-bottom:12px">Only a partner or the bookkeeper can change these settings.</div>') +
        (tab === 'Banking & invoicing' ? '<div class="callout p-blue" style="margin-bottom:12px">Bank details print on every invoice. Double-check them: a wrong account number sends client payments to the wrong place.</div>' : '') +
        '<form id="settings-form" class="f">' + fs.map(function (f) { return fieldHtml(f, st[f.k]); }).join('') + '<div class="fld full" style="flex-direction:row;gap:10px;align-items:center"><button class="btn pri" type="submit"' + (canEdit ? '' : ' disabled') + '>Save</button><span class="msg" id="settings-msg"></span></div></form></div>';
    }
    return head('Company settings', 'Firm details, banking and people', 'Set these once. Quotes, invoices, contracts and client emails use them.') + tabs + body;
  };
  function staffForm(s) {
    var isNew = !s;
    openForm({
      title: isNew ? 'Invite staff member' : 'Edit ' + (s.full_name || s.email), saveLabel: isNew ? 'Send invitation' : 'Save',
      fields: [{ k: 'email', label: 'Email', type: 'email', req: true, full: true }, { k: 'full_name', label: 'Full name' }, { k: 'role', label: 'Role', type: 'select', options: ROLES }].concat(isNew ? [] : [{ k: 'active', label: 'Has access to the CRM', type: 'checkbox' }]),
      values: s || { role: 'attorney' },
      save: async function (d) {
        if (isNew) {
          var ses = await sb.auth.getSession(); var token = ses.data.session && ses.data.session.access_token;
          var r = await fetch('https://ktsvmkfrrxuijmgjdbwr.supabase.co/functions/v1/invite-staff', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: 'sb_publishable_E-C0YA_K3UpDWbbWqS9Lng__7pR26p9' }, body: JSON.stringify(d) });
          var j = await r.json().catch(function () { return {}; });
          if (!r.ok) return j.error || 'The invitation failed.';
          var st = await sb.from('staff').select('*').order('email'); if (!st.error) S.staff = st.data;
          toast(j.note || 'Invitation sent'); render(); return;
        }
        var u = await sb.from('staff').update({ email: d.email.toLowerCase(), full_name: d.full_name, role: d.role, active: d.active }).eq('id', s.id).select().single();
        if (u.error) return /partner/i.test(u.error.message) ? 'There must always be at least one active partner.' : dbErr(u);
        upsertLocal(S.staff, u.data); toast('Saved'); render();
      }
    });
  }
  P2['invite-staff'] = function () { staffForm(null); };
  P2['edit-staff'] = function (el) { staffForm(byId(S.staff, el.dataset.id)); };

  function bind2() {
    var sf = $('settings-form');
    if (sf) sf.onsubmit = async function (e) {
      e.preventDefault();
      var fs = SETTINGS_FIELDS[S.ui.sTab || 'Company details'], d = {};
      fs.forEach(function (f) { d[f.k] = readField(f); });
      if ('trading_name' in d && !d.trading_name) { $('settings-msg').textContent = 'Trading name is required.'; return; }
      ['next_quote_no', 'next_invoice_no', 'payment_terms_days', 'vat_rate'].forEach(function (k) { if (k in d && d[k] == null) delete d[k]; });
      ['quote_prefix', 'invoice_prefix'].forEach(function (k) { if (k in d && d[k] == null) d[k] = ''; });
      var btn = sf.querySelector('button[type=submit]'); btn.disabled = true; $('settings-msg').className = 'msg'; $('settings-msg').textContent = 'Saving…';
      var r = await sb.from('company_settings').update(d).eq('id', 1).select().single();
      btn.disabled = false;
      if (r.error) { $('settings-msg').textContent = /rows|PGRST116/i.test(r.error.message + r.error.code) ? 'Only a partner or the bookkeeper can change these settings.' : r.error.message; return; }
      if (!r.data) { $('settings-msg').textContent = 'Only a partner or the bookkeeper can change these settings.'; return; }
      S.settings = r.data; $('settings-msg').className = 'msg ok'; $('settings-msg').textContent = 'Saved';
    };
    // Settings form fields use the modal field ids (m-*); readField reads them the same way.
    var dq = $('doc-q'); if (dq) dq.oninput = function () { S.ui.docQ = dq.value; var p = dq.selectionStart; render(); var n = $('doc-q'); n.focus(); n.setSelectionRange(p, p); };
    var ct = $('ct-type');
    if (ct) {
      ct.onchange = function () { S.ui.ctType = ct.value; render(); };
      ['ct-client', 'ct-matter'].forEach(function (id) { $(id).onchange = previewContract; });
      document.querySelectorAll('[id^="ct-f"]').forEach(function (i) { i.oninput = previewContract; });
      previewContract();
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-qtab],[data-stab],[data-dtab],[data-folder]'); if (!b) return;
    if (b.dataset.qtab) S.ui.qTab = b.dataset.qtab;
    if (b.dataset.stab) S.ui.sTab = b.dataset.stab;
    if (b.dataset.dtab) S.ui.dTab = b.dataset.dtab;
    if (b.dataset.folder) S.ui.folder = b.dataset.folder;
    render();
  });

  /* =====================================================================
     PHASE 3: website analytics, Search Console, page optimiser, domain email
     ===================================================================== */
  S.mail = { state: 'idle', list: [], sel: null, msg: null };
  S.web = { views: null, loading: false, gsc: null, gscLoading: false, audit: null, auditing: false, auditDone: 0, auditTotal: 0, days: 30 };
  async function api(url, opts) {
    var s = await sb.auth.getSession(); var token = s.data.session && s.data.session.access_token;
    opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + token }, opts.headers || {});
    var r = await fetch(url, opts); var j = await r.json().catch(function () { return {}; });
    if (!r.ok && !j.error) j.error = 'Request failed (' + r.status + ')';
    return j;
  }
  function onView(id) { return current() === id; }

  /* ----- Small SVG charts drawn to scale; colours come from the theme ----- */
  function lineChart(labels, series) {
    var W = 640, H = 190, pl = 40, pr = 10, pt = 10, pb = 24, n = labels.length;
    var max = Math.max(1, Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.data); }, [])));
    var step = Math.pow(10, Math.floor(Math.log10(max / 4 || 1))); var tick = Math.max(1, Math.ceil(max / 4 / step) * step); var top = tick * 4;
    var x = function (i) { return pl + (n > 1 ? i * (W - pl - pr) / (n - 1) : 0); }, y = function (v) { return pt + (H - pt - pb) * (1 - v / top); };
    var g = ''; for (var k = 0; k <= 4; k++) g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(k * tick) + '" y2="' + y(k * tick) + '" stroke="var(--line)"/><text x="' + (pl - 6) + '" y="' + (y(k * tick) + 4) + '" text-anchor="end" fill="var(--muted)" font-size="11">' + (k * tick) + '</text>';
    var marks = [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1].filter(function (v, i, a) { return a.indexOf(v) === i; });
    g += marks.map(function (i) { return '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle" fill="var(--muted)" font-size="11">' + esc(labels[i]) + '</text>'; }).join('');
    g += series.map(function (s) { var pts = s.data.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' '); return (s.fill ? '<polygon points="' + x(0) + ',' + y(0) + ' ' + pts + ' ' + x(n - 1) + ',' + y(0) + '" fill="' + s.color + '" opacity=".14"/>' : '') + '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"/>'; }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block" role="img" aria-label="chart">' + g + '</svg>';
  }
  function bars(rows, unit) { var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r[1]; }))); return rows.map(function (r) { return '<div class="row" style="align-items:center;padding:5px 0"><div class="grow" style="word-break:break-all">' + esc(r[0]) + '</div><div style="flex:0 0 110px" class="bar"><i style="width:' + (r[1] / max * 100) + '%"></i></div><span class="mono" style="width:56px;text-align:right">' + r[1] + (unit || '') + '</span></div>'; }).join('') || empty('No data yet.'); }
  function countBy(arr, fn) { var m = {}; arr.forEach(function (x) { var k = fn(x); if (k == null || k === '') return; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); }

  /* ----- Visitors (from /api/track) ----- */
  async function loadViews() {
    if (S.web.loading) return; S.web.loading = true;
    var since = addDays(today(), -(S.web.days - 1)).toISOString(), all = [], from = 0;
    while (true) {
      var r = await sb.from('page_views').select('created_at,path,source,device,country,city,session,landing').gte('created_at', since).order('created_at', { ascending: true }).range(from, from + 999);
      if (r.error) { S.web.views = { error: r.error.message }; break; }
      all = all.concat(r.data); if (r.data.length < 1000 || all.length >= 50000) { S.web.views = all; break; }
      from += 1000;
    }
    S.web.loading = false; if (onView('website')) render();
  }
  function visitorsTab() {
    var v = S.web.views;
    if (!v) { loadViews(); return '<p class="meta">Loading visitor data…</p>'; }
    if (v.error) return '<div class="callout p-red">' + esc(v.error) + '</div>';
    var days = []; for (var i = S.web.days - 1; i >= 0; i--) days.push(ymd(addDays(today(), -i)));
    var sessions = {}; v.forEach(function (p) { sessions[p.session || p.created_at] = p; });
    var perDay = days.map(function (d) { var s = {}; v.forEach(function (p) { if (ymd(p.created_at) === d) s[p.session || p.created_at] = 1; }); return Object.keys(s).length; });
    var viewsDay = days.map(function (d) { return v.filter(function (p) { return ymd(p.created_at) === d; }).length; });
    var live = {}; v.forEach(function (p) { if (Date.now() - D(p.created_at) < 5 * 60000) live[p.session] = 1; });
    var nSess = Object.keys(sessions).length, landings = v.filter(function (p) { return p.landing; });
    var leads30 = S.leads.filter(function (l) { return D(l.created_at) >= addDays(today(), -(S.web.days - 1)) && l.source && l.source !== 'Phone call'; }).length;
    return (v.length ? '' : '<div class="callout p-blue">Visitor counting started with this update. Numbers appear here as people visit the website.</div>') +
      '<div class="grid g4"><div class="panel stat"><b>' + nSess + '</b><span>Visits, last ' + S.web.days + ' days</span></div><div class="panel stat"><b>' + v.length + '</b><span>Pages viewed</span></div><div class="panel stat"><b>' + Object.keys(live).length + '</b><span>On the site now</span></div><div class="panel stat"><b>' + (nSess ? (leads30 / nSess * 100).toFixed(1) : '0.0') + '%</b><span>Visits that sent an enquiry</span></div></div>' +
      '<div class="panel"><div class="hd"><h2>Visits per day</h2><span class="meta"><span style="color:#d3a728">■</span> visits <span style="color:var(--blue)">■</span> page views</span></div>' + lineChart(days.map(function (d) { return fmt(d).replace(/ \d{4}$/, ''); }), [{ data: viewsDay, color: 'var(--blue)' }, { data: perDay, color: '#d3a728', fill: true }]) + '</div>' +
      '<div class="grid g3"><div class="panel"><h2 style="margin-bottom:6px">Where visitors come from</h2>' + bars(countBy(landings, function (p) { return p.source; }).slice(0, 10)) + '</div><div class="panel"><h2 style="margin-bottom:6px">Most viewed pages</h2>' + bars(countBy(v, function (p) { return p.path; }).slice(0, 10)) + '</div><div class="panel"><h2 style="margin-bottom:6px">Devices</h2>' + bars(countBy(landings, function (p) { return { mobile: 'Phone', tablet: 'Tablet', desktop: 'Computer' }[p.device]; })) + '<h2 style="margin:14px 0 6px">Cities</h2>' + bars(countBy(landings, function (p) { return p.city ? p.city + (p.country && p.country !== 'ZA' ? ' (' + p.country + ')' : '') : null; }).slice(0, 8)) + '</div></div>' +
      '<p class="meta">Counted without cookies or IP addresses. Visitors who switch analytics off in the cookie banner are not counted. Search engines and bots are ignored.</p>';
  }
  function sourcesTab() {
    var v = S.web.views; if (!v) { loadViews(); }
    var L = S.leads.filter(function (l) { return l.form !== 'manual'; });
    var bySource = countBy(S.leads, function (l) { return l.source || (l.page ? 'Website (source not recorded)' : null); });
    var byPage = countBy(S.leads, function (l) { return l.page; });
    var conv = '';
    if (v && !v.error && v.length) {
      var land = countBy(v.filter(function (p) { return p.landing; }), function (p) { return p.path; });
      conv = '<div class="panel"><div class="hd"><h2>Pages that turn visits into enquiries</h2><span class="meta">Last ' + S.web.days + ' days</span></div><div class="tbl"><table><tr><th>Page</th><th style="text-align:right">Visits starting here</th><th style="text-align:right">Enquiries</th><th style="text-align:right">Rate</th></tr>' +
        land.slice(0, 15).map(function (r) { var n = L.filter(function (l) { return (l.landing_page || l.page) === r[0] && D(l.created_at) >= addDays(today(), -(S.web.days - 1)); }).length; return '<tr><td>' + esc(r[0]) + '</td><td class="mono" style="text-align:right">' + r[1] + '</td><td class="mono" style="text-align:right">' + n + '</td><td class="mono" style="text-align:right">' + (r[1] ? (n / r[1] * 100).toFixed(1) : '0') + '%</td></tr>'; }).join('') + '</table></div></div>';
    }
    return '<div class="grid g2"><div class="panel"><h2 style="margin-bottom:6px">Enquiries by source</h2>' + bars(bySource) + '</div><div class="panel"><h2 style="margin-bottom:6px">Enquiries by page</h2>' + bars(byPage.slice(0, 12)) + '</div></div>' + conv +
      '<div class="panel"><div class="hd"><h2>Recent enquiries and where they came from</h2></div><div class="tbl"><table><tr><th>Received</th><th>Name</th><th>Source</th><th>First page</th><th>Form page</th><th>Stage</th></tr>' +
      (S.leads.slice(0, 25).map(function (l) { return '<tr class="click" data-lead="' + l.id + '"><td class="mono">' + fmt(l.created_at) + '</td><td>' + esc(leadName(l)) + '</td><td>' + esc(l.source || '—') + '</td><td class="mono">' + esc(l.landing_page || '—') + '</td><td class="mono">' + esc(l.page || '—') + '</td><td>' + leadPill(l.status) + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('No enquiries yet.') + '</td></tr>') + '</table></div></div>' +
      '<p class="meta">Website enquiries record the source from now on. Older ones show the page only. For phone, WhatsApp and walk-in enquiries, choose the source when you add them.</p>';
  }

  /* ----- Search Console and rankings (from /api/gsc) ----- */
  async function loadGsc() { if (S.web.gscLoading) return; S.web.gscLoading = true; S.web.gsc = await api('/api/gsc?days=28'); S.web.gscLoading = false; if (onView('website') || onView('settings')) render(); }
  function gscSetup(err) {
    return (err ? '<div class="callout p-red">' + esc(err) + '</div>' : '') + '<div class="panel"><h2 style="margin-bottom:8px">Connect Google Search Console</h2><p class="sub" style="margin-bottom:10px">Search Console shows the Google searches your pages appear for, clicks, and your real Google positions. Connecting takes about ten minutes and is free.</p><ol style="margin:0;padding-left:20px;line-height:1.8">' +
      '<li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> and create a project (for example “LLA CRM”).</li>' +
      '<li>Open <b>APIs &amp; Services → Library</b>, search for <b>Google Search Console API</b> and click <b>Enable</b>.</li>' +
      '<li>Open <b>IAM &amp; Admin → Service Accounts</b>, create one (for example “crm-reader”), then on its <b>Keys</b> tab choose <b>Add key → JSON</b>. A key file downloads.</li>' +
      '<li>In <a href="https://search.google.com/search-console/users?resource_id=sc-domain%3Alabourlawalliance.co.za" target="_blank" rel="noopener">Search Console → Settings → Users and permissions</a>, add the service account’s email address (it ends in <code>iam.gserviceaccount.com</code>) with <b>Restricted</b> permission.</li>' +
      '<li>In <a href="https://vercel.com/" target="_blank" rel="noopener">Vercel</a> → project <b>labour</b> → <b>Settings → Environment Variables</b>, add <code>GSC_SERVICE_ACCOUNT</code>, paste the whole contents of the key file as the value, mark it <b>Sensitive</b>, and save. Then redeploy (Deployments → ⋯ → Redeploy).</li></ol><p class="meta" style="margin-top:10px">Keep the key file private. Paste it into Vercel only, never into an email or chat.</p></div>';
  }
  function gscTab() {
    var g = S.web.gsc;
    if (!g) { loadGsc(); return '<p class="meta">Checking Search Console…</p>'; }
    if (!g.connected) return gscSetup(g.error);
    var sum = function (a, k) { return a.reduce(function (s, r) { return s + r[k]; }, 0); };
    var clicks = sum(g.byDate, 'clicks'), imp = sum(g.byDate, 'impressions'), pos = imp ? g.byDate.reduce(function (s, r) { return s + r.position * r.impressions; }, 0) / imp : 0;
    return '<div class="banner"><span class="led"></span><b>Connected</b><span class="meta">' + esc(g.account) + ' · ' + fmt(g.start) + ' to ' + fmt(g.end) + ' (Google data runs about 2 days behind)</span></div>' +
      '<div class="grid g4"><div class="panel stat"><b>' + clicks + '</b><span>Clicks from Google</span></div><div class="panel stat"><b>' + imp + '</b><span>Times shown in Google</span></div><div class="panel stat"><b>' + (imp ? (clicks / imp * 100).toFixed(1) : '0') + '%</b><span>Click-through rate</span></div><div class="panel stat"><b>' + (pos ? pos.toFixed(1) : '—') + '</b><span>Average position</span></div></div>' +
      '<div class="panel"><div class="hd"><h2>Clicks and impressions per day</h2><span class="meta"><span style="color:#d3a728">■</span> clicks <span style="color:var(--blue)">■</span> impressions ÷ 10</span></div>' + lineChart(g.byDate.map(function (r) { return fmt(r.date).replace(/ \d{4}$/, ''); }), [{ data: g.byDate.map(function (r) { return Math.round(r.impressions / 10); }), color: 'var(--blue)' }, { data: g.byDate.map(function (r) { return r.clicks; }), color: '#d3a728', fill: true }]) + '</div>' +
      '<div class="grid g2"><div class="panel"><h2 style="margin-bottom:6px">Top searches</h2><div class="tbl"><table><tr><th>Search</th><th style="text-align:right">Clicks</th><th style="text-align:right">Shown</th><th style="text-align:right">Position</th></tr>' + g.queries.slice(0, 20).map(function (q) { return '<tr><td>' + esc(q.query) + '</td><td class="mono" style="text-align:right">' + q.clicks + '</td><td class="mono" style="text-align:right">' + q.impressions + '</td><td class="mono" style="text-align:right">' + q.position.toFixed(1) + '</td></tr>'; }).join('') + '</table></div></div>' +
      '<div class="panel"><h2 style="margin-bottom:6px">Top pages</h2><div class="tbl"><table><tr><th>Page</th><th style="text-align:right">Clicks</th><th style="text-align:right">Shown</th><th style="text-align:right">Position</th></tr>' + g.pages.slice(0, 20).map(function (p) { return '<tr><td style="word-break:break-all">' + esc(p.page.replace(/^https?:\/\/[^/]+/, '') || '/') + '</td><td class="mono" style="text-align:right">' + p.clicks + '</td><td class="mono" style="text-align:right">' + p.impressions + '</td><td class="mono" style="text-align:right">' + p.position.toFixed(1) + '</td></tr>'; }).join('') + '</table></div></div></div>';
  }
  function rankingsTab() {
    var g = S.web.gsc;
    if (!g) { loadGsc(); return '<p class="meta">Checking Search Console…</p>'; }
    var note = '<p class="meta">Rankings come from Google Search Console, which reports your real average Google position for each search. Ubersuggest has no public data connection, so it can’t feed the CRM directly.</p>';
    if (!g.connected) return note + gscSetup(g.error);
    var pages = {};
    g.pageQueries.forEach(function (r) { var p = r.page.replace(/^https?:\/\/[^/]+/, '') || '/'; var x = pages[p] = pages[p] || { page: p, imp: 0, clicks: 0, wpos: 0, top: null }; x.imp += r.impressions; x.clicks += r.clicks; x.wpos += r.position * r.impressions; if (!x.top || r.impressions > x.top.impressions) x.top = r; });
    var list = Object.keys(pages).map(function (k) { var x = pages[k]; x.pos = x.imp ? x.wpos / x.imp : 0; return x; });
    var action = function (x) { if (x.pos <= 3) return ['Strong: keep it up to date', 'p-green']; if (x.pos <= 10) return ['Page 1: improve the title and description to win more clicks', 'p-blue']; if (x.pos <= 20) return ['Page 2: add content and links from related pages to reach page 1', 'p-amber']; return ['Deep: needs much more content on “' + x.top.query + '”', 'p-red']; };
    var opp = list.filter(function (x) { return x.pos > 3 && x.pos <= 20; }).sort(function (a, b) { return b.imp - a.imp; });
    return note + '<div class="panel"><div class="hd"><h2>Best opportunities</h2><span class="meta">Pages in positions 4–20 with the most searches: small improvements move these onto page 1 or into the top 3</span></div><div class="tbl"><table><tr><th>Page</th><th>Main search</th><th style="text-align:right">Position</th><th style="text-align:right">Shown</th><th style="text-align:right">Clicks</th><th>What to do</th></tr>' +
      (opp.concat(list.filter(function (x) { return opp.indexOf(x) < 0; }).sort(function (a, b) { return b.imp - a.imp; })).slice(0, 40).map(function (x) { var a = action(x); return '<tr class="click" data-opt="' + esc(x.page) + '"><td style="word-break:break-all"><b>' + esc(x.page) + '</b></td><td>' + esc(x.top.query) + '</td><td class="mono" style="text-align:right">' + x.pos.toFixed(1) + '</td><td class="mono" style="text-align:right">' + x.imp + '</td><td class="mono" style="text-align:right">' + x.clicks + '</td><td>' + pill(a[0], a[1]) + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('No ranking data yet.') + '</td></tr>') + '</table></div></div>';
  }

  /* ----- Page optimiser: checks the live pages from the sitemap ----- */
  async function runAudit() {
    if (S.web.auditing) return; S.web.auditing = true; S.web.audit = []; S.web.auditDone = 0;
    try {
      var xml = await (await fetch('/sitemap.xml', { cache: 'no-store' })).text();
      var paths = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(function (m) { try { return new URL(m[1]).pathname; } catch (e) { return null; } }).filter(Boolean);
      S.web.auditTotal = paths.length;
      var queue = paths.slice(), out = [];
      var worker = async function () {
        while (queue.length) {
          var p = queue.shift();
          try {
            var html = await (await fetch(p, { cache: 'no-store' })).text();
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var main = doc.querySelector('main') || doc.body;
            main.querySelectorAll('script,style,noscript').forEach(function (n) { n.remove(); });
            var words = (main.textContent || '').split(/\s+/).filter(function (w) { return /\p{L}/u.test(w); }).length;
            var links = Array.from(new Set(Array.from(main.querySelectorAll('a[href^="/"]')).map(function (a) { return a.getAttribute('href').split('#')[0]; }))).length;
            var imgs = Array.from(doc.querySelectorAll('img')), noalt = imgs.filter(function (i) { return !(i.getAttribute('alt') || '').trim(); }).length;
            var desc = (doc.querySelector('meta[name="description"]') || {}).content || '';
            var canon = (doc.querySelector('link[rel="canonical"]') || {}).href || '';
            out.push({ path: p, title: doc.title || '', desc: desc, h1: doc.querySelectorAll('h1').length, h1t: ((doc.querySelector('h1') || {}).textContent || '').trim(), words: words, links: links, imgs: imgs.length, noalt: noalt, schema: !!doc.querySelector('script[type="application/ld+json"]') || /application\/ld\+json/.test(html), canon: canon, og: !!doc.querySelector('meta[property="og:title"]'), noindex: /noindex/i.test((doc.querySelector('meta[name="robots"]') || {}).content || '') });
          } catch (e) { out.push({ path: p, error: String(e.message || e) }); }
          S.web.auditDone++; if (S.web.auditDone % 5 === 0 && onView('website')) { S.web.audit = out.slice(); render(); }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      S.web.audit = out;
    } catch (e) { S.web.audit = [{ path: 'sitemap', error: String(e.message || e) }]; }
    S.web.auditing = false; S.web.auditAt = new Date(); if (onView('website')) render();
  }
  function auditChecks(p) {
    var deep = /^\/(labour-lawyers\/|services\/|insights\/)/.test(p.path), target = deep ? 800 : 300;
    return { target: target, checks: [
      ['Title is 30–60 characters', p.title.length >= 30 && p.title.length <= 60, p.title.length + ' characters', 'Rewrite the title to 30–60 characters, with the main search phrase near the start.'],
      ['Meta description is 120–160 characters', p.desc.length >= 120 && p.desc.length <= 160, p.desc.length + ' characters', 'Write a 120–160 character description that says what the page offers and invites a call.'],
      ['Exactly one H1 heading', p.h1 === 1, p.h1 + ' found', 'Use one H1 that matches the page’s main topic.'],
      ['At least ' + target + ' words of content', p.words >= target, p.words + ' words', 'Add about ' + Math.max(0, target - p.words) + ' words: the steps in the process, time limits, costs and a short FAQ.'],
      ['At least 5 internal links in the content', p.links >= 5, p.links + ' links', 'Link to related services, locations and articles from the body text.'],
      ['Every image has alt text', p.noalt === 0, p.imgs ? (p.imgs - p.noalt) + ' of ' + p.imgs : 'No images', 'Describe each image in its alt text.'],
      ['Structured data (schema.org)', p.schema, p.schema ? 'Present' : 'Missing', 'Add LegalService or Article structured data.'],
      ['Canonical tag', !!p.canon, p.canon ? 'Present' : 'Missing', 'Add a canonical link to the page’s own address.'],
      ['Social sharing tags (Open Graph)', p.og, p.og ? 'Present' : 'Missing', 'Add og:title, og:description and og:image.'],
      ['Visible to search engines', !p.noindex, p.noindex ? 'noindex set' : 'Indexable', 'Remove the noindex robots tag.']
    ] };
  }
  function optimiserTab() {
    if (!S.web.audit && !S.web.auditing) runAudit();
    var a = (S.web.audit || []).filter(function (p) { return !p.error; }).map(function (p) { var c = auditChecks(p); p._c = c; p._score = Math.round(c.checks.filter(function (x) { return x[1]; }).length / c.checks.length * 100); return p; }).sort(function (x, y) { return x._score - y._score || x.words - y.words; });
    var errs = (S.web.audit || []).filter(function (p) { return p.error; });
    var sel = a.find(function (p) { return p.path === S.ui.optPage; }) || a[0];
    var avg = a.length ? Math.round(a.reduce(function (s, p) { return s + p._score; }, 0) / a.length) : 0;
    var col = function (s) { return s >= 90 ? 'green' : s >= 70 ? 'amber' : 'red'; };
    return '<div class="banner"><span class="led"></span><b>' + (S.web.auditing ? 'Checking pages… ' + S.web.auditDone + ' of ' + (S.web.auditTotal || '?') : 'Checked ' + a.length + ' live pages') + '</b><span class="meta">' + (S.web.auditAt ? 'at ' + fmtT(S.web.auditAt) : '') + '</span><button class="btn sm" data-act="rerun-audit" style="margin-left:auto"' + (S.web.auditing ? ' disabled' : '') + '>Check again</button></div>' +
      (errs.length ? '<div class="callout p-red">Could not check: ' + errs.map(function (e) { return esc(e.path); }).join(', ') + '</div>' : '') +
      (a.length ? '<div class="grid g4"><div class="panel stat"><b style="color:var(--' + col(avg) + ')">' + avg + '</b><span>Average score out of 100</span></div><div class="panel stat"><b>' + a.filter(function (p) { return p._score >= 90; }).length + '</b><span>Pages scoring 90+</span></div><div class="panel stat"><b>' + a.filter(function (p) { return !p._c.checks[3][1]; }).length + '</b><span>Pages with too little content</span></div><div class="panel stat"><b>' + a.filter(function (p) { return !p._c.checks[0][1] || !p._c.checks[1][1]; }).length + '</b><span>Titles or descriptions to fix</span></div></div>' : '') +
      (sel ? '<div class="grid g21"><div class="panel"><div class="hd"><div style="min-width:0"><div class="eyebrow">Checking</div><h2 style="word-break:break-all">' + esc(sel.path) + '</h2></div><div style="text-align:right"><div style="font-family:var(--display);font-size:26px;font-weight:700;color:var(--' + col(sel._score) + ')">' + sel._score + '/100</div><a class="meta" href="' + esc(sel.path) + '" target="_blank" rel="noopener">Open page</a></div></div>' +
        '<dl class="kv" style="margin-bottom:12px"><dt>Title</dt><dd>' + esc(sel.title) + '</dd><dt>Description</dt><dd>' + esc(sel.desc) + '</dd><dt>H1</dt><dd>' + esc(sel.h1t) + '</dd></dl><div class="list">' +
        sel._c.checks.map(function (c) { return '<div class="row" style="align-items:flex-start;padding:7px 0">' + pill(c[1] ? 'Pass' : 'Fix', c[1] ? 'p-green' : 'p-amber') + '<div class="grow">' + c[0] + (c[1] ? '' : '<div class="meta">' + c[3] + '</div>') + '</div><span class="mono">' + c[2] + '</span></div>'; }).join('') + '</div></div>' +
        '<div class="panel"><div class="hd"><h2>All pages</h2><span class="meta">Lowest score first</span></div><div class="list" style="max-height:640px;overflow:auto">' + a.map(function (p) { return '<button class="row" data-opt="' + esc(p.path) + '" style="border:0;border-bottom:1px solid var(--line);background:' + (p === sel ? 'var(--soft)' : 'none') + ';text-align:left;cursor:pointer;width:100%;align-items:center"><span class="grow" style="word-break:break-all">' + esc(p.path) + '<span class="meta" style="display:block">' + p.words + ' words</span></span>' + pill(String(p._score), 'p-' + col(p._score)) + '</button>'; }).join('') + '</div></div></div>' : '');
  }
  P2['rerun-audit'] = function () { S.web.audit = null; runAudit(); render(); };

  V.website = function () {
    var tab = S.ui.wTab || 'Visitors';
    var tabs = ['Visitors', 'Lead sources', 'Search Console', 'Rankings', 'Page optimiser'];
    var body = tab === 'Visitors' ? visitorsTab() : tab === 'Lead sources' ? sourcesTab() : tab === 'Search Console' ? gscTab() : tab === 'Rankings' ? rankingsTab() : optimiserTab();
    return head('Website', 'labourlawalliance.co.za', 'Who visits the site, how they find it, where enquiries come from, and which pages need work.', '<a class="btn" href="https://labourlawalliance.co.za" target="_blank" rel="noopener">Open website</a>') +
      '<div class="subtabs">' + tabs.map(function (x) { return '<button data-wtab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>' + body;
  };

  /* ----- Domain email (from /api/mail) ----- */
  function mailBanner() {
    var m = S.mail;
    if (m.state === 'idle') { loadMail(); return '<span class="led off" style="margin-left:12px"></span><b>info@ mailbox</b><span class="meta">Checking…</span>'; }
    if (m.state === 'unconfigured') return '<span class="led off" style="margin-left:12px"></span><b>info@ mailbox</b><span class="meta">Not connected yet · <a href="#settings" data-stab="Email">Connect</a></span>';
    if (m.state === 'error') return '<span class="led off" style="margin-left:12px;background:var(--red)"></span><b>info@ mailbox</b><span class="meta">' + esc(m.error) + '</span>';
    if (m.state === 'loading') return '<span class="led off" style="margin-left:12px"></span><b>info@ mailbox</b><span class="meta">Syncing…</span>';
    return '<span class="led" style="margin-left:12px"></span><b>' + esc(m.user || 'info@') + '</b><span class="meta">Synced ' + (m.at ? fmtT(m.at) : '') + ' · ' + m.list.filter(function (x) { return !x.seen; }).length + ' unread</span>';
  }
  async function loadMail() {
    if (S.mail.state === 'loading') return; S.mail.state = 'loading';
    var j = await api('/api/mail?action=list&limit=50');
    if (j.configured === false) S.mail.state = 'unconfigured';
    else if (j.error || j.ok === false) { S.mail.state = 'error'; S.mail.error = j.error || 'Could not read the mailbox.'; }
    else { S.mail.state = 'ok'; S.mail.list = j.messages || []; S.mail.user = j.user; S.mail.at = new Date(); }
    if (onView('inbox') || onView('settings')) render();
  }
  function who(a) { a = a && a[0]; return a ? (a.name || a.address) : '—'; }
  function mailView() {
    var m = S.mail;
    if (m.state === 'idle' || m.state === 'loading') { if (m.state === 'idle') loadMail(); return '<div class="panel"><p class="meta">Loading the mailbox…</p></div>'; }
    if (m.state === 'unconfigured') return '<div class="panel">' + mailSetup() + '</div>';
    if (m.state === 'error') return '<div class="callout p-red">' + esc(m.error) + ' <button class="btn sm" data-act="mail-refresh">Try again</button></div>';
    var msg = m.msg;
    var reader = !m.sel ? empty('Choose an email on the left.') : !msg ? '<p class="meta">Opening…</p>' : msg.error ? '<div class="callout p-red">' + esc(msg.error) + '</div>' :
      '<div style="display:flex;flex-direction:column;gap:10px"><div><div class="meta">' + fmtDT(msg.date) + '</div><h2 style="margin-top:4px">' + esc(msg.subject) + '</h2><div class="meta">From <b>' + esc(who(msg.from)) + '</b> &lt;' + esc((msg.from[0] || {}).address || '') + '&gt;' + (msg.to.length ? ' · to ' + esc(msg.to.map(function (x) { return x.address; }).join(', ')) : '') + '</div></div>' +
      (msg.html ? '<iframe sandbox="" referrerpolicy="no-referrer" id="mail-frame" style="width:100%;height:420px;border:1px solid var(--line);border-radius:8px;background:#fff" title="Email"></iframe>' : '<div style="white-space:pre-wrap;border:1px solid var(--line);border-radius:8px;padding:12px;max-height:420px;overflow:auto">' + esc(msg.text) + '</div>') +
      (msg.attachments.length ? '<div class="meta">Attachments (open them in Outlook): ' + msg.attachments.map(function (a) { return esc(a.filename); }).join(', ') + '</div>' : '') +
      '<form id="reply-form" class="f" style="grid-template-columns:1fr"><div class="fld"><label for="reply-body">Reply to ' + esc((msg.from[0] || {}).address || '') + '</label><textarea id="reply-body" placeholder="Write your reply…"></textarea></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn pri" type="submit">Send reply</button><button class="btn" type="button" data-act="mail-to-lead">Add sender to pipeline</button><span class="msg" id="reply-msg"></span></div></form></div>';
    return '<div class="banner">' + mailBanner() + '<button class="btn sm" data-act="mail-refresh" style="margin-left:auto">Refresh</button></div>' +
      '<div class="panel inbox"><div class="ilist">' + (m.list.map(function (x) { return '<button class="imsg' + (x.seen ? '' : ' unread') + (m.sel === x.uid ? ' on' : '') + '" data-act="mail-open" data-uid="' + x.uid + '"><span class="dot"></span><span style="flex:1;min-width:0"><span style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(who(x.from)) + '</b><span class="mono">' + fmt(x.date) + '</span></span><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x.subject) + '</span></span></button>'; }).join('') || empty('The inbox is empty.')) + '</div><div class="iread">' + reader + '</div></div>';
  }
  function mailSetup() {
    return '<h2 style="margin-bottom:8px">Connect the info@ mailbox</h2><p class="sub" style="margin-bottom:10px">Once connected, email to info@labourlawalliance.co.za shows in the CRM inbox, and replies you send from the CRM also appear in Outlook’s Sent folder.</p><ol style="margin:0;padding-left:20px;line-height:1.8">' +
      '<li>In <a href="https://vercel.com/" target="_blank" rel="noopener">Vercel</a> → project <b>labour</b> → <b>Settings → Environment Variables</b>, add <code>MAIL_USER</code> with the value <code>info@labourlawalliance.co.za</code>.</li>' +
      '<li>Add <code>MAIL_PASS</code> with the mailbox password (the one Outlook uses). Mark it <b>Sensitive</b>.</li>' +
      '<li>Save, then redeploy (Deployments → ⋯ → Redeploy). Come back here and click Refresh.</li></ol><p class="meta" style="margin-top:10px">The CRM reads mail from your Afrihost server (thragg.aserv.co.za, secure port 993). The password stays in Vercel; the CRM page never sees it.</p>';
  }
  P2['mail-refresh'] = function () { S.mail.state = 'idle'; S.mail.msg = null; render(); };
  P2['mail-open'] = async function (el) {
    var uid = Number(el.dataset.uid); S.mail.sel = uid; S.mail.msg = null; render();
    var j = await api('/api/mail?action=read&uid=' + uid);
    if (S.mail.sel !== uid) return;
    S.mail.msg = j.error ? { error: j.error } : j; var it = S.mail.list.find(function (x) { return x.uid === uid; }); if (it) it.seen = true; render();
  };
  P2['mail-to-lead'] = function () {
    var msg = S.mail.msg; if (!msg) return; var f = msg.from[0] || {}; var parts = (f.name || '').split(' ');
    openForm({ title: 'Add to pipeline', fields: [{ k: 'first_name', label: 'First name', req: true }, { k: 'last_name', label: 'Last name' }, { k: 'email', label: 'Email', type: 'email' }, { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'service', label: 'What it is about', type: 'select', blank: 'Choose…', options: DISPUTES }, { k: 'message', label: 'Notes', type: 'textarea', full: true }],
      values: { first_name: parts[0] || f.address, last_name: parts.slice(1).join(' '), email: f.address, message: msg.subject + '\n\n' + (msg.text || '').slice(0, 1500) },
      save: async function (d) { d.form = 'contact'; d.status = 'new'; d.source = 'Email'; d.subject = msg.subject.slice(0, 200); d.ref = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()); d.seen_at = new Date().toISOString(); var r = await sb.from('leads').insert(d).select().single(); if (r.error) return dbErr(r); upsertLocal(S.leads, r.data); toast('Added to the pipeline'); render(); } });
  };

  /* ----- Settings: Email and Integrations ----- */
  async function dnsCheck() {
    var q = function (name, type) { return fetch('https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + type).then(function (r) { return r.json(); }).then(function (j) { return (j.Answer || []).map(function (a) { return a.data.replace(/^"|"$/g, '').replace(/" "/g, ''); }); }).catch(function () { return null; }); };
    var res = await Promise.all([q('labourlawalliance.co.za', 'MX'), q('labourlawalliance.co.za', 'TXT'), q('_dmarc.labourlawalliance.co.za', 'TXT'), q('resend._domainkey.labourlawalliance.co.za', 'TXT'), q('send.labourlawalliance.co.za', 'TXT')]);
    var spf = (res[1] || []).find(function (t) { return /^v=spf1/.test(t); });
    S.dns = [
      ['Incoming mail (MX) goes to the Afrihost spam filter', !!(res[0] || []).join(' ').match(/ucebox|aserv/i), (res[0] || []).join(', ') || 'none found'],
      ['SPF record allows Afrihost to send', !!spf, spf || 'none found'],
      ['Resend can send for the domain (SPF on send.)', (res[4] || []).some(function (t) { return /amazonses|spf/.test(t); }), (res[4] || []).join(' ') || 'none found'],
      ['Resend DKIM signing key published', (res[3] || []).some(function (t) { return /p=/.test(t); }), (res[3] || []).length ? 'Present' : 'none found'],
      ['DMARC policy published', (res[2] || []).some(function (t) { return /v=DMARC1/i.test(t); }), (res[2] || []).join(' ') || 'none found']
    ];
    if (onView('settings')) render();
  }
  function settings3(tab) {
    if (tab === 'Email') {
      if (S.mail.state === 'idle') loadMail();
      if (!S.dns) { S.dns = 'loading'; dnsCheck(); }
      var st = S.mail.state;
      return '<div class="panel"><div class="hd"><h2>Domain mailboxes</h2><button class="btn sm" data-act="mail-refresh">Check again</button></div><div class="tbl"><table><tr><th>Address</th><th>Used for</th><th>Connection</th><th>Status</th></tr>' +
        '<tr><td><b>' + esc(S.mail.user || 'info@labourlawalliance.co.za') + '</b></td><td>Main inbox: client email and copies of website forms</td><td>IMAP, thragg.aserv.co.za</td><td>' + (st === 'ok' ? pill('Connected', 'p-green') + '<div class="meta">' + S.mail.list.length + ' recent emails · synced ' + fmtT(S.mail.at) + '</div>' : st === 'unconfigured' ? pill('Not connected', 'p-amber') : st === 'error' ? pill('Problem', 'p-red') + '<div class="meta">' + esc(S.mail.error) + '</div>' : pill('Checking…')) + '</td></tr>' +
        '<tr><td><b>website@labourlawalliance.co.za</b></td><td>Sends website form emails, quotes, invoices and CRM sign-in links</td><td>Resend</td><td>' + pill('Connected', 'p-green') + '</td></tr></table></div></div>' +
        (st === 'unconfigured' || st === 'error' ? '<div class="panel">' + mailSetup() + '</div>' : '') +
        '<div class="panel"><div class="hd"><h2>Email health</h2><span class="meta">Live check of your domain’s email records</span></div><div class="list">' + (Array.isArray(S.dns) ? S.dns.map(function (d) { return '<div class="row" style="align-items:center">' + pill(d[1] ? 'OK' : 'Check', d[1] ? 'p-green' : 'p-amber') + '<div class="grow">' + d[0] + '<div class="meta" style="word-break:break-all">' + esc(d[2]) + '</div></div></div>'; }).join('') : '<p class="meta">Checking…</p>') + '</div>' +
        '<p class="meta" style="margin-top:8px">Afrihost’s spam filter must deliver to thragg.aserv.co.za, not to the domain name (which now points at the website). That was fixed on 28 November 2026.</p></div>';
    }
    if (!S.web.gsc) loadGsc();
    if (S.mail.state === 'idle') loadMail();
    var g = S.web.gsc, tracked = S.web.views && !S.web.views.error ? S.web.views.length : null;
    if (S.web.views == null) loadViews();
    var row = function (name, what, state, note, link) { return '<div class="panel"><div class="hd"><h2>' + name + '</h2>' + (state === 'ok' ? pill('Connected', 'p-green') : state === 'wait' ? pill('Checking…') : state === 'warn' ? pill('Needs attention', 'p-red') : pill('Not connected', 'p-amber')) + '</div><p class="meta" style="margin:0 0 8px">' + what + '</p><div class="meta">' + note + '</div>' + (link || '') + '</div>'; };
    return '<div class="grid g2">' +
      row('Website visitor counting', 'Counts visits, pages, sources, devices and cities for the Website tab. No cookies or IP addresses.', 'ok', tracked == null ? 'Loading…' : tracked + ' page views in the last ' + S.web.days + ' days.') +
      row('Google Search Console', 'Searches, clicks, impressions and real Google positions for the Website tab.', !g ? 'wait' : g.connected ? 'ok' : g.error ? 'warn' : 'off', !g ? '' : g.connected ? 'Reading as ' + esc(g.account) : g.error ? esc(g.error) : 'Add a Google service account key to connect.', g && !g.connected ? '<div style="margin-top:8px"><button class="btn sm" data-wtab="Search Console" data-goweb="1">How to connect</button></div>' : '') +
      row('info@ mailbox', 'Shows domain email in the CRM inbox and files CRM replies in Sent.', S.mail.state === 'ok' ? 'ok' : S.mail.state === 'error' ? 'warn' : S.mail.state === 'unconfigured' ? 'off' : 'wait', S.mail.state === 'ok' ? 'Reading ' + esc(S.mail.user) : S.mail.state === 'error' ? esc(S.mail.error) : 'Add the mailbox password in Vercel to connect.', S.mail.state !== 'ok' ? '<div style="margin-top:8px"><button class="btn sm" data-stab="Email">How to connect</button></div>' : '') +
      row('Resend', 'Sends website form emails, quotes, invoices, reminders, replies and sign-in links from the domain.', 'ok', 'Domain labourlawalliance.co.za verified.') +
      row('Supabase', 'The CRM database, private document storage and staff sign-in.', 'ok', 'Project labour-law-alliance (London).') +
      row('SEO platform (Ubersuggest, Semrush, Ahrefs)', 'Keyword volumes and competitor research.', 'off', 'Ubersuggest has no public data connection. The Rankings tab uses Google’s own position data from Search Console instead. Semrush or Ahrefs can be added later with a paid API plan.') +
      row('WhatsApp Business', 'Log WhatsApp enquiries on 068 008 9790 automatically.', 'off', 'Needs the WhatsApp Business Platform (Meta). Until then, add WhatsApp enquiries with “New enquiry” and choose WhatsApp as the source.') +
      row('Calendar (Outlook or Google)', 'Two-way sync of CRM appointments.', 'off', 'Not set up. Appointments live in the CRM for now.') +
      '</div>';
  }

  function bind3() {
    var f = $('mail-frame'); if (f && S.mail.msg && S.mail.msg.html) f.srcdoc = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: data: cid:; style-src \'unsafe-inline\'; font-src https:">' + S.mail.msg.html;
    var rf = $('reply-form');
    if (rf) rf.onsubmit = async function (e) {
      e.preventDefault(); var msg = S.mail.msg, body = $('reply-body').value.trim(); if (!body) return;
      var btn = rf.querySelector('button[type=submit]'); btn.disabled = true; $('reply-msg').className = 'msg'; $('reply-msg').textContent = 'Sending…';
      var quoted = '\n\n---\nOn ' + fmtDT(msg.date) + ', ' + who(msg.from) + ' wrote:\n' + (msg.text || '').split('\n').slice(0, 40).map(function (l) { return '> ' + l; }).join('\n');
      var j = await api('/api/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', to: (msg.from[0] || {}).address, subject: /^re:/i.test(msg.subject) ? msg.subject : 'Re: ' + msg.subject, text: body + quoted, inReplyTo: msg.messageId, references: msg.references }) });
      btn.disabled = false;
      if (j.error) { $('reply-msg').textContent = j.error; return; }
      $('reply-body').value = ''; $('reply-msg').className = 'msg ok'; $('reply-msg').textContent = 'Sent'; toast('Reply sent');
    };
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-wtab],[data-opt]'); if (!b) return;
    if (b.dataset.wtab) { S.ui.wTab = b.dataset.wtab; if (b.dataset.goweb) { location.hash = 'website'; return; } }
    if (b.dataset.opt) { S.ui.optPage = b.dataset.opt; S.ui.wTab = 'Page optimiser'; }
    render(); window.scrollTo(0, 0);
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('a[data-stab]'); if (b) { S.ui.sTab = b.dataset.stab; } });

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
    bind2(); bind3();
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
      if (P2[act]) return P2[act](el, id);
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
