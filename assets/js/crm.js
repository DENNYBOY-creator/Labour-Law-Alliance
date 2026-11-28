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
  var S = { user: null, leads: [], clients: [], matters: [], appts: [], deadlines: [], notes: {}, settings: {}, staff: [], quotes: [], invoices: [], items: [], payments: [], docs: [], time: [], hearings: [], compliance: [], tasks: [], activity: [], me: {}, ui: { inboxSel: null, inboxTab: 'All', matterTab: 'Overview', weekStart: null, clientQ: '', matterQ: '' } };
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
      sb.from('documents').select('*').order('created_at', { ascending: false }),
      sb.from('time_entries').select('*').order('work_date', { ascending: false }),
      sb.from('hearings').select('*').order('starts_at', { ascending: true }),
      sb.from('compliance_items').select('*').order('due_date', { ascending: true }),
      sb.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      sb.from('activity').select('*').order('id', { ascending: false }).limit(300),
      sb.from('trust_entries').select('*').order('entry_date', { ascending: false }),
      sb.from('retainers').select('*').order('created_at'),
      sb.from('commissioners').select('*').order('name'),
      sb.from('onboarding').select('id,created_at,created_by,token,client_id,matter_id,expires_at,opened_at,completed_at,accepted_name').order('created_at', { ascending: false }),
      sb.from('catalog_items').select('*').order('name'),
      sb.from('doc_shares').select('id,token,kind,doc_id,expires_at,revoked,views,last_viewed_at,response,responded_at,responded_name,response_note').order('created_at', { ascending: false }),
      sb.from('pipeline_templates').select('*').order('sort')
    ]);
    var bad = res.find(function (r) { return r.error; });
    if (bad) { $('view').innerHTML = '<div class="callout p-red">Could not load data: ' + esc(bad.error.message) + '</div>'; return false; }
    S.leads = res[0].data; S.clients = res[1].data; S.matters = res[2].data; S.appts = res[3].data; S.deadlines = res[4].data;
    S.settings = res[5].data; S.staff = res[6].data; S.quotes = res[7].data; S.invoices = res[8].data; S.items = res[9].data; S.payments = res[10].data; S.docs = res[11].data; S.time = res[12].data; S.hearings = res[13].data; S.compliance = res[14].data; S.tasks = res[15].data; S.activity = res[16].data; S.trust = res[17].data; S.retainers = res[18].data; S.commissioners = res[19].data; S.onboarding = res[20].data; S.catalog = res[21].data; S.shares = res[22].data; S.pipes = res[23].data;
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
    (S.hearings || []).forEach(function (h) { if (h.status !== 'scheduled' || !h.starts_at) return; var m = byId(S.matters, h.matter_id); out.push({ date: D(h.starts_at), what: 'Disciplinary hearing: ' + h.employee_name + ' · ' + fmtT(h.starts_at), ref: m ? m.ref : '', title: clientName(h.client_id), kind: 'Hearing', law: '', matter: h.matter_id }); });
    (S.compliance || []).forEach(function (c) { if (c.status !== 'open') return; out.push({ date: D(c.due_date), what: c.obligation, ref: '', title: clientName(c.client_id), kind: 'Compliance', law: c.law || '' }); });
    (S.tasks || []).forEach(function (t) { if (t.status !== 'open' || !t.due_date) return; var m = byId(S.matters, t.matter_id); out.push({ date: D(t.due_date), what: t.title, ref: m ? m.ref : '', title: t.assigned_to ? 'for ' + staffName(t.assigned_to) : '', kind: 'Task', law: '', matter: t.matter_id }); });
    S.appts.forEach(function (a) {
      if (a.status !== 'scheduled' && a.status !== 'provisional') return;
      if (/^(hearing|matter-next):/.test(a.source_key || '')) return; // already listed as a hearing or matter next step
      var m = byId(S.matters, a.matter_id); out.push({ date: D(a.starts_at), what: a.title + ' · ' + fmtT(a.starts_at) + (a.status === 'provisional' ? ' (to confirm)' : ''), ref: m ? m.ref : '', title: a.location || '', kind: kindLabel(a.kind), law: '', appt: a.id });
    });
    out.forEach(function (x) { x.left = daysLeft(x.date); });
    return out.sort(function (a, b) { return a.date - b.date; });
  }

  /* ---------- Navigation ---------- */
var NAV = [
  { grp: 'Your day' },
  { id: 'mywork', label: 'My work', ic: 'sun', n: function () { return myTasks().filter(function (t) { return t.due_date && daysLeft(t.due_date) <= 0; }).length; }, hot: true },
  { id: 'dashboard', label: 'Dashboard', ic: 'grid' },
  { id: 'inbox', label: 'Inbox', ic: 'inbox', n: function () { return S.leads.filter(function (l) { return !l.seen_at; }).length; }, hot: true },
  { id: 'appointments', label: 'Appointments', ic: 'cal' },
  { id: 'deadlines', label: 'Deadlines', ic: 'clock', n: function () { return agenda().filter(function (d) { return d.left <= 7 && d.left >= 0 && /Time limit|Deadline|Diary|Task|Compliance/.test(d.kind); }).length; } },
  { grp: 'Practice' },
  { id: 'pipeline', label: 'Pipeline', ic: 'funnel', n: function () { return S.leads.filter(function (l) { return l.status === 'new'; }).length; } },
  { id: 'matters', label: 'Matters', ic: 'brief', n: function () { return S.matters.filter(function (m) { return m.stage !== 'Closed'; }).length; } },
  { id: 'hearings', label: 'Hearings', ic: 'gavel', n: function () { return S.hearings.filter(function (h) { return h.status === 'scheduled' && h.starts_at && daysLeft(h.starts_at) >= 0 && daysLeft(h.starts_at) <= 7; }).length; } },
  { id: 'clients', label: 'Clients', ic: 'users' },
  { id: 'commissioners', label: 'Commissioners', ic: 'gavel' },
  { grp: 'Money' },
  { id: 'quotes', label: 'Quotes & invoices', ic: 'doc', n: function () { return S.invoices.filter(function (i) { return invState(i).key === 'overdue'; }).length; }, hot: true },
  { id: 'payments', label: 'Payments', ic: 'wallet' },
  { grp: 'Firm' },
  { id: 'website', label: 'Website', ic: 'globe' },
  { id: 'documents', label: 'Document centre', ic: 'folder' },
  { id: 'compliance', label: 'Employer compliance', ic: 'shield', n: function () { return S.compliance.filter(function (c) { return c.status === 'open' && daysLeft(c.due_date) <= 14; }).length; }, hot: true },
  { id: 'settings', label: 'Company settings', ic: 'cog' }
];
var ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  grid: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  funnel: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
  brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  gavel: '<path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="3"/><path d="M2 10h20M16 15h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', task: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  side: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
function icon(name, size) { return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
function renderNav(cur) {
  $('nav').innerHTML = NAV.map(function (n) {
    if (n.grp) return '<div class="grp">' + n.grp + '</div>';
    var c = n.n ? n.n() : 0;
    return '<a href="#' + n.id + '" class="' + (n.id === cur ? 'on' : '') + '" title="' + esc(n.label) + '">' + icon(n.ic) + '<span class="lb">' + n.label + '</span>' + (c ? '<span class="n' + (n.hot ? ' hot' : '') + '">' + c + '</span><i class="dot"></i>' : '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>') + '</a>';
  }).join('');
}

  var V = {};

  /* ---------- Dashboard ---------- */
  function dashPractice() {
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
      '<a class="panel stat" href="#deadlines" style="text-decoration:none;color:inherit"><b style="color:var(--red)">' + ag.filter(function (d) { return d.left <= 7 && d.left >= 0 && /Time limit|Deadline|Diary|Compliance|Hearing|Task/.test(d.kind); }).length + '</b><span>Deadlines in the next 7 days</span></a>' +
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
      conflictPanel(leadName(l), { lead: l.id, client: l.client_id }) +
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
    { k: 'name', label: 'Client name', req: true, hint: 'Checked for conflicts as you type.' },
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
      onInput: function () { conflictHint('m-name', { client: c && c.id, lead: c && c.lead_id }); },
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
      { k: 'other_party', label: 'Other party', hint: 'Checked against all clients, matters, hearings and enquiries.' },
      { k: 'dispute_type', label: 'Type of matter', type: 'select', blank: 'Choose…', options: DISPUTES },
      { k: 'forum', label: 'Forum', type: 'select', blank: 'Choose…', options: FORUMS },
      { k: 'case_no', label: 'Case number', ph: 'e.g. GAJB 18842-26' },
      { k: 'stage', label: 'Stage', type: 'select', options: STAGES },
      { k: 'key_rule', label: 'Time limit that applies', type: 'select', blank: 'None', options: RULES.map(function (r) { return [r.id, r.span + ': ' + r.label]; }) },
      { k: 'key_date', label: 'Date the time limit runs from', type: 'date', hint: 'Choose a time limit to work out the deadline.' },
      { k: 'next_step', label: 'Next step', ph: 'e.g. Conciliation at CCMA Johannesburg' },
      { k: 'next_date', label: 'Next step date', type: 'date' },
      { k: 'assigned_email', label: 'Responsible attorney', type: 'select', blank: 'Not assigned', options: S.staff.filter(function (s) { return s.active; }).map(function (s) { return [s.email, (s.full_name || s.email) + ' · ' + roleLabelShort(s.role)]; }) },
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
      title: isNew ? 'New matter' : 'Edit ' + m.ref, fields: matterFields(), values: m || Object.assign({ stage: 'Intake', acting_for: 'employee' }, preset || {}), onInput: function () { keyDateHint(); conflictHint('m-other_party', { matter: m && m.id, otherParty: true }); },
      save: async function (d) {
        var st0 = d.assigned_email && S.staff.find(function (s) { return s.email === d.assigned_email; });
        d.attorney = st0 ? (st0.full_name || st0.email) : null;
        var r = isNew ? await sb.from('matters').insert(Object.assign(d, preset && preset.lead_id ? { lead_id: preset.lead_id } : {})).select().single() : await sb.from('matters').update(d).eq('id', m.id).select().single();
        if (r.error) return dbErr(r);
        var wasOpen = isNew || m.stage !== 'Closed';
        upsertLocal(S.matters, r.data);
        await syncMatterNext(r.data);
        if (wasOpen && r.data.stage === 'Closed') setTimeout(function () { closeMatterChecklist(r.data); }, 50);
        if (isNew && preset && preset.lead_id) { var lr = await sb.from('leads').update({ matter_id: r.data.id, status: 'client' }).eq('id', preset.lead_id).select().single(); if (!lr.error) upsertLocal(S.leads, lr.data); }
        toast(isNew ? 'Matter ' + r.data.ref + ' opened' : 'Matter saved');
        if (isNew) location.hash = 'matter=' + r.data.id; else render();
      },
      del: isNew ? null : async function () { var r = await sb.from('matters').delete().eq('id', m.id); if (r.error) return dbErr(r); S.matters = S.matters.filter(function (x) { return x.id !== m.id; }); toast('Matter deleted'); location.hash = 'matters'; }
    });
  }
  function matterDetail(m) {
    var tabs = ['Overview', 'Tasks', 'Deadlines', 'File notes', 'Appointments', 'Time', 'Hearings', 'Billing', 'Calculator', 'Documents', 'Emails', 'History'];
    var t = S.ui.matterTab, si = STAGES.indexOf(m.stage), r = m.key_rule && rule(m.key_rule), c = byId(S.clients, m.client_id);
    var body = '';
    if (t === 'Overview') body = '<div class="grid g2"><dl class="kv"><dt>Client</dt><dd>' + (c ? '<a href="#" data-client="' + c.id + '">' + esc(c.name) + '</a>' : '—') + '</dd><dt>We act for</dt><dd>' + esc(m.acting_for) + '</dd><dt>Other party</dt><dd>' + esc(m.other_party || '—') + '</dd><dt>Type</dt><dd>' + esc(m.dispute_type || '—') + '</dd><dt>Forum</dt><dd>' + esc(m.forum || '—') + '</dd><dt>Case number</dt><dd>' + esc(m.case_no || '—') + '</dd><dt>Attorney</dt><dd>' + esc(m.attorney || '—') + '</dd><dt>Opened</dt><dd>' + fmt(m.created_at) + '</dd></dl>' +
      '<dl class="kv"><dt>What the client wants</dt><dd>' + esc(m.value_sought || '—') + '</dd><dt>Fee arrangement</dt><dd>' + esc(m.fee_arrangement || '—') + '</dd><dt>Next step</dt><dd>' + (m.next_date ? esc(m.next_step || '') + ', ' + fmt(m.next_date) + ' ' + urg(daysLeft(m.next_date)) : esc(m.next_step || '—')) + '</dd>' +
      (r && m.key_date ? '<dt>Time limit</dt><dd>' + esc(r.label) + ': <b>' + fmt(r.calc(D(m.key_date))) + '</b> ' + urg(daysLeft(r.calc(D(m.key_date)))) + '<div class="meta">' + r.span + ' from ' + fmt(m.key_date) + ' · ' + r.law + '</div></dd>' : '') +
      (m.commissioner_id || m.outcome ? '<dt>Commissioner</dt><dd>' + (byId(S.commissioners, m.commissioner_id) ? '<a href="#" data-act="open-commissioner" data-id="' + m.commissioner_id + '">' + esc(byId(S.commissioners, m.commissioner_id).name) + '</a>' : '—') + '</dd><dt>Outcome</dt><dd>' + (m.outcome ? pill(lbl(OUTCOMES, m.outcome), OCLS[m.outcome]) + (m.outcome_date ? ' ' + fmt(m.outcome_date) : '') + (m.award_amount ? ' · ' + R2(m.award_amount) : '') : 'Not decided yet') + '</dd>' : '') +
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
    if (t === 'Time') body = matterTime(m);
    if (t === 'Emails') body = matterEmails(m);
    if (t === 'Tasks') body = '<div style="margin-bottom:10px"><button class="btn pri" data-act="new-task" data-matter="' + m.id + '">New task</button></div>' + taskList(S.tasks.filter(function (x) { return x.matter_id === m.id; }), true);
    if (t === 'History') body = historyList(S.activity.filter(function (a) { return a.matter_id === m.id; }), 'matter', m.id);
    if (t === 'Hearings') body = matterHearings(m);
    if (t === 'Billing') body = profitStrip(m) + matterBilling(m);
    if (t === 'Calculator') body = matterCalc(m);
    if (t === 'Documents') body = matterDocs(m);
    return '<div><a href="#matters">← All matters</a></div>' + head(esc(m.ref) + (m.forum ? ' · ' + esc(m.forum) : ''), esc(m.title), esc(m.dispute_type || '') + ' · acting for the ' + esc(m.acting_for), '<button class="btn pri" data-act="edit-matter" data-id="' + m.id + '">Edit matter</button>') +
      '<div class="panel"><div class="meta" style="margin-bottom:6px">Stage (click to move)</div><div class="steps">' + STAGES.map(function (s, i) { return '<button data-stage="' + esc(s) + '" class="' + (i < si ? 'done' : i === si ? 'now' : '') + '">' + s + '</button>'; }).join('') + '</div></div>' +
      '<div class="panel"><div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button role="tab" class="' + (x === t ? 'on' : '') + '" data-mtab="' + x + '">' + x + '</button>'; }).join('') + '</div><div style="padding-top:14px">' + body + '</div></div>';
  }

  /* ---------- Deadlines ---------- */
  V.deadlines = function () {
    var ag = agenda();
    var overdue = ag.filter(function (d) { return d.left < 0 && /Time limit|Deadline|Diary|Compliance|Task/.test(d.kind); });
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
    var provisional = S.appts.filter(function (a) { return a.status === 'provisional'; });
    var upcoming = S.appts.filter(function (a) { return D(a.starts_at) >= today(); });
    return head('Appointments', 'Consultations, meetings and set-downs', 'Website bookings wait below until you confirm them. CCMA dates and hearings linked to matters show here too.', '<button class="btn pri" data-act="new-appt">New appointment</button>') +
      (provisional.length ? '<div class="panel" style="border-color:var(--accent)"><div class="hd"><h2>Website bookings to confirm</h2><span class="meta">Already in the calendar as provisional. Confirm once you have spoken to the client.</span></div><div class="list">' + provisional.map(function (a) { var l = byId(S.leads, a.lead_id) || {}; return '<div class="row" style="align-items:center">' + dateBox(a.starts_at) + '<div class="grow"><b>' + esc(a.title) + '</b><div class="meta">' + fmtT(a.starts_at) + ' · ' + esc(a.location || '') + (l.service ? ' · ' + esc(l.service) : '') + '</div></div>' + phoneLinks(l.phone, l.email, 'Your consultation with Labour Law Alliance') + '<button class="btn sm" data-appt="' + a.id + '">Change</button><button class="btn sm pri" data-act="confirm-appt" data-id="' + a.id + '">Confirm</button></div>'; }).join('') + '</div></div>' : '') +
      (pendingBookings.length ? '<div class="panel" style="border-color:var(--accent)"><div class="hd"><h2>Website bookings without a time</h2></div><div class="list">' + pendingBookings.map(function (l) { return '<div class="row" style="align-items:center"><div class="grow"><b>' + esc(leadName(l)) + '</b><div class="meta">Asked for ' + esc(l.preferred_date || '') + ' ' + esc(l.preferred_time || '') + ' · ' + esc(l.meeting || '') + ' · ' + esc(l.service || '') + '</div></div>' + phoneLinks(l.phone, l.email, 'Your consultation with Labour Law Alliance') + '<button class="btn sm pri" data-act="lead-appt" data-id="' + l.id + '">Confirm</button></div>'; }).join('') + '</div></div>' : '') +
      '<div class="panel"><div class="hd"><h2>Week of ' + fmt(ws) + '</h2><div style="display:flex;gap:6px"><button class="btn sm" data-week="-7">← Previous</button><button class="btn sm" data-week="0">This week</button><button class="btn sm" data-week="7">Next →</button></div></div><div class="week">' +
      days.map(function (d) {
        var as = S.appts.filter(function (a) { return ymd(a.starts_at) === ymd(d); }).sort(function (a, b) { return D(a.starts_at) - D(b.starts_at); });
        return '<div class="day' + (ymd(d) === ymd(today()) ? ' today' : '') + '"><h3>' + d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }) + '</h3>' + as.map(function (a) { return '<button class="appt k-' + a.kind + (a.status === 'cancelled' ? ' cancelled' : '') + '" data-appt="' + a.id + '"><span class="mono">' + fmtT(a.starts_at) + '</span><b style="font-size:13px">' + esc(a.title) + '</b><span class="meta">' + esc(a.location || kindLabel(a.kind)) + '</span></button>'; }).join('') + '</div>';
      }).join('') + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' + KINDS.map(function (k) { return '<span class="pill" style="border-left:3px solid ' + ({ ccma: 'var(--red)', court: 'var(--red)', hearing: 'var(--amber)', consultation: 'var(--accent)' }[k[0]] || 'var(--blue)') + '">' + k[1] + '</span>'; }).join('') + '</div></div>' +
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
      { k: 'status', label: 'Status', type: 'select', options: [['provisional', 'Provisional (to confirm)'], ['scheduled', 'Scheduled'], ['done', 'Done'], ['cancelled', 'Cancelled']] },
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
        { k: 'first_name', label: 'First name', req: true }, { k: 'last_name', label: 'Last name', hint: 'Checked for conflicts as you type.' },
        { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' },
        { k: 'relationship', label: 'Acting for', type: 'select', options: ['Employee', 'Employer', 'Union'] },
        { k: 'source', label: 'How they found us', type: 'select', options: ['Phone call', 'WhatsApp', 'Walk-in', 'Referral', 'Google search', 'Google Business Profile', 'Facebook', 'LinkedIn', 'Other'] },
        { k: 'service', label: 'What it is about', type: 'select', blank: 'Choose…', options: DISPUTES },
        { k: 'est_value', label: 'Expected fee (R)', type: 'number', step: 100 },
        { k: 'message', label: 'Notes from the call', type: 'textarea', full: true }
      ], values: { relationship: 'Employee', source: 'Phone call' },
      onInput: function () { var f = $('m-first_name'), l = $('m-last_name'); conflictHint('m-last_name', {}, ((f && f.value) || '') + ' ' + ((l && l.value) || '')); },
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
        if (isNew && kind === 'invoice' && preset && preset._timeIds && preset._timeIds.length) {
          var tr = await sb.from('time_entries').update({ invoice_id: r.data.id }).in('id', preset._timeIds).select();
          if (!tr.error) tr.data.forEach(function (x) { upsertLocal(S.time, x); });
        }
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
    var tabs = '<div class="subtabs">' + ['Invoices', 'Quotes', 'Retainers', 'Unbilled time'].map(function (x) { return '<button data-qtab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    var body;
    if (tab === 'Retainers') body = retainersTab();
    else if (tab === 'Unbilled time') body = unbilledTab();
    else if (tab === 'Quotes') {
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
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn pri" data-act="upload" data-matter="' + m.id + '" data-client="' + (m.client_id || '') + '">Upload files</button>' +
      Object.keys(CONTRACTS).map(function (t) { return '<button class="btn sm" data-act="matter-doc" data-matter="' + m.id + '" data-type="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div><p class="meta" style="margin:-4px 0 12px">The document buttons open the template with this matter’s client, other party, case number and fee details filled in.</p>' + docTable(ds);
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
      '<div class="fld"><label for="ct-client">Client</label><select id="ct-client"><option value="">Choose a client</option>' + S.clients.map(function (c) { return '<option value="' + c.id + '"' + (c.id === S.ui.ctClient ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="ct-matter">Matter</label><select id="ct-matter"><option value="">Not linked</option>' + S.matters.map(function (m) { return '<option value="' + m.id + '"' + (m.id === S.ui.ctMatter ? ' selected' : '') + '>' + esc(m.ref + ' · ' + m.title) + '</option>'; }).join('') + '</select><span class="hint">Choosing a matter fills in the parties, case number and fee details.</span></div>' +
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
      { k: 'google_review_link', label: 'Google review link', full: true, ph: 'https://g.page/r/…/review', hint: 'Google Business Profile → Ask for reviews → copy the link. Used when you close a matter.' },
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
      { k: 'invoice_prefix', label: 'Invoice number prefix' }, { k: 'next_invoice_no', label: 'Next invoice number', type: 'number' },
      { k: 'quote_notes', label: 'Default customer notes on quotes', type: 'textarea', full: true }, { k: 'quote_terms', label: 'Default terms & conditions on quotes', type: 'textarea', full: true },
      { k: 'invoice_notes', label: 'Default customer notes on invoices', type: 'textarea', full: true }, { k: 'invoice_terms', label: 'Default terms & conditions on invoices', type: 'textarea', full: true }
    ]
  };
  V.settings = function () {
    var tab = S.ui.sTab || 'Company details', st = S.settings || {};
    var tabs = '<div class="subtabs">' + ['Company details', 'Banking & invoicing', 'Users', 'Pipelines', 'Email', 'Calendar & reminders', 'Integrations', 'POPIA'].map(function (x) { return '<button data-stab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    var canEdit = canMoney();
    var body;
    if (tab === 'Pipelines') body = pipelinesSettings();
    else if (tab === 'POPIA') body = popiaSettings();
    else if (tab === 'Calendar & reminders') body = calendarSettings();
    else if (tab === 'Email' || tab === 'Integrations') body = settings3(tab);
    else if (tab === 'Users') {
      body = '<div class="panel"><div class="hd"><h2>People with access</h2>' + (isPartner() ? '<button class="btn pri" data-act="invite-staff">Invite staff member</button>' : '') + '</div><div class="tbl"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Signed in before</th><th>Access</th><th></th></tr>' +
        S.staff.map(function (s) { return '<tr><td><b>' + esc(s.full_name || '—') + '</b></td><td class="mono">' + esc(s.email) + '</td><td>' + roleLabel(s.role) + '</td><td>' + (s.user_id ? pill('Yes', 'p-green') : pill('Not yet', 'p-amber')) + mfaPill(s.email) + '</td><td>' + (s.active ? pill('Active', 'p-green') : pill('Removed', 'p-red')) + '</td><td>' + (isPartner() ? '<button class="btn sm" data-act="edit-staff" data-id="' + s.id + '">Edit</button>' : '') + '</td></tr>'; }).join('') + '</table></div>' +
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
      $('ct-client').onchange = function () { S.ui.ctClient = $('ct-client').value; previewContract(); };
      $('ct-matter').onchange = function () { S.ui.ctMatter = $('ct-matter').value; var m = byId(S.matters, S.ui.ctMatter); if (m && m.client_id) { $('ct-client').value = m.client_id; S.ui.ctClient = m.client_id; } fillContractDefaults(); previewContract(); };
      if (S.ui.ctMatter) fillContractDefaults();
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
    var g = ''; for (var k = 0; k <= 4; k++) g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(k * tick) + '" y2="' + y(k * tick) + '" style="stroke:var(--line)"/><text x="' + (pl - 6) + '" y="' + (y(k * tick) + 4) + '" text-anchor="end" style="fill:var(--muted)" font-size="11">' + (k * tick) + '</text>';
    var marks = [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1].filter(function (v, i, a) { return a.indexOf(v) === i; });
    g += marks.map(function (i) { return '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle" style="fill:var(--muted)" font-size="11">' + esc(labels[i]) + '</text>'; }).join('');
    g += series.map(function (s) { var pts = s.data.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' '); return (s.fill ? '<polygon points="' + x(0) + ',' + y(0) + ' ' + pts + ' ' + x(n - 1) + ',' + y(0) + '" style="fill:' + s.color + '" opacity=".16"/>' : '') + '<polyline points="' + pts + '" style="fill:none;stroke:' + s.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'; }).join('');
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
      '<div class="panel"><div class="hd"><h2>Visits per day</h2><span class="meta"><span style="color:var(--accent)">■</span> visits <span style="color:var(--blue)">■</span> page views</span></div>' + lineChart(days.map(function (d) { return fmt(d).replace(/ \d{4}$/, ''); }), [{ data: viewsDay, color: 'var(--blue)' }, { data: perDay, color: 'var(--accent)', fill: true }]) + '</div>' +
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
      '<div class="panel"><div class="hd"><h2>Clicks and impressions per day</h2><span class="meta"><span style="color:var(--accent)">■</span> clicks <span style="color:var(--blue)">■</span> impressions ÷ 10</span></div>' + lineChart(g.byDate.map(function (r) { return fmt(r.date).replace(/ \d{4}$/, ''); }), [{ data: g.byDate.map(function (r) { return Math.round(r.impressions / 10); }), color: 'var(--blue)' }, { data: g.byDate.map(function (r) { return r.clicks; }), color: 'var(--accent)', fill: true }]) + '</div>' +
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
      (msg.attachments.length ? '<div><span class="lbl">Attachments</span><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">' + msg.attachments.map(function (a, i) { return '<div class="row" style="align-items:center;padding:8px 10px"><div class="grow"><b>' + esc(a.filename) + '</b> <span class="meta">' + fileSize(a.size) + '</span></div><button class="btn sm" data-act="mail-save" data-idx="' + i + '">Save to documents</button></div>'; }).join('') + '</div></div>' : '') +
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

  /* =====================================================================
     PHASE 4: time recording, disciplinary hearings, employer compliance, dashboard views
     ===================================================================== */

  /* ----- Time recording ----- */
  var unbilled = function (t) { return t.billable && !t.invoice_id; };
  function timeFields(matterId) {
    return [
      { k: 'matter_id', label: 'Matter', type: 'select', req: true, blank: 'Choose a matter', options: S.matters.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
      { k: 'work_date', label: 'Date', type: 'date', req: true },
      { k: 'hours', label: 'Hours', type: 'number', step: 0.1, req: true, hint: '0.1 = 6 minutes · 0.25 = 15 minutes' },
      { k: 'rate', label: 'Rate per hour (R)', type: 'number', step: 50 },
      { k: 'description', label: 'Work done', req: true, full: true, ph: 'e.g. Consultation with client; drafted LRA Form 7.11' },
      { k: 'billable', label: 'Billable to the client', type: 'checkbox' }
    ];
  }
  function editTime(t, preset) {
    var isNew = !t || !t.id;
    openForm({
      title: isNew ? 'Log time' : 'Time entry', fields: timeFields(), values: t || Object.assign({ work_date: ymd(today()), rate: (S.settings && S.settings.hourly_rate) || '', billable: true, hours: 1 }, preset || {}),
      save: async function (d) {
        if (!isNew && t.invoice_id) return 'This time is already on an invoice. Change the invoice instead.';
        if (isNew) d.staff_email = S.user && S.user.email;
        d.rate = d.rate || 0;
        var r = isNew ? await sb.from('time_entries').insert(d).select().single() : await sb.from('time_entries').update(d).eq('id', t.id).select().single();
        if (r.error) return dbErr(r);
        upsertLocal(S.time, r.data); toast(isNew ? 'Time logged: ' + r.data.hours + ' h' : 'Saved'); render();
      },
      del: isNew ? null : async function () { if (t.invoice_id) return 'This time is on an invoice and cannot be deleted.'; var r = await sb.from('time_entries').delete().eq('id', t.id); if (r.error) return dbErr(r); S.time = S.time.filter(function (x) { return x.id !== t.id; }); toast('Deleted'); render(); }
    });
  }
  P2['log-time'] = function (el) { editTime(null, el.dataset.matter ? { matter_id: el.dataset.matter } : null); };
  P2['open-time'] = function (el) { editTime(byId(S.time, el.dataset.id)); };
  P2['invoice-time'] = function (el) {
    var m = byId(S.matters, el.dataset.matter), ts = S.time.filter(function (t) { return t.matter_id === m.id && unbilled(t); });
    if (!ts.length) { toast('No unbilled time on this matter.'); return; }
    var st = S.settings || {};
    editDoc('invoice', null, { client_id: m.client_id, matter_id: m.id, vat_rate: st.vat_registered ? st.vat_rate : 0, _timeIds: ts.map(function (t) { return t.id; }),
      _items: ts.slice().sort(function (a, b) { return a.work_date < b.work_date ? -1 : 1; }).map(function (t) { return { description: fmt(t.work_date) + ': ' + t.description, qty: t.hours, unit_price: t.rate }; }) });
  };
  function timeTable(ts, showMatter) {
    return '<div class="tbl"><table><tr><th>Date</th>' + (showMatter ? '<th>Matter</th>' : '') + '<th>Work</th><th>By</th><th style="text-align:right">Hours</th><th style="text-align:right">Value</th><th>Status</th></tr>' +
      (ts.map(function (t) { var m = byId(S.matters, t.matter_id), inv = byId(S.invoices, t.invoice_id); return '<tr class="click" data-act="open-time" data-id="' + t.id + '"><td class="mono">' + fmt(t.work_date) + '</td>' + (showMatter ? '<td class="mono">' + (m ? esc(m.ref) : '') + '</td>' : '') + '<td>' + esc(t.description) + '</td><td class="meta">' + esc((t.staff_email || '').split('@')[0]) + '</td><td class="mono" style="text-align:right">' + Number(t.hours) + '</td><td class="mono" style="text-align:right">' + (t.billable ? R2(t.hours * t.rate) : '—') + '</td><td>' + (!t.billable ? pill('Not billable') : inv ? pill('On ' + inv.number, 'p-green') : pill('Unbilled', 'p-amber')) + '</td></tr>'; }).join('') || '<tr><td colspan="7">' + empty('No time recorded.') + '</td></tr>') + '</table></div>';
  }
  function matterTime(m) {
    var ts = S.time.filter(function (t) { return t.matter_id === m.id; }), ub = ts.filter(unbilled);
    var hrs = ts.reduce(function (s, t) { return s + Number(t.hours); }, 0), val = ub.reduce(function (s, t) { return s + t.hours * t.rate; }, 0);
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><button class="btn pri" data-act="log-time" data-matter="' + m.id + '">Log time</button>' + (ub.length ? '<button class="btn" data-act="invoice-time" data-matter="' + m.id + '">Invoice unbilled time (' + R2(val) + ')</button>' : '') + '<span class="meta">' + hrs.toFixed(1) + ' hours recorded in total</span></div>' + timeTable(ts, false);
  }
  function unbilledTab() {
    var ub = S.time.filter(unbilled), byM = {};
    ub.forEach(function (t) { (byM[t.matter_id] = byM[t.matter_id] || []).push(t); });
    var tot = ub.reduce(function (s, t) { return s + t.hours * t.rate; }, 0);
    return '<div class="grid g4"><div class="panel stat"><b>' + R2(tot) + '</b><span>Unbilled time</span></div><div class="panel stat"><b>' + ub.reduce(function (s, t) { return s + Number(t.hours); }, 0).toFixed(1) + '</b><span>Unbilled hours</span></div><div class="panel stat"><b>' + Object.keys(byM).length + '</b><span>Matters with unbilled time</span></div><div class="panel stat"><b>' + S.time.filter(function (t) { return D(t.work_date) >= addDays(today(), -6); }).reduce(function (s, t) { return s + Number(t.hours); }, 0).toFixed(1) + '</b><span>Hours logged in the last 7 days</span></div></div>' +
      '<div class="panel"><div class="hd"><h2>Unbilled time by matter</h2><button class="btn pri" data-act="log-time">Log time</button></div><div class="list">' +
      (Object.keys(byM).map(function (mid) { var m = byId(S.matters, mid) || {}, ts = byM[mid]; return '<div class="row" style="align-items:center"><div class="grow"><a href="#matter=' + mid + '"><b>' + esc(m.ref || '') + ' · ' + esc(m.title || '') + '</b></a><div class="meta">' + esc(clientName(m.client_id)) + ' · ' + ts.length + ' entries · ' + ts.reduce(function (s, t) { return s + Number(t.hours); }, 0).toFixed(1) + ' h</div></div><span class="mono">' + R2(ts.reduce(function (s, t) { return s + t.hours * t.rate; }, 0)) + '</span><button class="btn sm pri" data-act="invoice-time" data-matter="' + mid + '">Create invoice</button></div>'; }).join('') || empty('No unbilled time. Log time on a matter as you work.')) + '</div></div>' +
      '<div class="panel"><div class="hd"><h2>Recent time</h2></div>' + timeTable(S.time.slice(0, 40), true) + '</div>';
  }

  /* ----- Disciplinary hearings ----- */
  var CHECKS = [
    ['charges_written', 'Charges are in writing, specific and clear'],
    ['notice_time', 'Notice served with reasonable time to prepare (at least 48 hours)'],
    ['rights_explained', 'Right to a representative (fellow employee or shop steward) explained'],
    ['interpreter', 'Interpreter arranged, or confirmed not needed'],
    ['evidence_shared', 'Evidence and witness statements shared with the employee'],
    ['chair_independent', 'Chairperson is impartial and was not involved in the facts'],
    ['employee_heard', 'Employee could state their case, question witnesses and call their own'],
    ['mitigation', 'Mitigating and aggravating factors heard before sanction'],
    ['consistency', 'Sanction is consistent with how similar cases were treated'],
    ['finding_written', 'Finding and sanction given in writing, with the right to refer to the CCMA']
  ];
  var HROLE = [['chairperson', 'We chair'], ['initiator', 'We initiate (for the employer)'], ['employee_representative', 'We represent the employee']];
  var HTYPE = [['misconduct', 'Misconduct'], ['incapacity_performance', 'Incapacity: poor performance'], ['incapacity_ill_health', 'Incapacity: ill health'], ['appeal', 'Appeal hearing'], ['grievance', 'Grievance hearing']];
  var HSTATUS = [['scheduled', 'Scheduled'], ['postponed', 'Postponed'], ['held', 'Held, finding pending'], ['finding_issued', 'Finding issued'], ['cancelled', 'Cancelled']];
  var lbl = function (list, v) { var x = list.find(function (p) { return p[0] === v; }); return x ? x[1] : (v || '—'); };
  function hearingFields() {
    return [
      { k: 'client_id', label: 'Employer (client)', type: 'select', blank: 'Choose', options: S.clients.map(function (c) { return [c.id, c.name]; }) },
      { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
      { k: 'employee_name', label: 'Employee', req: true },
      { k: 'our_role', label: 'Our role', type: 'select', options: HROLE },
      { k: 'hearing_type', label: 'Type of hearing', type: 'select', options: HTYPE },
      { k: 'starts_at', label: 'Date and time', type: 'datetime-local' },
      { k: 'venue', label: 'Venue', ph: 'e.g. Boardroom, client site in Midrand' },
      { k: 'notice_served', label: 'Notice served on', type: 'date', hint: 'Leave enough time for the employee to prepare.' },
      { k: 'representative', label: 'Employee’s representative', ph: 'e.g. Shop steward (NUMSA)' },
      { k: 'interpreter', label: 'Interpreter', ph: 'e.g. isiZulu, or Not needed' },
      { k: 'charges', label: 'Charges (one per line)', type: 'textarea', full: true },
      { k: 'status', label: 'Status', type: 'select', options: HSTATUS },
      { k: 'finding', label: 'Finding', type: 'select', blank: 'Not yet', options: [['guilty', 'Guilty'], ['partly_guilty', 'Guilty on some charges'], ['not_guilty', 'Not guilty']] },
      { k: 'sanction', label: 'Sanction', ph: 'e.g. Final written warning valid 12 months' },
      { k: 'outcome_notes', label: 'Outcome notes', type: 'textarea', full: true }
    ];
  }
  function noticeHint() {
    var s = $('m-starts_at'), n = $('m-notice_served'), h = $('m-notice_served-hint'); if (!s || !n || !h) return;
    if (!s.value || !n.value) { h.textContent = 'Leave enough time for the employee to prepare.'; return; }
    var hrs = (new Date(s.value) - D(n.value)) / 36e5;
    h.innerHTML = hrs < 48 ? '<b style="color:var(--red)">Only ' + Math.max(0, Math.round(hrs)) + ' hours’ notice: allow at least 48 hours.</b>' : '<span style="color:var(--green)">' + Math.round(hrs / 24) + ' days’ notice.</span>';
  }
  function editHearing(h, preset) {
    var isNew = !h || !h.id;
    var vals = h ? Object.assign({}, h, { starts_at: h.starts_at ? localInput(h.starts_at) : '' }) : Object.assign({ our_role: 'chairperson', hearing_type: 'misconduct', status: 'scheduled' }, preset || {});
    var ck = (h && h.checklist) || {};
    var extra = '<div class="fld full"><span class="lbl">Fair procedure checklist (Code of Good Practice: Dismissal, LRA Schedule 8)</span>' + CHECKS.map(function (c) { return '<label class="check" style="font-weight:400"><input type="checkbox" class="hck" data-k="' + c[0] + '"' + (ck[c[0]] ? ' checked' : '') + '> ' + esc(c[1]) + '</label>'; }).join('') + '</div>' +
      (isNew ? '' : '<div class="fld full" style="flex-direction:row;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="hearing-notice" data-id="' + h.id + '">Notice to attend (print / PDF)</button><button type="button" class="btn sm" data-act="hearing-finding" data-id="' + h.id + '">Finding and sanction (print / PDF)</button><span class="meta">Save first if you changed anything.</span></div>');
    openForm({
      title: isNew ? 'New disciplinary hearing' : 'Hearing: ' + h.employee_name, fields: hearingFields(), values: vals, extra: extra, onInput: noticeHint,
      save: async function (d) {
        d.checklist = {}; document.querySelectorAll('.hck').forEach(function (c) { d.checklist[c.dataset.k] = c.checked; });
        var r = isNew ? await sb.from('hearings').insert(d).select().single() : await sb.from('hearings').update(d).eq('id', h.id).select().single();
        if (r.error) return dbErr(r);
        var before = h ? Object.assign({}, h) : null; upsertLocal(S.hearings, r.data); await syncHearingAppt(r.data); dismissalClock(before, r.data); S.hearings.sort(function (a, b) { return (a.starts_at || '') < (b.starts_at || '') ? -1 : 1; });
        toast(isNew ? 'Hearing added' : 'Hearing saved'); render();
      },
      del: isNew ? null : async function () { var r = await sb.from('hearings').delete().eq('id', h.id); if (r.error) return dbErr(r); S.hearings = S.hearings.filter(function (x) { return x.id !== h.id; }); toast('Hearing deleted'); render(); }
    });
  }
  P2['new-hearing'] = function (el) { var m = el.dataset.matter && byId(S.matters, el.dataset.matter); editHearing(null, m ? { matter_id: m.id, client_id: m.client_id } : null); };
  P2['open-hearing'] = function (el) { editHearing(byId(S.hearings, el.dataset.id)); };
  function letterHtml(title, paras, signLabel) {
    var st = S.settings || {};
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font-family:Georgia,serif;color:#1d1d1d;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.6}h1{font-family:Arial,sans-serif;letter-spacing:2px;font-size:17px;color:#a07a12}.hd{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #16203b;padding-bottom:12px;margin-bottom:20px;font-family:Arial,sans-serif;font-size:12px;color:#444}ol li{margin-bottom:6px}.sig{margin-top:50px;border-top:1px solid #444;padding-top:6px;width:280px;font-size:13px}</style></head><body>' +
      '<div class="hd"><div><img src="https://labourlawalliance.co.za/assets/images/logo.png?v=2" width="150" alt=""></div><div style="text-align:right">' + [st.legal_name || st.trading_name, st.address1, st.address2, st.phone, st.email].filter(Boolean).map(esc).join('<br>') + '</div></div>' +
      '<h1>' + esc(title.toUpperCase()) + '</h1>' + paras.join('') + '<div class="sig">' + esc(signLabel) + '<br>Date:</div></body></html>';
  }
  P2['hearing-notice'] = function (el) {
    var h = byId(S.hearings, el.dataset.id), c = byId(S.clients, h.client_id) || {};
    var charges = (h.charges || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    printHtml(letterHtml('Notice to attend a disciplinary hearing', [
      '<p><b>To:</b> ' + esc(h.employee_name) + '<br><b>Employer:</b> ' + esc(c.name || '') + '<br><b>Date of notice:</b> ' + fmt(h.notice_served || today()) + '</p>',
      '<p>You are required to attend a disciplinary hearing on <b>' + (h.starts_at ? fmtDT(h.starts_at) : '[date and time]') + '</b> at <b>' + esc(h.venue || '[venue]') + '</b>.</p>',
      '<p><b>The charges against you are:</b></p><ol>' + (charges.length ? charges.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li>[charge]</li>') + '</ol>',
      '<p><b>Your rights at the hearing:</b></p><ol><li>You may be represented by a fellow employee or a shop steward of a recognised trade union.</li><li>You may have an interpreter if you need one. Tell us in advance so one can be arranged.</li><li>You may state your case, question the employer’s witnesses, call your own witnesses and present documents.</li><li>You may raise anything you want considered before a sanction is decided.</li></ol>',
      '<p>If you do not attend without a good reason, the hearing may go ahead in your absence. If you cannot attend, contact us before the hearing.</p>'
    ], 'Signed for ' + (c.name || 'the employer')));
  };
  P2['hearing-finding'] = function (el) {
    var h = byId(S.hearings, el.dataset.id), c = byId(S.clients, h.client_id) || {};
    printHtml(letterHtml('Outcome of disciplinary hearing', [
      '<p><b>Employee:</b> ' + esc(h.employee_name) + '<br><b>Employer:</b> ' + esc(c.name || '') + '<br><b>Hearing held:</b> ' + (h.starts_at ? fmt(h.starts_at) : '[date]') + '</p>',
      '<p><b>Charges:</b></p><ol>' + (h.charges || '[charges]').split('\n').filter(Boolean).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>',
      '<p><b>Finding:</b> ' + esc({ guilty: 'Guilty', partly_guilty: 'Guilty on some charges', not_guilty: 'Not guilty' }[h.finding] || '[finding]') + '</p>',
      '<p><b>Sanction:</b> ' + esc(h.sanction || '[sanction]') + '</p>',
      (h.outcome_notes ? '<p><b>Reasons:</b><br>' + esc(h.outcome_notes).replace(/\n/g, '<br>') + '</p>' : '<p><b>Reasons:</b> [summary of evidence and reasons]</p>'),
      '<p>If you disagree with this outcome, you may refer a dispute to the CCMA or the relevant bargaining council within 30 days of the date of dismissal, or within 90 days for an unfair labour practice.</p>'
    ], h.our_role === 'chairperson' ? 'Chairperson' : 'Signed for ' + (c.name || 'the employer')));
  };
  function hearingRows(hs) {
    return '<div class="tbl"><table><tr><th>When</th><th>Employee</th><th>Employer</th><th>Type</th><th>Our role</th><th>Checklist</th><th>Status</th></tr>' +
      (hs.map(function (h) { var done = CHECKS.filter(function (c) { return h.checklist && h.checklist[c[0]]; }).length; var shortNotice = h.starts_at && h.notice_served && (D(h.starts_at) - D(h.notice_served)) / 36e5 < 48; return '<tr class="click" data-act="open-hearing" data-id="' + h.id + '"><td class="mono">' + (h.starts_at ? fmtDT(h.starts_at) : 'Not set') + '</td><td><b>' + esc(h.employee_name) + '</b>' + (shortNotice ? '<div>' + pill('Short notice', 'p-red') + '</div>' : '') + '</td><td>' + esc(clientName(h.client_id)) + '</td><td>' + lbl(HTYPE, h.hearing_type) + '</td><td>' + lbl(HROLE, h.our_role) + '</td><td>' + pill(done + '/' + CHECKS.length, done === CHECKS.length ? 'p-green' : done >= 6 ? 'p-amber' : 'p-red') + '</td><td>' + pill(lbl(HSTATUS, h.status), h.status === 'finding_issued' ? 'p-green' : h.status === 'cancelled' ? '' : h.status === 'held' ? 'p-amber' : 'p-blue') + '</td></tr>'; }).join('') || '<tr><td colspan="7">' + empty('No hearings yet.') + '</td></tr>') + '</table></div>';
  }
  V.hearings = function () {
    var up = S.hearings.filter(function (h) { return ['scheduled', 'postponed', 'held'].indexOf(h.status) >= 0; }), past = S.hearings.filter(function (h) { return up.indexOf(h) < 0; }).reverse();
    return head('Hearings', 'Disciplinary hearings', 'Hearings you chair, initiate or attend for an employee. The checklist follows the Code of Good Practice: Dismissal, so a later CCMA challenge on procedure has an answer.', '<button class="btn pri" data-act="new-hearing">New hearing</button>') +
      '<div class="panel"><div class="hd"><h2>Upcoming and open</h2></div>' + hearingRows(up) + '</div><div class="panel"><div class="hd"><h2>Completed and cancelled</h2></div>' + hearingRows(past) + '</div>';
  };
  function matterHearings(m) { return '<div style="margin-bottom:12px"><button class="btn pri" data-act="new-hearing" data-matter="' + m.id + '">New hearing</button></div>' + hearingRows(S.hearings.filter(function (h) { return h.matter_id === m.id; })); }

  /* ----- Employer compliance ----- */
  var STD_OBLIGATIONS = [
    ['ee', 'Employment Equity report (EEA2 and EEA4), submitted online', 'EEA s21', 'yearly', 1, 15, 'Designated employers only.'],
    ['wsp', 'Workplace Skills Plan and Annual Training Report', 'Skills Development Act', 'yearly', 4, 30, 'Needed to claim the mandatory grant from the SETA.'],
    ['coida', 'COIDA return of earnings', 'COIDA s82', 'yearly', 5, 31, 'Submitted on the Compensation Fund portal.'],
    ['emp501', 'EMP501 annual employer reconciliation (PAYE, UIF, SDL)', 'Tax Administration Act', 'yearly', 5, 31, 'Also an interim reconciliation by 31 October.'],
    ['emp201', 'EMP201 monthly PAYE, UIF and SDL payment', 'Income Tax Act, 4th Schedule', 'monthly', null, 7, 'Due by the 7th of each month.'],
    ['nmw', 'Apply the new national minimum wage to payroll', 'National Minimum Wage Act', 'yearly', 3, 1, 'New rate usually takes effect on 1 March.'],
    ['policies', 'Annual review of disciplinary code, grievance procedure and policies', 'LRA Schedule 8', 'yearly', 2, 28, 'Include the harassment policy (2022 Code of Good Practice).']
  ];
  function nextDue(rec, month, day, from) {
    from = from || today();
    if (rec === 'monthly') { var d = new Date(from.getFullYear(), from.getMonth(), day); if (d < from) d = new Date(from.getFullYear(), from.getMonth() + 1, day); return d; }
    var y = new Date(from.getFullYear(), month - 1, day); if (y < from) y = new Date(from.getFullYear() + 1, month - 1, day); return y;
  }
  P2['seed-compliance'] = function (el) {
    var employers = S.clients.filter(function (c) { return c.kind === 'employer'; });
    if (!employers.length) { toast('Add an employer client first.'); return; }
    openForm({
      title: 'Add standard obligations', saveLabel: 'Add to calendar',
      fields: [{ k: 'client_id', label: 'Employer', type: 'select', req: true, full: true, options: employers.map(function (c) { return [c.id, c.name]; }) }],
      values: { client_id: el.dataset.client || employers[0].id },
      extra: '<div class="fld full"><span class="lbl">Obligations</span>' + STD_OBLIGATIONS.map(function (o) { var d = nextDue(o[3], o[4], o[5]); return '<label class="check" style="font-weight:400;align-items:flex-start"><input type="checkbox" class="std" data-k="' + o[0] + '" checked> <span>' + esc(o[1]) + '<span class="meta" style="display:block">Next due ' + fmt(d) + ' · ' + (o[3] === 'monthly' ? 'monthly' : 'yearly') + ' · ' + esc(o[2]) + '. ' + esc(o[6]) + '</span></span></label>'; }).join('') + '</div>',
      save: async function (d) {
        var picked = Array.prototype.filter.call(document.querySelectorAll('.std'), function (c) { return c.checked; }).map(function (c) { return c.dataset.k; });
        var existing = S.compliance.filter(function (c) { return c.client_id === d.client_id && c.status === 'open'; }).map(function (c) { return c.obligation; });
        var rows = STD_OBLIGATIONS.filter(function (o) { return picked.indexOf(o[0]) >= 0 && existing.indexOf(o[1]) < 0; }).map(function (o) { return { client_id: d.client_id, obligation: o[1], law: o[2], recurrence: o[3], due_date: ymd(nextDue(o[3], o[4], o[5])), notes: o[6] }; });
        if (!rows.length) return 'Those obligations are already on the calendar for this client.';
        var r = await sb.from('compliance_items').insert(rows).select(); if (r.error) return dbErr(r);
        S.compliance = S.compliance.concat(r.data).sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; });
        toast(rows.length + ' obligations added'); render();
      }
    });
  };
  function editCompliance(c) {
    var isNew = !c || !c.id;
    openForm({
      title: isNew ? 'Add obligation' : c.obligation,
      fields: [{ k: 'client_id', label: 'Employer', type: 'select', req: true, options: S.clients.map(function (x) { return [x.id, x.name]; }) }, { k: 'obligation', label: 'Obligation', req: true, full: true }, { k: 'law', label: 'Law' }, { k: 'due_date', label: 'Due date', type: 'date', req: true }, { k: 'recurrence', label: 'Repeats', type: 'select', options: [['once', 'Once'], ['monthly', 'Monthly'], ['yearly', 'Yearly']] }, { k: 'notes', label: 'Notes', type: 'textarea', full: true }],
      values: c || { recurrence: 'yearly' },
      save: async function (d) { var r = isNew ? await sb.from('compliance_items').insert(d).select().single() : await sb.from('compliance_items').update(d).eq('id', c.id).select().single(); if (r.error) return dbErr(r); upsertLocal(S.compliance, r.data); S.compliance.sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; }); toast('Saved'); render(); },
      del: isNew ? null : async function () { var r = await sb.from('compliance_items').delete().eq('id', c.id); if (r.error) return dbErr(r); S.compliance = S.compliance.filter(function (x) { return x.id !== c.id; }); toast('Deleted'); render(); }
    });
  }
  P2['new-compliance'] = function () { if (!S.clients.length) { toast('Add a client first.'); return; } editCompliance(null); };
  P2['open-compliance'] = function (el) { editCompliance(byId(S.compliance, el.dataset.id)); };
  P2['done-compliance'] = async function (el) {
    var c = byId(S.compliance, el.dataset.id);
    var r = await sb.from('compliance_items').update({ status: 'done', completed_on: ymd(today()) }).eq('id', c.id).select().single(); if (r.error) { toast(r.error.message); return; }
    upsertLocal(S.compliance, r.data);
    if (c.recurrence !== 'once') {
      var nd = c.recurrence === 'monthly' ? addMonths(D(c.due_date), 1) : addMonths(D(c.due_date), 12);
      var n = await sb.from('compliance_items').insert({ client_id: c.client_id, obligation: c.obligation, law: c.law, recurrence: c.recurrence, due_date: ymd(nd), notes: c.notes }).select().single();
      if (!n.error) S.compliance.push(n.data);
      toast('Done. Next one due ' + fmt(nd));
    } else toast('Marked done');
    S.compliance.sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; }); render();
  };
  V.compliance = function () {
    var open = S.compliance.filter(function (c) { return c.status === 'open'; }), done = S.compliance.filter(function (c) { return c.status === 'done'; }).slice(-15).reverse();
    var employers = S.clients.filter(function (c) { return c.kind === 'employer'; });
    return head('Employer compliance', 'Statutory calendar for employer clients', 'Recurring obligations for your employer clients. Mark one done and the next one is scheduled automatically. Everything here also appears under Deadlines.', '<button class="btn pri" data-act="seed-compliance">Add standard obligations</button><button class="btn" data-act="new-compliance">Add one</button>') +
      '<div class="grid g4"><div class="panel stat"><b style="color:var(--red)">' + open.filter(function (c) { return daysLeft(c.due_date) < 0; }).length + '</b><span>Overdue</span></div><div class="panel stat"><b>' + open.filter(function (c) { var n = daysLeft(c.due_date); return n >= 0 && n <= 30; }).length + '</b><span>Due in the next 30 days</span></div><div class="panel stat"><b>' + open.length + '</b><span>Open obligations</span></div><div class="panel stat"><b>' + employers.length + '</b><span>Employer clients</span></div></div>' +
      '<div class="panel"><div class="hd"><h2>Coming up</h2></div><div class="tbl"><table><tr><th>Due</th><th>Obligation</th><th>Employer</th><th>Law</th><th>Repeats</th><th></th></tr>' +
      (open.map(function (c) { return '<tr><td class="mono">' + fmt(c.due_date) + '<div>' + urg(daysLeft(c.due_date)) + '</div></td><td><a href="#" data-act="open-compliance" data-id="' + c.id + '"><b>' + esc(c.obligation) + '</b></a>' + (c.notes ? '<div class="meta">' + esc(c.notes) + '</div>' : '') + '</td><td>' + esc(clientName(c.client_id)) + '</td><td>' + esc(c.law || '') + '</td><td>' + esc(c.recurrence) + '</td><td><button class="btn sm" data-act="compliance-quote" data-id="' + c.id + '">Quote</button> <button class="btn sm" data-act="done-compliance" data-id="' + c.id + '">Mark done</button></td></tr>'; }).join('') || '<tr><td colspan="6">' + empty(employers.length ? 'Nothing scheduled. Use “Add standard obligations” for each employer client.' : 'Add an employer client first, then add their obligations here.') + '</td></tr>') + '</table></div></div>' +
      (done.length ? '<div class="panel"><div class="hd"><h2>Recently completed</h2></div><div class="list">' + done.map(function (c) { return '<div class="row"><div class="grow">' + esc(c.obligation) + '<div class="meta">' + esc(clientName(c.client_id)) + ' · due ' + fmt(c.due_date) + '</div></div>' + pill('Done ' + fmt(c.completed_on), 'p-green') + '</div>'; }).join('') + '</div></div>' : '') +
      '<p class="meta">Dates are the usual statutory deadlines. Check each year for changes announced by the Department of Employment and Labour, SARS or the Compensation Fund.</p>';
  };

  /* ----- Dashboard views ----- */
  V.dashboard = function () {
    var tab = S.ui.dashTab || 'Practice';
    var tabs = '<div class="subtabs">' + ['Practice', 'Sales', 'Website', 'Finance'].map(function (x) { return '<button data-dashtab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    if (tab === 'Practice') return dashPractice().replace('<div class="grid g4">', tabs + '<div class="grid g4">');
    var title = head(new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 'Dashboard', '', '<button class="btn pri" data-act="new-lead">New enquiry</button><button class="btn" data-act="log-time">Log time</button>') + tabs;
    var monthStart = new Date(today().getFullYear(), today().getMonth(), 1), lastStart = new Date(today().getFullYear(), today().getMonth() - 1, 1);
    if (tab === 'Sales') {
      var thisM = S.leads.filter(function (l) { return D(l.created_at) >= monthStart; }).length, lastM = S.leads.filter(function (l) { return D(l.created_at) >= lastStart && D(l.created_at) < monthStart; }).length;
      var live = S.leads.filter(function (l) { return ['new', 'contacted', 'consultation_booked', 'quote_sent'].indexOf(l.status) >= 0; });
      var decided = S.leads.filter(function (l) { return l.status === 'client' || l.status === 'lost'; });
      return title + '<div class="grid g4"><div class="panel stat"><b>' + thisM + '</b><span>Enquiries this month (last month ' + lastM + ')</span></div><div class="panel stat"><b>' + R2(live.reduce(function (s, l) { return s + Number(l.est_value || 0); }, 0)) + '</b><span>Open pipeline value</span></div><div class="panel stat"><b>' + (decided.length ? Math.round(decided.filter(function (l) { return l.status === 'client'; }).length / decided.length * 100) : 0) + '%</b><span>Win rate (engaged ÷ decided)</span></div><div class="panel stat"><b>' + S.quotes.filter(function (q) { return q.status === 'sent'; }).length + '</b><span>Quotes waiting for an answer</span></div></div>' +
        '<div class="grid g2"><div class="panel"><div class="hd"><h2>Pipeline by stage</h2><a href="#pipeline">Pipeline</a></div>' + bars(LEAD_STAGES.filter(function (s) { return s[0] !== 'closed'; }).map(function (s) { return [s[1], S.leads.filter(function (l) { return l.status === s[0]; }).length]; })) + '</div><div class="panel"><div class="hd"><h2>Where enquiries come from</h2><a href="#website">Website</a></div>' + bars(countBy(S.leads, function (l) { return l.source; }).slice(0, 8)) + '</div></div>';
    }
    if (tab === 'Website') {
      var v = S.web.views; if (!v) { loadViews(); return title + '<p class="meta">Loading visitor data…</p>'; }
      if (v.error) return title + '<div class="callout p-red">' + esc(v.error) + '</div>';
      var days = []; for (var i = 13; i >= 0; i--) days.push(ymd(addDays(today(), -i)));
      var per = days.map(function (d) { var s = {}; v.forEach(function (p) { if (ymd(p.created_at) === d) s[p.session || p.created_at] = 1; }); return Object.keys(s).length; });
      var sess = {}; v.forEach(function (p) { sess[p.session || p.created_at] = 1; });
      return title + '<div class="grid g4"><div class="panel stat"><b>' + Object.keys(sess).length + '</b><span>Visits, last ' + S.web.days + ' days</span></div><div class="panel stat"><b>' + v.length + '</b><span>Pages viewed</span></div><div class="panel stat"><b>' + S.leads.filter(function (l) { return l.page && D(l.created_at) >= addDays(today(), -(S.web.days - 1)); }).length + '</b><span>Website enquiries, same period</span></div><div class="panel stat"><b>' + (S.web.gsc && S.web.gsc.connected ? S.web.gsc.byDate.reduce(function (s, r) { return s + r.clicks; }, 0) : '—') + '</b><span>Google clicks, 28 days</span></div></div>' +
        '<div class="panel"><div class="hd"><h2>Visits, last 14 days</h2><a href="#website">Website</a></div>' + lineChart(days.map(function (d) { return fmt(d).replace(/ \d{4}$/, ''); }), [{ data: per, color: 'var(--accent)', fill: true }]) + '</div>';
    }
    var feesM = S.payments.filter(function (p) { return p.account === 'business' && D(p.received_on) >= monthStart; }).reduce(function (s, p) { return s + Number(p.amount); }, 0);
    var feesL = S.payments.filter(function (p) { return p.account === 'business' && D(p.received_on) >= lastStart && D(p.received_on) < monthStart; }).reduce(function (s, p) { return s + Number(p.amount); }, 0);
    var owed = S.invoices.reduce(function (s, i) { var st = invState(i); return s + (['sent', 'part', 'overdue'].indexOf(st.key) >= 0 ? st.bal : 0); }, 0);
    var od = S.invoices.reduce(function (s, i) { var st = invState(i); return s + (st.key === 'overdue' ? st.bal : 0); }, 0);
    var months = []; for (var k = 5; k >= 0; k--) months.push(new Date(today().getFullYear(), today().getMonth() - k, 1));
    var perM = months.map(function (m0, ix) { var m1 = ix < 5 ? months[ix + 1] : new Date(today().getFullYear(), today().getMonth() + 1, 1); return S.payments.filter(function (p) { return p.account === 'business' && D(p.received_on) >= m0 && D(p.received_on) < m1; }).reduce(function (s, p) { return s + Number(p.amount); }, 0); });
    var byClient = {}; S.payments.filter(function (p) { return p.account === 'business'; }).forEach(function (p) { var n = clientName(p.client_id); byClient[n] = (byClient[n] || 0) + Number(p.amount); });
    return title + '<div class="grid g4"><div class="panel stat"><b>' + R2(feesM) + '</b><span>Fees received this month (last month ' + R2(feesL) + ')</span></div><div class="panel stat"><b>' + R2(owed) + '</b><span>Owed by clients</span></div><div class="panel stat"><b style="color:var(--red)">' + R2(od) + '</b><span>Overdue</span></div><div class="panel stat"><b>' + R2(S.time.filter(unbilled).reduce(function (s, t) { return s + t.hours * t.rate; }, 0)) + '</b><span>Unbilled time</span></div></div>' +
      '<div class="grid g2"><div class="panel"><div class="hd"><h2>Fees received, last 6 months</h2><a href="#payments">Payments</a></div>' + lineChart(months.map(function (m0) { return m0.toLocaleDateString('en-ZA', { month: 'short' }); }), [{ data: perM.map(function (x) { return Math.round(x); }), color: 'var(--accent)', fill: true }]) + '</div><div class="panel"><div class="hd"><h2>Fees by client</h2></div>' + bars(Object.keys(byClient).map(function (n) { return [n, Math.round(byClient[n])]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8)).replace(/(\d+)<\/span><\/div>/g, function (m, n) { return R2(n) + '</span></div>'; }) + '</div></div>';
  };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-dashtab]'); if (!b) return; S.ui.dashTab = b.dataset.dashtab; render(); });

  /* =====================================================================
     LINKS: calendar sync, matter emails, prefilled documents, closing checklist, conflict check
     ===================================================================== */

  /* ----- Calendar entries kept in step with hearings and matter next steps ----- */
  async function upsertAppt(key, row) {
    var ex = S.appts.find(function (a) { return a.source_key === key; });
    if (!row) { if (ex) { var d0 = await sb.from('appointments').delete().eq('id', ex.id); if (!d0.error) S.appts = S.appts.filter(function (a) { return a.id !== ex.id; }); } return; }
    row.source_key = key;
    var r = ex ? await sb.from('appointments').update(row).eq('id', ex.id).select().single() : await sb.from('appointments').insert(row).select().single();
    if (!r.error) { upsertLocal(S.appts, r.data); S.appts.sort(function (a, b) { return D(a.starts_at) - D(b.starts_at); }); }
  }
  async function syncHearingAppt(h) {
    if (!h.starts_at || h.status === 'cancelled') return upsertAppt('hearing:' + h.id, null);
    var done = h.status === 'held' || h.status === 'finding_issued';
    return upsertAppt('hearing:' + h.id, { starts_at: h.starts_at, duration_min: 180, kind: 'hearing', title: 'Disciplinary hearing: ' + h.employee_name, location: h.venue || null, status: done ? 'done' : 'scheduled', matter_id: h.matter_id || null, client_id: h.client_id || null, notes: h.charges || null });
  }
  async function syncMatterNext(m) {
    var key = 'matter-next:' + m.id;
    if (!m.next_date || m.stage === 'Closed') return upsertAppt(key, null);
    var kind = /court/i.test(m.forum || '') ? 'court' : /ccma|council/i.test(m.forum || '') ? 'ccma' : /hearing/i.test(m.forum || '') ? 'hearing' : 'meeting';
    var ex = S.appts.find(function (a) { return a.source_key === key; });
    var start = D(m.next_date);
    if (ex) { var old = D(ex.starts_at); start.setHours(old.getHours(), old.getMinutes()); } else start.setHours(9, 0);
    return upsertAppt(key, { starts_at: start.toISOString(), duration_min: ex ? ex.duration_min : 120, kind: kind, title: (m.next_step || 'Next step') + ' (' + m.ref + ')', location: ex ? ex.location : (kind === 'ccma' ? (m.forum === 'CCMA' ? 'CCMA' : 'Bargaining council') : kind === 'court' ? 'Labour Court, Johannesburg' : null), status: 'scheduled', matter_id: m.id, client_id: m.client_id || null });
  }
  P2['confirm-appt'] = async function (el) {
    var a = byId(S.appts, el.dataset.id);
    var r = await sb.from('appointments').update({ status: 'scheduled' }).eq('id', a.id).select().single(); if (r.error) { toast(r.error.message); return; }
    upsertLocal(S.appts, r.data);
    var l = a.lead_id && byId(S.leads, a.lead_id);
    if (l && (l.status === 'new' || l.status === 'contacted')) { var lr = await sb.from('leads').update({ status: 'consultation_booked' }).eq('id', l.id).select().single(); if (!lr.error) upsertLocal(S.leads, lr.data); }
    toast('Confirmed for ' + fmtDT(a.starts_at)); render();
  };

  /* ----- Emails found by matter reference or case number (searches the mailbox live) ----- */
  var matterTerms = function (m) { return [m.ref, m.case_no].filter(function (x) { return x && x.length >= 5 && !/^(—|-|not yet)/i.test(x); }); };
  function matterEmails(m) {
    var terms = matterTerms(m), cache = S.mailSearch = S.mailSearch || {};
    if (S.mail.state === 'unconfigured') return '<p class="meta">Connect the info@ mailbox (Company settings → Email) to see this matter’s emails here.</p>';
    if (!terms.length) return '<p class="meta">Add a case number to the matter so its emails can be found.</p>';
    var c = cache[m.id];
    if (!c) { cache[m.id] = { loading: true }; Promise.all(terms.map(function (q) { return api('/api/mail?action=search&q=' + encodeURIComponent(q)); })).then(function (rs) { var bad = rs.find(function (x) { return x.configured === false || x.error; }); var seen = {}, list = []; rs.forEach(function (x) { (x.messages || []).forEach(function (e) { if (!seen[e.uid]) { seen[e.uid] = 1; list.push(e); } }); }); list.sort(function (a, b) { return a.date < b.date ? 1 : -1; }); cache[m.id] = bad ? { error: bad.configured === false ? 'unconfigured' : bad.error } : { list: list }; if (location.hash === '#matter=' + m.id) render(); }); return '<p class="meta">Searching the mailbox for ' + terms.map(esc).join(' or ') + '…</p>'; }
    if (c.loading) return '<p class="meta">Searching the mailbox…</p>';
    if (c.error) return c.error === 'unconfigured' ? '<p class="meta">Connect the info@ mailbox (Company settings → Email) to see this matter’s emails here.</p>' : '<div class="callout p-red">' + esc(c.error) + '</div>';
    return '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="meta">Emails in info@ that mention ' + terms.map(function (t) { return '<b>' + esc(t) + '</b>'; }).join(' or ') + '. Put the matter reference in your email subjects so replies are found too.</span><button class="btn sm" data-act="matter-mail-refresh" data-matter="' + m.id + '">Search again</button></div><div class="list">' +
      (c.list.map(function (e) { return '<button class="row" data-act="matter-mail-open" data-uid="' + e.uid + '" style="border:0;border-bottom:1px solid var(--line);background:none;text-align:left;cursor:pointer;width:100%"><div class="grow"><b>' + esc(e.subject) + '</b><div class="meta">' + esc(who(e.from)) + ' · ' + fmtDT(e.date) + '</div></div></button>'; }).join('') || empty('No emails mention this matter yet.')) + '</div>';
  }
  P2['matter-mail-refresh'] = function (el) { delete (S.mailSearch || {})[el.dataset.matter]; render(); };
  P2['matter-mail-open'] = function (el) { S.ui.inboxTab = 'Email (info@)'; location.hash = 'inbox'; setTimeout(function () { P2['mail-open']({ dataset: { uid: el.dataset.uid } }); }, 50); };
  function mailMatter(subject) { var s = (subject || '').toLowerCase(); return S.matters.find(function (m) { return matterTerms(m).some(function (t) { return s.indexOf(t.toLowerCase()) >= 0; }); }); }

  /* ----- Documents prefilled from the matter ----- */
  P2['matter-doc'] = function (el) { var m = byId(S.matters, el.dataset.matter); S.ui.dTab = 'Create a document'; S.ui.ctType = el.dataset.type; S.ui.ctMatter = m.id; S.ui.ctClient = m.client_id || ''; location.hash = 'documents'; };
  function fillContractDefaults() {
    var type = $('ct-type') && $('ct-type').value; if (!type) return;
    var m = byId(S.matters, $('ct-matter').value); if (!m) return;
    var c = byId(S.clients, m.client_id) || {}, emp = m.acting_for === 'employee';
    var defaults = { 'Employer': emp ? m.other_party : c.name, 'Employee': emp ? c.name : m.other_party, 'Case number': m.case_no && !/^(—|not yet)/i.test(m.case_no) ? m.case_no : '', 'Fee arrangement': m.fee_arrangement, 'Scope of work': [m.dispute_type, m.title].filter(Boolean).join(': '), 'Normal hourly rate': S.settings && S.settings.hourly_rate ? R2(S.settings.hourly_rate) : '' };
    CONTRACTS[type].fields.forEach(function (f, i) { var inp = $('ct-f' + i); if (inp && !inp.value && defaults[f]) inp.value = defaults[f]; });
  }

  /* ----- Closing a matter ----- */
  function closeMatterChecklist(m) {
    var ub = S.time.filter(function (t) { return t.matter_id === m.id && unbilled(t); }), ubVal = ub.reduce(function (s, t) { return s + t.hours * t.rate; }, 0);
    var openInv = S.invoices.filter(function (i) { return i.matter_id === m.id && ['sent', 'part', 'overdue', 'draft'].indexOf(invState(i).key) >= 0; });
    var future = S.appts.filter(function (a) { return a.matter_id === m.id && ['scheduled', 'provisional'].indexOf(a.status) >= 0 && D(a.starts_at) >= today(); });
    var c = byId(S.clients, m.client_id) || {}, review = S.settings && S.settings.google_review_link;
    var line = function (ok, text, btn) { return '<div class="row" style="align-items:center">' + pill(ok ? 'Done' : 'Check', ok ? 'p-green' : 'p-amber') + '<div class="grow">' + text + '</div>' + (btn || '') + '</div>'; };
    openForm({
      title: 'Closing ' + m.ref, saveLabel: 'Finish', fields: [],
      extra: '<div class="fld full"><p class="sub" style="margin:0 0 8px">Before you file this matter away:</p><div class="list">' +
        line(!ub.length, ub.length ? ub.length + ' unbilled time entries worth <b>' + R2(ubVal) + '</b>' : 'No unbilled time', ub.length ? '<button type="button" class="btn sm pri" data-act="invoice-time" data-matter="' + m.id + '">Create final invoice</button>' : '') +
        line(!openInv.length, openInv.length ? openInv.length + ' invoice(s) not fully paid: ' + openInv.map(function (i) { return esc(i.number) + ' (' + invState(i).label.toLowerCase() + ', ' + R2(invState(i).bal) + ')'; }).join(', ') : 'All invoices paid') +
        line(!future.length, future.length ? future.length + ' future appointment(s) still in the calendar' : 'No future appointments', future.length ? '<label class="check" style="font-weight:400"><input type="checkbox" id="close-cancel" checked> Cancel them</label>' : '') +
        line(c.fica_status === 'done', c.fica_status === 'done' ? 'FICA documents on file' : 'FICA documents not complete for ' + esc(c.name || 'the client')) +
        '</div><div style="margin-top:12px">' + (review && c.email ? '<label class="check" style="font-weight:400"><input type="checkbox" id="close-review"> Email ' + esc(c.email) + ' a thank-you with a link to leave a Google review</label>' : '<span class="meta">' + (!review ? 'Add your Google review link in Company settings to send review requests when matters close.' : 'The client has no email address, so no review request can be sent.') + '</span>') + '</div></div>',
      save: async function () {
        if ($('close-cancel') && $('close-cancel').checked) { for (var i = 0; i < future.length; i++) { var r = await sb.from('appointments').update({ status: 'cancelled' }).eq('id', future[i].id).select().single(); if (!r.error) upsertLocal(S.appts, r.data); } }
        if ($('close-review') && $('close-review').checked) {
          var st = S.settings || {}, first = (c.contact_person || c.name || '').split(' ')[0];
          var html = '<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#1d1d1d;max-width:600px"><img src="https://labourlawalliance.co.za/assets/images/logo.png?v=2" width="160" alt="Labour Law Alliance"><p>Dear ' + esc(first) + ',</p><p>Thank you for trusting ' + esc(st.trading_name || 'Labour Law Alliance') + ' with your matter. It was a privilege to assist you.</p><p>If you were happy with our service, would you take a minute to leave us a Google review? It helps other people find the help they need.</p><p><a href="' + esc(review) + '" style="display:inline-block;background:#16203b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Leave a review</a></p><p>Kind regards,<br>' + esc(st.trading_name || 'Labour Law Alliance') + '<br>' + esc(st.phone || '') + '</p></div>';
          var err = await emailDoc(c.email, 'Thank you from ' + (st.trading_name || 'Labour Law Alliance'), html, 'Dear ' + first + ',\n\nThank you for trusting us with your matter. If you were happy with our service, please leave us a Google review: ' + review + '\n\nKind regards,\n' + (st.trading_name || ''));
          if (err) return 'Matter closed, but the review email failed: ' + err;
          toast('Review request sent to ' + c.email);
        }
        await syncMatterNext(m); render();
      }
    });
  }

  /* ----- Conflict check across clients, matters, hearings and enquiries ----- */
  var norm = function (s) { return String(s || '').toLowerCase().replace(/\(pty\)|ltd|limited|inc|cc\b|[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); };
  function conflicts(name, skip) {
    var q = norm(name); skip = skip || {};
    if (q.length < 4) return [];
    var hit = function (s) { var n = norm(s); return n.length >= 4 && (n === q || n.indexOf(q) >= 0 || q.indexOf(n) >= 0); };
    var out = [];
    S.clients.forEach(function (c) { if (c.id !== skip.client && (hit(c.name) || hit(c.contact_person))) out.push({ text: 'Client: ' + c.name, risk: skip.otherParty ? 'high' : 'low', client: c.id }); });
    S.matters.forEach(function (m) { if (m.id === skip.matter) return; if (hit(m.other_party)) out.push({ text: 'Other party on ' + m.ref + ' (' + m.title + '), where we act for the ' + m.acting_for, risk: skip.otherParty ? 'low' : 'high', matter: m.id }); });
    S.hearings.forEach(function (h) { if (hit(h.employee_name)) out.push({ text: 'Employee in a disciplinary hearing for ' + clientName(h.client_id), risk: 'high', hearing: h.id }); });
    S.leads.forEach(function (l) { if (l.id !== skip.lead && !(skip.client && l.client_id === skip.client) && hit(leadName(l))) out.push({ text: 'Earlier enquiry from ' + leadName(l) + ' (' + fmt(l.created_at) + ')', risk: 'low', lead: l.id }); });
    return out;
  }
  function conflictHtml(list) {
    if (!list.length) return '<span style="color:var(--green)">No conflicts found.</span>';
    var high = list.filter(function (x) { return x.risk === 'high'; });
    return '<span style="color:var(--' + (high.length ? 'red' : 'amber') + ');font-weight:600">' + (high.length ? 'Possible conflict: ' : 'Already known: ') + '</span>' + list.slice(0, 4).map(function (x) { return esc(x.text); }).join('; ') + (list.length > 4 ? ' and ' + (list.length - 4) + ' more' : '');
  }
  function conflictHint(inputId, skip, value) {
    var i = $(inputId), h = $(inputId + '-hint'); if (!h) return;
    if (h.dataset.base == null) h.dataset.base = h.textContent;
    var v = value != null ? value : (i && i.value);
    if (!v || norm(v).length < 4) { h.textContent = h.dataset.base; return; }
    h.innerHTML = conflictHtml(conflicts(v, skip));
  }
  function conflictPanel(name, skip) { var list = conflicts(name, skip); if (!list.length) return ''; var high = list.some(function (x) { return x.risk === 'high'; }); return '<div class="callout ' + (high ? 'p-red' : 'p-amber') + '">' + conflictHtml(list) + '</div>'; }

  /* ----- Show the linked matter on inbox emails ----- */
  var _mailView = mailView;
  mailView = function () { var html = _mailView(); return html.replace(/data-act="mail-open" data-uid="(\d+)">([\s\S]*?)<\/button>/g, function (all, uid, inner) { var e = S.mail.list.find(function (x) { return String(x.uid) === uid; }); var m = e && mailMatter(e.subject); return m ? all.replace('</span></span></button>', '</span><span style="display:flex;gap:6px;margin-top:4px">' + pill(m.ref, 'p-blue') + '</span></span></button>') : all; }); };

  /* ----- Calendar subscription and daily reminders ----- */
  function randomKey() { var a = new Uint8Array(24); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function calendarSettings() {
    var st = S.settings || {}, can = canMoney();
    var feed = st.calendar_token ? 'https://labourlawalliance.co.za/api/calendar?t=' + st.calendar_token : '';
    var copy = function (id, val) { return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="text" id="' + id + '" value="' + esc(val) + '" readonly style="flex:1;min-width:220px;font-family:monospace;font-size:12px"><button class="btn sm" data-act="copy" data-target="' + id + '">Copy</button></div>'; };
    return (can ? '' : '<div class="callout p-amber">Only a partner or the bookkeeper can change these settings.</div>') +
      '<div class="panel"><div class="hd"><h2>Calendar on your phone and in Outlook</h2>' + (feed ? pill('On', 'p-green') : pill('Off', 'p-amber')) + '</div>' +
      '<p class="sub" style="margin:0 0 12px">A private calendar link with every appointment, hearing, CCMA date, deadline, statutory time limit (with a 7-day warning) and compliance date. Your calendar app checks it for changes about every hour. Anyone with the link can see these entries, so keep it to staff.</p>' +
      (feed ? copy('cal-url', feed) +
        '<div class="grid g3" style="margin-top:12px"><div><b>Outlook</b><div class="meta">Calendar → Add calendar → Subscribe from web → paste the link.</div></div><div><b>Google Calendar</b><div class="meta">Other calendars → + → From URL → paste the link.</div></div><div><b>iPhone</b><div class="meta">Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the link.</div></div></div>' +
        (can ? '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="cal-token" data-mode="new">Make a new link (stops the old one)</button><button class="btn sm danger" data-act="cal-token" data-mode="off">Turn off</button></div>' : '')
        : (can ? '<button class="btn pri" data-act="cal-token" data-mode="new">Create my calendar link</button>' : '')) + '</div>' +
      '<div class="panel"><div class="hd"><h2>Appointment reminders and daily agenda</h2>' + (st.reminder_key ? pill(st.reminders_enabled ? 'Reminders on' : 'Reminders off', st.reminders_enabled ? 'p-green' : 'p-amber') : pill('Not set up', 'p-amber')) + '</div>' +
      '<p class="sub" style="margin:0 0 12px">Every morning at about 06:00, clients with a confirmed appointment, CCMA or Labour Court date the next day get an email reminder (once per appointment), and the office gets today’s diary at info@.</p>' +
      (st.reminder_key ? '<form id="rem-form" class="f" style="grid-template-columns:1fr"><label class="check" style="font-weight:400"><input type="checkbox" id="rem-on"' + (st.reminders_enabled ? ' checked' : '') + (can ? '' : ' disabled') + '> Email clients a reminder the day before their appointment</label><label class="check" style="font-weight:400"><input type="checkbox" id="agenda-on"' + (st.daily_agenda_enabled ? ' checked' : '') + (can ? '' : ' disabled') + '> Email the office today’s diary every morning</label><label class="check" style="font-weight:400"><input type="checkbox" id="report-on"' + (st.monthly_report_enabled !== false ? ' checked' : '') + (can ? '' : ' disabled') + '> Email partners a practice report on the 1st of each month</label>' + (can ? '<div><button class="btn pri" type="submit">Save</button> <span class="msg" id="rem-msg"></span></div>' : '') + '</form>' +
        '<div style="margin-top:14px"><b>Last step, done once:</b> in <a href="https://vercel.com/" target="_blank" rel="noopener">Vercel</a> → project <b>labour</b> → Settings → Environment Variables, add <code>REMINDER_KEY</code> with this value (mark it Sensitive), then redeploy:</div>' + copy('rem-key', st.reminder_key) +
        '<p class="meta" style="margin-top:8px">The key lets the morning job read tomorrow’s appointments. If you make a new key, update it in Vercel too.</p>' + (can ? '<button class="btn sm" data-act="rem-key">Make a new key</button>' : '')
        : (can ? '<button class="btn pri" data-act="rem-key">Set up reminders</button>' : '')) + '</div>';
  }
  async function saveSettings(patch, msg) {
    var r = await sb.from('company_settings').update(patch).eq('id', 1).select().single();
    if (r.error || !r.data) { toast(r.error ? r.error.message : 'Only a partner or the bookkeeper can change this.'); return false; }
    S.settings = r.data; if (msg) toast(msg); render(); return true;
  }
  P2['cal-token'] = function (el) { if (el.dataset.mode === 'off') { if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again to turn off'; return; } return saveSettings({ calendar_token: null }, 'Calendar link turned off'); } if (S.settings.calendar_token && el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again: the old link will stop working'; return; } return saveSettings({ calendar_token: randomKey() }, 'Calendar link ready'); };
  P2['rem-key'] = function (el) { if (S.settings.reminder_key && el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again: update Vercel afterwards'; return; } return saveSettings(Object.assign({ reminder_key: randomKey() }, S.settings.reminder_key ? {} : { reminders_enabled: true, daily_agenda_enabled: true }), 'Reminder key created. Add it to Vercel to finish.'); };
  P2['copy'] = function (el) { var i = $(el.dataset.target); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(function () { toast('Copied'); }, function () { document.execCommand('copy'); toast('Copied'); }); };
  document.addEventListener('submit', function (e) { if (e.target.id !== 'rem-form') return; e.preventDefault(); saveSettings({ reminders_enabled: $('rem-on').checked, daily_agenda_enabled: $('agenda-on').checked, monthly_report_enabled: $('report-on').checked }, 'Saved'); });

  /* =====================================================================
     INTERLINKING: search, client page, tasks & My work, stage assistant, activity & notifications
     ===================================================================== */
  function staffName(email) { var s = S.staff.find(function (x) { return (x.email || '').toLowerCase() === String(email || '').toLowerCase(); }); return s ? (s.full_name || s.email.split('@')[0]) : (email ? String(email).split('@')[0] : '—'); }
  function roleLabelShort(r) { return { partner: 'Partner', attorney: 'Attorney', candidate_attorney: 'Candidate attorney', reception: 'Reception', bookkeeper: 'Bookkeeper' }[r] || r || ''; }
  var myEmail = function () { return ((S.user && S.user.email) || '').toLowerCase(); };
  function myTasks() { return S.tasks.filter(function (t) { return t.status === 'open' && (t.assigned_to || '').toLowerCase() === myEmail(); }); }

  /* ----- Tasks ----- */
  function taskList(ts, hideMatter) {
    ts = ts.slice().sort(function (a, b) { if (a.status !== b.status) return a.status === 'open' ? -1 : 1; return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1; });
    return '<div>' + (ts.map(function (t) { var m = byId(S.matters, t.matter_id); return '<div class="taskrow' + (t.status === 'done' ? ' done' : '') + '"><input type="checkbox" data-act="task-toggle" data-id="' + t.id + '"' + (t.status === 'done' ? ' checked' : '') + ' aria-label="Done"><div class="grow" style="flex:1;min-width:0"><a href="#" data-act="open-task" data-id="' + t.id + '"><b>' + esc(t.title) + '</b></a><div class="meta">' + [t.assigned_to ? 'For ' + esc(staffName(t.assigned_to)) : 'Unassigned', !hideMatter && m ? '<a href="#matter=' + m.id + '">' + esc(m.ref) + '</a>' : '', t.client_id && !m ? esc(clientName(t.client_id)) : '', t.priority === 'high' ? '<b style="color:var(--red)">High priority</b>' : ''].filter(Boolean).join(' · ') + '</div></div>' + (t.status === 'done' ? pill('Done ' + fmt(t.done_at), 'p-green') : t.due_date ? urg(daysLeft(t.due_date)) : pill('No date')) + '</div>'; }).join('') || empty('No tasks.')) + '</div>';
  }
  function editTask(t, preset) {
    var isNew = !t || !t.id;
    openForm({
      title: isNew ? 'New task' : 'Task',
      fields: [
        { k: 'title', label: 'What needs doing', req: true, full: true },
        { k: 'assigned_to', label: 'Assigned to', type: 'select', blank: 'Unassigned', options: S.staff.filter(function (s) { return s.active; }).map(function (s) { return [s.email, (s.full_name || s.email) + (s.email.toLowerCase() === myEmail() ? ' (me)' : '')]; }) },
        { k: 'due_date', label: 'Due', type: 'date' },
        { k: 'priority', label: 'Priority', type: 'select', options: [['normal', 'Normal'], ['high', 'High'], ['low', 'Low']] },
        { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
        { k: 'client_id', label: 'Client', type: 'select', blank: 'Not linked', options: S.clients.map(function (c) { return [c.id, c.name]; }) },
        { k: 'notes', label: 'Notes', type: 'textarea', full: true }
      ],
      values: t || Object.assign({ assigned_to: S.user && S.user.email, priority: 'normal', due_date: ymd(addDays(today(), 1)) }, preset || {}),
      save: async function (d) {
        if (d.matter_id && !d.client_id) d.client_id = (byId(S.matters, d.matter_id) || {}).client_id || null;
        var r = isNew ? await sb.from('tasks').insert(d).select().single() : await sb.from('tasks').update(d).eq('id', t.id).select().single();
        if (r.error) return dbErr(r);
        upsertLocal(S.tasks, r.data); toast(isNew ? 'Task added' + (d.assigned_to && d.assigned_to.toLowerCase() !== myEmail() ? ' for ' + staffName(d.assigned_to) : '') : 'Task saved'); render();
      },
      del: isNew ? null : async function () { var r = await sb.from('tasks').delete().eq('id', t.id); if (r.error) return dbErr(r); S.tasks = S.tasks.filter(function (x) { return x.id !== t.id; }); toast('Task deleted'); render(); }
    });
  }
  P2['new-task'] = function (el) { var m = el.dataset.matter && byId(S.matters, el.dataset.matter); editTask(null, m ? { matter_id: m.id, client_id: m.client_id, assigned_to: m.assigned_email || (S.user && S.user.email) } : el.dataset.client ? { client_id: el.dataset.client } : null); };
  P2['open-task'] = function (el) { editTask(byId(S.tasks, el.dataset.id)); };
  P2['task-toggle'] = async function (el) {
    var t = byId(S.tasks, el.dataset.id), done = t.status !== 'done';
    var r = await sb.from('tasks').update({ status: done ? 'done' : 'open', done_at: done ? new Date().toISOString() : null }).eq('id', t.id).select().single();
    if (r.error) { toast(r.error.message); return; }
    upsertLocal(S.tasks, r.data); toast(done ? 'Done' : 'Reopened'); render();
  };

  /* ----- My work ----- */
  V.mywork = function () {
    var me = myEmail(), tab = S.ui.mwTab || 'My tasks';
    var mine = myTasks(), mineM = S.matters.filter(function (m) { return (m.assigned_email || '').toLowerCase() === me && m.stage !== 'Closed'; });
    var mineMids = mineM.map(function (m) { return m.id; });
    var ag = agenda().filter(function (d) { return d.left >= -30 && d.left <= 14 && (d.matter && mineMids.indexOf(d.matter) >= 0); });
    var tabs = '<div class="subtabs">' + ['My tasks', 'My matters', 'Tasks I gave others', 'Everyone’s tasks'].map(function (x) { return '<button data-mwtab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    var body;
    if (tab === 'My tasks') body = '<div class="grid g21"><div class="panel"><div class="hd"><h2>My open tasks</h2><button class="btn pri" data-act="new-task">New task</button></div>' + taskList(mine) + '</div><div class="panel"><div class="hd"><h2>Coming up on my matters</h2></div><div class="list">' + (ag.map(function (d) { return '<div class="row">' + dateBox(d.date) + '<div class="grow"><b>' + esc(d.what) + '</b><div class="meta">' + [d.kind, d.ref].filter(Boolean).map(esc).join(' · ') + '</div></div>' + urg(d.left) + '</div>'; }).join('') || empty('Nothing in the next two weeks.')) + '</div></div></div>' +
      '<div class="panel"><div class="hd"><h2>Recently completed</h2></div>' + taskList(S.tasks.filter(function (t) { return t.status === 'done' && (t.assigned_to || '').toLowerCase() === me; }).slice(-10)) + '</div>';
    else if (tab === 'My matters') body = '<div class="panel"><div class="tbl"><table><tr><th>Matter</th><th>Client</th><th>Stage</th><th>Next step</th><th>Open tasks</th></tr>' + (mineM.map(function (m) { return '<tr class="click" data-matter="' + m.id + '"><td><span class="mono">' + esc(m.ref) + '</span><br><b>' + esc(m.title) + '</b></td><td>' + esc(clientName(m.client_id)) + '</td><td>' + stagePill(m.stage) + '</td><td>' + (m.next_date ? esc(m.next_step || '') + '<br><span class="mono">' + fmt(m.next_date) + '</span>' : '—') + '</td><td class="mono">' + S.tasks.filter(function (t) { return t.matter_id === m.id && t.status === 'open'; }).length + '</td></tr>'; }).join('') || '<tr><td colspan="5">' + empty('No matters are assigned to you. Choose the responsible attorney when you edit a matter.') + '</td></tr>') + '</table></div></div>';
    else if (tab === 'Tasks I gave others') body = '<div class="panel">' + taskList(S.tasks.filter(function (t) { return (t.created_by || '').toLowerCase() === me && (t.assigned_to || '').toLowerCase() !== me; })) + '</div>';
    else { var who = S.ui.mwWho || ''; body = '<div class="panel"><div class="hd"><h2>All open tasks</h2><select id="mw-who" style="max-width:240px"><option value="">Everyone</option>' + S.staff.map(function (s) { return '<option value="' + esc(s.email) + '"' + (s.email === who ? ' selected' : '') + '>' + esc(s.full_name || s.email) + '</option>'; }).join('') + '</select></div>' + taskList(S.tasks.filter(function (t) { return t.status === 'open' && (!who || t.assigned_to === who); })) + '</div>'; }
    return head('My work', 'Hello' + (S.me && S.me.full_name ? ', ' + esc(S.me.full_name.split(' ')[0]) : ''), 'Your tasks, your matters and what is coming up on them.', '<button class="btn pri" data-act="new-task">New task</button>') +
      (function () { var dueNow = S.tasks.filter(function (t) { return (t.assigned_to || '').toLowerCase() === me && t.due_date && daysLeft(t.due_date) <= 0; }); var doneToday = dueNow.filter(function (t) { return t.status === 'done' && t.done_at && ymd(t.done_at) === ymd(today()); }); var openNow = dueNow.filter(function (t) { return t.status === 'open'; }); var tot = doneToday.length + openNow.length; var pct = tot ? doneToday.length / tot : 0; return '<div class="panel" style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">' + ring(pct, Math.round(pct * 100) + '%', 'done') + '<div><div style="font-size:26px;font-weight:800;letter-spacing:-.5px">' + doneToday.length + ' of ' + tot + '</div><div class="meta">' + (tot ? (openNow.length ? openNow.length + ' task' + (openNow.length > 1 ? 's' : '') + ' still open for today' : 'Everything due today is done') : 'Nothing due today') + '</div></div></div>'; })() +
      '<div class="grid g4"><div class="panel stat"><b style="color:var(--red)">' + mine.filter(function (t) { return t.due_date && daysLeft(t.due_date) < 0; }).length + '</b><span>My overdue tasks</span></div><div class="panel stat"><b>' + mine.filter(function (t) { return t.due_date && daysLeft(t.due_date) === 0; }).length + '</b><span>Due today</span></div><div class="panel stat"><b>' + mine.length + '</b><span>My open tasks</span></div><div class="panel stat"><b>' + mineM.length + '</b><span>My open matters</span></div></div>' + tabs + body;
  };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-mwtab]'); if (!b) return; S.ui.mwTab = b.dataset.mwtab; render(); });
  document.addEventListener('change', function (e) { if (e.target.id === 'mw-who') { S.ui.mwWho = e.target.value; render(); } });

  /* ----- Activity history ----- */
  var ENTITY_LINK = function (a) { return a.matter_id ? '#matter=' + a.matter_id : a.client_id ? '#client=' + a.client_id : a.entity === 'leads' ? '#inbox' : a.entity === 'tasks' ? '#mywork' : a.entity === 'appointments' ? '#appointments' : a.entity === 'payments' ? '#payments' : a.entity === 'invoices' ? '#quotes' : '#dashboard'; };
  function actorLabel(a) { return !a.actor || a.actor === 'Website' ? 'Website' : a.actor.toLowerCase() === myEmail() ? 'You' : staffName(a.actor); }
  function historyList(acts, kind, id) {
    var more = '';
    if (acts.length >= 0 && S.histLoaded !== kind + id) { S.histLoaded = kind + id; sb.from('activity').select('*').eq(kind === 'matter' ? 'matter_id' : 'client_id', id).order('id', { ascending: false }).limit(200).then(function (r) { if (r.error) return; r.data.forEach(function (x) { if (!S.activity.some(function (y) { return y.id === x.id; })) S.activity.push(x); }); S.activity.sort(function (a, b) { return b.id - a.id; }); render(); }); }
    return '<div class="tl">' + (acts.map(function (a) { return '<div class="it"><span class="mono">' + fmtDT(a.at) + '</span><div>' + esc(a.summary) + '<div class="meta">' + esc(actorLabel(a)) + '</div></div></div>'; }).join('') || empty('No history yet. Changes are recorded from now on.')) + '</div>' + more;
  }

  /* ----- Client page ----- */
  function clientPage(c) {
    var tab = S.ui.cTab || 'Timeline';
    var ms = S.matters.filter(function (m) { return m.client_id === c.id; });
    var mids = ms.map(function (m) { return m.id; });
    var inv = S.invoices.filter(function (i) { return i.client_id === c.id; }), pays = S.payments.filter(function (p) { return p.client_id === c.id; });
    var owed = inv.reduce(function (s, i) { var st = invState(i); return s + (['sent', 'part', 'overdue'].indexOf(st.key) >= 0 ? st.bal : 0); }, 0);
    var trust = pays.filter(function (p) { return p.account === 'trust'; }).reduce(function (s, p) { return s + Number(p.amount); }, 0);
    var leads = S.leads.filter(function (l) { return l.client_id === c.id; });
    var appts = S.appts.filter(function (a) { return a.client_id === c.id || mids.indexOf(a.matter_id) >= 0; });
    var hs = S.hearings.filter(function (h) { return h.client_id === c.id || mids.indexOf(h.matter_id) >= 0; });
    var docs = S.docs.filter(function (d) { return d.client_id === c.id || mids.indexOf(d.matter_id) >= 0; });
    var ts = S.tasks.filter(function (t) { return t.client_id === c.id || mids.indexOf(t.matter_id) >= 0; });
    var tabs = ['Timeline', 'Matters', 'Money', 'Documents', 'Appointments & hearings', 'Tasks', 'Emails', 'POPIA'];
    var body = '';
    if (tab === 'Timeline') {
      var items = [];
      leads.forEach(function (l) { items.push([l.created_at, 'Enquiry: ' + (l.service || l.subject || FORMS[l.form] || ''), l.source || '', '#inbox']); });
      ms.forEach(function (m) { items.push([m.created_at, 'Matter opened: ' + m.ref + ' ' + m.title, m.stage, '#matter=' + m.id]); });
      appts.forEach(function (a) { items.push([a.starts_at, a.title, kindLabel(a.kind) + ' · ' + a.status, '#appointments']); });
      hs.forEach(function (h) { if (h.starts_at) items.push([h.starts_at, 'Hearing: ' + h.employee_name, lbl(HSTATUS, h.status), '#hearings']); });
      inv.forEach(function (i) { items.push([i.issue_date, 'Invoice ' + i.number + ': ' + R2(invTotal(i)), invState(i).label, '#quotes']); });
      pays.forEach(function (p) { items.push([p.received_on, 'Payment received: ' + R2(p.amount), p.account === 'trust' ? 'Trust' : 'Fees', '#payments']); });
      docs.forEach(function (d) { items.push([d.created_at, 'Document: ' + d.name, d.folder, '#documents']); });
      (S.clientNotes && S.clientNotes[c.id] || []).forEach(function (n) { items.push([n.created_at, 'File note: ' + n.body.slice(0, 160), (byId(S.matters, n.matter_id) || {}).ref || '', '#matter=' + n.matter_id]); });
      if (!S.clientNotes || !S.clientNotes[c.id]) { S.clientNotes = S.clientNotes || {}; S.clientNotes[c.id] = []; if (mids.length) sb.from('matter_notes').select('*').in('matter_id', mids).order('created_at', { ascending: false }).limit(100).then(function (r) { if (!r.error) { S.clientNotes[c.id] = r.data; if (location.hash === '#client=' + c.id) render(); } }); }
      items.sort(function (a, b) { return D(b[0]) - D(a[0]); });
      body = '<div class="tl">' + (items.map(function (x) { return '<div class="it"><span class="mono">' + fmt(x[0]) + '</span><div><a href="' + x[3] + '">' + esc(x[1]) + '</a>' + (x[2] ? '<div class="meta">' + esc(x[2]) + '</div>' : '') + '</div></div>'; }).join('') || empty('Nothing recorded for this client yet.')) + '</div>' +
        '<h3 style="margin:18px 0 6px">Change history</h3>' + historyList(S.activity.filter(function (a) { return a.client_id === c.id; }).slice(0, 30), 'client', c.id);
    }
    if (tab === 'Matters') body = '<div style="margin-bottom:10px"><button class="btn pri" data-act="new-matter" data-client="' + c.id + '">New matter</button></div><div class="tbl"><table><tr><th>Matter</th><th>Type</th><th>Stage</th><th>Next step</th><th>Attorney</th></tr>' + (ms.map(function (m) { return '<tr class="click" data-matter="' + m.id + '"><td><span class="mono">' + esc(m.ref) + '</span><br><b>' + esc(m.title) + '</b></td><td>' + esc(m.dispute_type || '') + '</td><td>' + stagePill(m.stage) + '</td><td>' + (m.next_date ? esc(m.next_step || '') + ' · ' + fmt(m.next_date) : '—') + '</td><td>' + esc(m.assigned_email ? staffName(m.assigned_email) : m.attorney || '—') + '</td></tr>'; }).join('') || '<tr><td colspan="5">' + empty('No matters yet.') + '</td></tr>') + '</table></div>';
    if (tab === 'Money') body = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn pri" data-act="new-invoice" data-client="' + c.id + '">New invoice</button><button class="btn" data-act="new-quote" data-client="' + c.id + '">New quote</button><button class="btn" data-act="new-payment-client" data-client="' + c.id + '">Record payment</button><button class="btn" data-act="new-retainer" data-client="' + c.id + '">Set up retainer</button>' + (trustClients().indexOf(c.id) >= 0 ? '<button class="btn" data-act="trust-statement" data-client="' + c.id + '">Trust statement</button>' : '') + (trustBal(c.id) > 0 ? '<button class="btn" data-act="trust-transfer" data-client="' + c.id + '">Transfer trust to fees</button>' : '') + '</div>' +
      '<div class="tbl"><table><tr><th>Date</th><th>Item</th><th style="text-align:right">Amount</th><th>Status</th></tr>' +
      S.quotes.filter(function (q) { return q.client_id === c.id; }).map(function (q) { return '<tr class="click" data-act="open-doc" data-kind="quote" data-id="' + q.id + '"><td class="mono">' + fmt(q.issue_date) + '</td><td>Quote ' + esc(q.number) + '</td><td class="mono" style="text-align:right">' + R2(totals(itemsOf('quote', q.id), q.vat_rate).total) + '</td><td>' + quotePill(q.status) + '</td></tr>'; }).join('') +
      inv.map(function (i) { var st = invState(i); return '<tr class="click" data-act="open-doc" data-kind="invoice" data-id="' + i.id + '"><td class="mono">' + fmt(i.issue_date) + '</td><td>Invoice ' + esc(i.number) + '</td><td class="mono" style="text-align:right">' + R2(invTotal(i)) + '</td><td>' + pill(st.label, st.cls) + '</td></tr>'; }).join('') +
      pays.map(function (p) { return '<tr class="click" data-act="open-payment" data-id="' + p.id + '"><td class="mono">' + fmt(p.received_on) + '</td><td>Payment (' + (p.account === 'trust' ? 'trust' : 'fees') + ')</td><td class="mono" style="text-align:right">' + R2(p.amount) + '</td><td>' + pill('Received', 'p-green') + '</td></tr>'; }).join('') + '</table></div>';
    if (tab === 'Documents') body = '<div style="margin-bottom:10px"><button class="btn pri" data-act="upload" data-client="' + c.id + '">Upload files</button></div>' + docTable(docs);
    if (tab === 'Appointments & hearings') body = '<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn pri" data-act="new-appt-client" data-client="' + c.id + '">New appointment</button></div><div class="list">' + (appts.slice().sort(function (a, b) { return D(b.starts_at) - D(a.starts_at); }).map(function (a) { return '<div class="row" style="align-items:center">' + dateBox(a.starts_at) + '<div class="grow"><b>' + esc(a.title) + '</b><div class="meta">' + fmtT(a.starts_at) + ' · ' + kindLabel(a.kind) + (a.location ? ' · ' + esc(a.location) : '') + '</div></div>' + pill(a.status) + '<button class="btn sm" data-appt="' + a.id + '">Open</button></div>'; }).join('') || empty('No appointments.')) + '</div>' + (hs.length ? '<h3 style="margin:16px 0 6px">Hearings</h3>' + hearingRows(hs) : '');
    if (tab === 'Tasks') body = '<div style="margin-bottom:10px"><button class="btn pri" data-act="new-task" data-client="' + c.id + '">New task</button></div>' + taskList(ts);
    if (tab === 'Emails') body = clientEmails(c);
    if (tab === 'POPIA') body = clientPopia(c);
    return '<div><a href="#clients">← All clients</a></div>' + head({ individual: 'Individual', employer: 'Employer', union: 'Trade union' }[c.kind] + (c.id_or_reg_no ? ' · ' + esc(c.id_or_reg_no) : ''), esc(c.name), [c.contact_person, c.phone, c.email, c.address].filter(Boolean).map(esc).join(' · '), '<button class="btn pri" data-act="edit-client" data-id="' + c.id + '">Edit client</button>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + phoneLinks(c.phone, c.email) + pill('FICA: ' + { done: 'done', partial: 'partial', outstanding: 'outstanding' }[c.fica_status], c.fica_status === 'done' ? 'p-green' : 'p-amber') + pill(c.popia_consent ? 'POPIA signed' : 'POPIA outstanding', c.popia_consent ? 'p-green' : 'p-red') + (c.fee_plan ? pill(c.fee_plan) : '') + '</div>' +
      '<div class="grid g4"><div class="panel stat"><b>' + ms.filter(function (m) { return m.stage !== 'Closed'; }).length + '</b><span>Open matters (' + ms.length + ' in total)</span></div><div class="panel stat"><b' + (owed ? ' style="color:var(--red)"' : '') + '>' + R2(owed) + '</b><span>Owed</span></div><div class="panel stat"><b>' + R2(trustBal(c.id)) + '</b><span>Held in trust</span></div><div class="panel stat"><b>' + ts.filter(function (t) { return t.status === 'open'; }).length + '</b><span>Open tasks</span></div></div>' +
      conflictPanel(c.name, { client: c.id, lead: c.lead_id }) + (c.anonymised_at ? '' : onboardPanel(c)) +
      '<div class="panel"><div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button role="tab" class="' + (x === tab ? 'on' : '') + '" data-ctab="' + x + '">' + x + '</button>'; }).join('') + '</div><div style="padding-top:14px">' + body + '</div></div>';
  }
  function clientEmails(c) {
    if (!c.email) return '<p class="meta">Add an email address to this client to find their emails.</p>';
    if (S.mail.state === 'unconfigured') return '<p class="meta">Connect the info@ mailbox (Company settings → Email) to see this client’s emails here.</p>';
    var cache = S.mailSearch = S.mailSearch || {}, key = 'c:' + c.id, x = cache[key];
    if (!x) { cache[key] = { loading: true }; api('/api/mail?action=search&q=' + encodeURIComponent(c.email)).then(function (j) { cache[key] = j.configured === false ? { error: 'unconfigured' } : j.error ? { error: j.error } : { list: j.messages || [] }; if (location.hash === '#client=' + c.id) render(); }); return '<p class="meta">Searching the mailbox…</p>'; }
    if (x.loading) return '<p class="meta">Searching the mailbox…</p>';
    if (x.error) return x.error === 'unconfigured' ? '<p class="meta">Connect the info@ mailbox to see this client’s emails here.</p>' : '<div class="callout p-red">' + esc(x.error) + '</div>';
    return '<div class="list">' + (x.list.map(function (e) { return '<button class="row" data-act="matter-mail-open" data-uid="' + e.uid + '" style="border:0;border-bottom:1px solid var(--line);background:none;text-align:left;cursor:pointer;width:100%"><div class="grow"><b>' + esc(e.subject) + '</b><div class="meta">' + esc(who(e.from)) + ' · ' + fmtDT(e.date) + '</div></div></button>'; }).join('') || empty('No emails from or mentioning ' + esc(c.email) + '.')) + '</div>';
  }
  P2['edit-client'] = function (el) { editClient(byId(S.clients, el.dataset.id)); };
  P2['new-payment-client'] = function (el) { editPayment(null, { client_id: el.dataset.client }); };
  P2['new-appt-client'] = function (el) { editAppt(null, { client_id: el.dataset.client }); };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-ctab]'); if (!b) return; S.ui.cTab = b.dataset.ctab; render(); });

  /* ----- Stage assistant: proposes the next time limit, dates and tasks ----- */
  var STAGE_HELP = {
    'Referred': { intro: 'The dispute has been referred. The CCMA or council must try to resolve it within 30 days.', fields: [{ k: 'sa_date', label: 'Date the referral was served / filed', type: 'date', def: function () { return ymd(today()); } }, { k: 'sa_next', label: 'Conciliation set-down date (if known)', type: 'date' }],
      tasks: [['Keep proof of service of the referral on file', 2], ['Diarise the conciliation and confirm the date with the client', 5]],
      apply: function (v) { var p = { key_rule: 'con', key_date: v.sa_date }; if (v.sa_next) { p.next_step = 'Conciliation'; p.next_date = v.sa_next; } return p; } },
    'Conciliation': { intro: 'Conciliation is set down. Prepare the client and get a settlement mandate.', fields: [{ k: 'sa_next', label: 'Conciliation date', type: 'date', def: function (m) { return m.next_date || ''; } }],
      tasks: [['Get a written settlement mandate from the client', -2, 'sa_next'], ['Prepare settlement figures and documents for conciliation', -3, 'sa_next']],
      apply: function (v) { return v.sa_next ? { next_step: 'Conciliation', next_date: v.sa_next } : {}; } },
    'Arbitration': { intro: 'Conciliation failed. The 90-day clock to request arbitration or refer to the Labour Court runs from the certificate of outcome.', fields: [{ k: 'sa_date', label: 'Date of the certificate of outcome', type: 'date', def: function () { return ymd(today()); } }, { k: 'sa_next', label: 'Arbitration date (if known)', type: 'date' }],
      tasks: [['File LRA Form 7.13 (request for arbitration) or refer to the Labour Court', 14], ['Decide on legal representation (CCMA Rule 25) and apply if needed', 21], ['Prepare and paginate the bundle of documents', 30]],
      apply: function (v) { var p = { key_rule: 'arb', key_date: v.sa_date }; if (v.sa_next) { p.next_step = 'Arbitration hearing'; p.next_date = v.sa_next; } return p; } },
    'Award': { intro: 'The award has been issued. A review must be filed within 6 weeks of receiving it.', fields: [{ k: 'sa_date', label: 'Date the award was received', type: 'date', def: function () { return ymd(today()); } }, { k: 'sa_default', label: 'The award was made in the client’s absence (default award)', type: 'checkbox' }],
      tasks: [['Send the award to the client with advice on review or compliance', 3], ['Diarise compliance with the award (or enforcement)', 14]],
      apply: function (v, m) { return { key_rule: 'rev', key_date: v.sa_date, next_step: 'Decide on review or enforcement', next_date: ymd(addDays(D(v.sa_date), 21)) }; },
      extra: async function (v, m) { if (v.sa_default) { var r = await sb.from('deadlines').insert({ matter_id: m.id, title: 'Apply to rescind the default award (CCMA Rule 32, 14 days)', due_date: ymd(addDays(D(v.sa_date), 14)) }).select().single(); if (!r.error) S.deadlines.push(r.data); } } },
    'Review / enforce': { intro: 'Review or enforcement. Check the security and record requirements.', fields: [],
      tasks: [['File the review application (notice of motion and founding affidavit)', 7], ['Request the record of the arbitration (Rule 7A)', 7], ['Lodge security for the award (s145(7)) if the employer is reviewing', 7]],
      apply: function () { return {}; } }
  };
  function stageAssistant(m, stage) {
    var setStage = async function (patch) {
      var r = await sb.from('matters').update(Object.assign({ stage: stage }, patch || {})).eq('id', m.id).select().single();
      if (r.error) return dbErr(r);
      upsertLocal(S.matters, r.data); await syncMatterNext(r.data); return r.data;
    };
    if (stage === 'Closed') { setStage().then(function (u) { if (u && u.id) { toast('Stage: Closed'); render(); closeMatterChecklist(u); } }); return; }
    var h = STAGE_HELP[stage];
    if (!h) { setStage().then(function (u) { if (u && u.id) { toast('Stage: ' + stage); render(); } }); return; }
    var vals = {}; h.fields.forEach(function (f) { if (f.def) vals[f.k] = f.def(m); });
    var who = m.assigned_email || (S.user && S.user.email);
    openForm({
      title: m.ref + ' → ' + stage, saveLabel: 'Move and set up', fields: h.fields, values: vals,
      extra: '<div class="fld full"><p class="sub" style="margin:0">' + esc(h.intro) + '</p></div>' +
        (h.tasks.length ? '<div class="fld full"><span class="lbl">Create these tasks for ' + esc(staffName(who)) + '</span>' + h.tasks.map(function (t, i) { return '<label class="check" style="font-weight:400"><input type="checkbox" class="sa-task" data-i="' + i + '" checked> ' + esc(t[0]) + '</label>'; }).join('') + '</div>' : '') +
        '<div class="fld full"><button type="button" class="btn sm" id="sa-skip">Just change the stage</button></div>',
      save: async function (d) {
        var patch = h.apply(d, m) || {};
        var u = await setStage(patch); if (typeof u === 'string') return u;
        var base = D(d.sa_date || ymd(today()));
        var rows = Array.prototype.filter.call(document.querySelectorAll('.sa-task'), function (c) { return c.checked; }).map(function (c) { var t = h.tasks[+c.dataset.i]; var from = t[2] && d[t[2]] ? D(d[t[2]]) : base; return { title: t[0], due_date: ymd(addDays(from, t[1])), assigned_to: who, matter_id: m.id, client_id: m.client_id }; });
        if (rows.length) { var tr = await sb.from('tasks').insert(rows).select(); if (!tr.error) S.tasks = S.tasks.concat(tr.data); }
        if (h.extra) await h.extra(d, m);
        toast(m.ref + ' moved to ' + stage + (rows.length ? ' · ' + rows.length + ' tasks added' : '')); render();
      }
    });
    $('sa-skip').onclick = async function () { var u = await setStage(); $('modal-root').innerHTML = ''; if (u && u.id) { toast('Stage: ' + stage); render(); } };
  }

  /* ----- Search everything ----- */
  function searchAll(q) {
    var n = q.toLowerCase().trim(); if (n.length < 2) return [];
    var has = function () { for (var i = 0; i < arguments.length; i++) if (arguments[i] && String(arguments[i]).toLowerCase().indexOf(n) >= 0) return true; return false; };
    var digits = n.replace(/\D/g, ''), phone = function (p) { return digits.length >= 6 && p && String(p).replace(/\D/g, '').indexOf(digits) >= 0; };
    var g = [];
    var push = function (grp, items) { if (items.length) g.push([grp, items.slice(0, 8)]); };
    push('Clients', S.clients.filter(function (c) { return has(c.name, c.contact_person, c.email, c.id_or_reg_no) || phone(c.phone); }).map(function (c) { return ['#client=' + c.id, c.name, [c.contact_person, c.phone, c.email].filter(Boolean).join(' · ')]; }));
    push('Matters', S.matters.filter(function (m) { return has(m.ref, m.title, m.case_no, m.other_party, m.dispute_type); }).map(function (m) { return ['#matter=' + m.id, m.ref + ' · ' + m.title, [m.case_no, m.stage, clientName(m.client_id)].filter(Boolean).join(' · ')]; }));
    push('Enquiries', S.leads.filter(function (l) { return has(leadName(l), l.email, l.subject, l.service, l.message) || phone(l.phone); }).map(function (l) { return ['lead:' + l.id, leadName(l), [FORMS[l.form], leadLabel(l.status), fmt(l.created_at)].join(' · ')]; }));
    push('Invoices & quotes', S.invoices.filter(function (i) { return has(i.number) || has(clientName(i.client_id)) && n.length > 3; }).map(function (i) { return ['doc:invoice:' + i.id, 'Invoice ' + i.number, clientName(i.client_id) + ' · ' + R2(invTotal(i)) + ' · ' + invState(i).label]; }).concat(S.quotes.filter(function (x) { return has(x.number); }).map(function (x) { return ['doc:quote:' + x.id, 'Quote ' + x.number, clientName(x.client_id)]; })));
    push('Hearings', S.hearings.filter(function (h) { return has(h.employee_name, h.charges); }).map(function (h) { return ['hearing:' + h.id, 'Hearing: ' + h.employee_name, clientName(h.client_id) + (h.starts_at ? ' · ' + fmt(h.starts_at) : '')]; }));
    push('Tasks', S.tasks.filter(function (t) { return has(t.title, t.notes); }).map(function (t) { return ['task:' + t.id, t.title, (t.assigned_to ? 'For ' + staffName(t.assigned_to) : '') + (t.due_date ? ' · due ' + fmt(t.due_date) : '') + (t.status === 'done' ? ' · done' : '')]; }));
    push('Documents', S.docs.filter(function (d) { return has(d.name, d.folder); }).map(function (d) { return ['docfile:' + d.id, d.name, d.folder + (d.client_id ? ' · ' + clientName(d.client_id) : '')]; }));
    push('Appointments', S.appts.filter(function (a) { return has(a.title, a.location); }).map(function (a) { return ['appt:' + a.id, a.title, fmtDT(a.starts_at)]; }));
    return g;
  }
  /* ----- Command palette (⌘K / Ctrl+K / "/") ----- */
  var PAL = { sel: 0, items: [] };
  function palItems(q) {
    var n = q.trim().toLowerCase(), out = [];
    var pages = NAV.filter(function (x) { return x.id; }).map(function (x) { return { go: '#' + x.id, t: x.label, s: { mywork: 'Your tasks and matters', dashboard: 'Practice, sales, website, finance', inbox: 'Website forms and email', appointments: 'Calendar and bookings', deadlines: 'Time limits and diary', pipeline: 'Enquiry to client', matters: 'Every case by stage', hearings: 'Disciplinary hearings', clients: 'Employers and individuals', quotes: 'Quotes, invoices, unbilled time', payments: 'Money in and owed', website: 'Visitors, sources, SEO', documents: 'Files and contract builder', compliance: 'Employer obligations', settings: 'Firm, banking, users, email' }[x.id] || '', ic: x.ic, grp: 'Go to' }; });
    if (!n) return pages.concat([{ go: 'act:new-lead', t: 'New enquiry', s: 'Phone, WhatsApp or walk-in', ic: 'plus', grp: 'Create' }, { go: 'act:new-matter', t: 'New matter', ic: 'brief', grp: 'Create' }, { go: 'act:new-task', t: 'New task', ic: 'task', grp: 'Create' }, { go: 'act:new-appt', t: 'New appointment', ic: 'cal', grp: 'Create' }, { go: 'act:new-invoice', t: 'New invoice', ic: 'doc', grp: 'Create' }]);
    pages.forEach(function (p) { if (p.t.toLowerCase().indexOf(n) >= 0 || p.s.toLowerCase().indexOf(n) >= 0) out.push(p); });
    var icFor = { Clients: 'users', Matters: 'brief', Enquiries: 'inbox', 'Invoices & quotes': 'doc', Hearings: 'gavel', Tasks: 'task', Documents: 'folder', Appointments: 'cal' };
    searchAll(q).forEach(function (g) { g[1].forEach(function (r) { out.push({ go: r[0], t: r[1], s: r[2], ic: icFor[g[0]] || 'arrow', grp: g[0] }); }); });
    if (S.mail.state === 'ok' && n.length >= 4) out.push({ go: 'mail:' + q.trim(), t: 'Search info@ for “' + q.trim() + '”', ic: 'inbox', grp: 'Email' });
    return out;
  }
  function drawPalette() {
    var q = $('pal-in').value, items = PAL.items = palItems(q), last = '';
    if (PAL.sel >= items.length) PAL.sel = Math.max(0, items.length - 1);
    $('pal-res').innerHTML = items.map(function (it, i) { var g = it.grp !== last ? '<div class="grp">' + esc(it.grp) + '</div>' : ''; last = it.grp; return g + '<button class="hit' + (i === PAL.sel ? ' sel' : '') + '" data-pi="' + i + '"><span class="ic">' + icon(it.ic, 16) + '</span><span style="min-width:0;flex:1"><b style="display:block">' + esc(it.t) + '</b>' + (it.s ? '<span class="meta" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(it.s) + '</span>' : '') + '</span><span class="go">' + icon('arrow', 16) + '</span></button>'; }).join('') || '<div class="empty">Nothing found for “' + esc(q) + '”.</div>';
    var s = $('pal-res').querySelector('.hit.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
  }
  function openPalette(prefill) {
    closePop();
    var root = document.createElement('div'); root.id = 'palette'; root.className = 'palette-bg';
    root.innerHTML = '<div class="palette" role="dialog" aria-label="Search"><div class="pin"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--faint)"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="pal-in" placeholder="Search clients, matters, case numbers, invoices, tasks…" autocomplete="off"><kbd>esc</kbd></div><div class="pres" id="pal-res"></div><div class="pfoot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div></div>';
    document.body.appendChild(root);
    PAL.sel = 0; $('pal-in').value = prefill || ''; drawPalette(); $('pal-in').focus();
    $('pal-in').addEventListener('input', function () { PAL.sel = 0; drawPalette(); });
    root.addEventListener('mousedown', function (e) { if (e.target === root) closePalette(); });
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-pi]'); if (b) runPal(+b.dataset.pi); });
    root.addEventListener('mousemove', function (e) { var b = e.target.closest('[data-pi]'); if (b && +b.dataset.pi !== PAL.sel) { PAL.sel = +b.dataset.pi; root.querySelectorAll('.hit').forEach(function (h) { h.classList.toggle('sel', +h.dataset.pi === PAL.sel); }); } });
  }
  function closePalette() { var p = $('palette'); if (p) p.remove(); }
  function runPal(i) { var it = PAL.items[i]; if (!it) return; closePalette(); if (it.go.indexOf('act:') === 0) { var fake = document.createElement('button'); fake.dataset.act = it.go.slice(4); document.body.appendChild(fake); fake.click(); fake.remove(); return; } go(it.go); }
  function closePop() { var p = $('pop'); if (p) p.remove(); }
  async function go(target) {
    closePop();
    var p = target.split(':');
    if (target[0] === '#') { location.hash = target.slice(1); return; }
    if (p[0] === 'lead') { var l = byId(S.leads, p[1]); S.ui.inboxSel = l.id; S.ui.inboxTab = 'All'; location.hash = 'inbox'; render(); return; }
    if (p[0] === 'doc') return editDoc(p[1], byId(S[p[1] === 'quote' ? 'quotes' : 'invoices'], p[2]));
    if (p[0] === 'hearing') return editHearing(byId(S.hearings, p[1]));
    if (p[0] === 'task') return editTask(byId(S.tasks, p[1]));
    if (p[0] === 'appt') return editAppt(byId(S.appts, p[1]));
    if (p[0] === 'docfile') return P2['doc-open']({ dataset: { id: p[1] } });
    if (p[0] === 'mail') { var q = target.slice(5); var j = await api('/api/mail?action=search&q=' + encodeURIComponent(q)); S.ui.inboxTab = 'Email (info@)'; S.mail.list = j.messages || S.mail.list; location.hash = 'inbox'; render(); toast((j.messages || []).length + ' emails found for “' + q + '”'); }
  }
  document.addEventListener('keydown', function (e) {
    var pal = $('palette');
    if (pal) {
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); PAL.sel = Math.max(0, Math.min(PAL.items.length - 1, PAL.sel + (e.key === 'ArrowDown' ? 1 : -1))); drawPalette(); }
      else if (e.key === 'Enter') { e.preventDefault(); runPal(PAL.sel); }
      return;
    }
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (S.user) openPalette(); return; }
    if (e.key === '/' && S.user && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('mform')) { e.preventDefault(); openPalette(); }
    if (e.key === 'Escape' && $('pop')) closePop();
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) { go(b.dataset.go); return; } if ($('pop') && !e.target.closest('#pop') && !e.target.closest('#bell,#btn-new,#avatar-btn,#me-card,.it-name')) closePop(); });

  /* =====================================================================
     PHASE 5: trust ledger, retainers, email attachments, hearing clock,
     compliance quotes, monthly report, two-step sign-in
     ===================================================================== */

  /* ----- Trust ledger (Legal Practice Act s86) ----- */
  var TKIND = { transfer_to_fees: 'Transfer to fees', refund: 'Refund to client', payment_out: 'Payment on the client’s behalf' };
  function trustIn(cid) { return round2(S.payments.filter(function (p) { return p.client_id === cid && p.account === 'trust'; }).reduce(function (s, p) { return s + Number(p.amount); }, 0)); }
  function trustOut(cid) { return round2(S.trust.filter(function (e) { return e.client_id === cid; }).reduce(function (s, e) { return s + Number(e.amount); }, 0)); }
  function trustBal(cid) { return round2(trustIn(cid) - trustOut(cid)); }
  function trustRows(cid) {
    var rows = S.payments.filter(function (p) { return p.account === 'trust' && (!cid || p.client_id === cid); }).map(function (p) {
      return { date: p.received_on, at: p.created_at || '', cid: p.client_id, desc: 'Deposit' + (p.method ? ' (' + p.method + ')' : '') + (p.reference ? ' · ' + p.reference : ''), inAmt: Number(p.amount), out: 0, pay: p };
    }).concat(S.trust.filter(function (e) { return !cid || e.client_id === cid; }).map(function (e) {
      var inv = byId(S.invoices, e.invoice_id);
      return { date: e.entry_date, at: e.created_at || '', cid: e.client_id, desc: TKIND[e.kind] + (inv ? ' · invoice ' + inv.number : '') + (e.paid_to ? ' · to ' + e.paid_to : '') + (e.reference && !inv ? ' · ' + e.reference : ''), inAmt: 0, out: Number(e.amount), entry: e };
    }));
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at < b.at ? -1 : 1); });
    var bal = 0; rows.forEach(function (r) { bal = round2(bal + r.inAmt - r.out); r.bal = bal; });
    return rows;
  }
  function trustClients() {
    var ids = []; S.payments.forEach(function (p) { if (p.account === 'trust' && ids.indexOf(p.client_id) < 0) ids.push(p.client_id); });
    S.trust.forEach(function (e) { if (ids.indexOf(e.client_id) < 0) ids.push(e.client_id); });
    return ids.filter(Boolean);
  }
  async function refreshMoney() {
    var r = await Promise.all([sb.from('payments').select('*').order('received_on', { ascending: false }), sb.from('trust_entries').select('*').order('entry_date', { ascending: false }), sb.from('invoices').select('*').order('created_at', { ascending: false }), sb.from('line_items').select('*').order('sort')]);
    if (!r[0].error) S.payments = r[0].data; if (!r[1].error) S.trust = r[1].data; if (!r[2].error) S.invoices = r[2].data; if (!r[3].error) S.items = r[3].data;
  }
  function trustLedger() {
    var ids = trustClients(), ms = new Date(today().getFullYear(), today().getMonth(), 1);
    var total = ids.reduce(function (s, id) { return s + trustBal(id); }, 0);
    var inMonth = S.payments.filter(function (p) { return p.account === 'trust' && D(p.received_on) >= ms; }).reduce(function (s, p) { return s + Number(p.amount); }, 0);
    var outMonth = S.trust.filter(function (e) { return D(e.entry_date) >= ms; }).reduce(function (s, e) { return s + Number(e.amount); }, 0);
    var st = S.settings || {};
    var moves = trustRows(null).slice(-40).reverse();
    return (st.trust_account ? '' : '<div class="callout p-amber">Your trust bank account is not set, so statements leave it out. <a href="#settings">Add it in Company settings</a>.</div>') +
      '<div class="grid g4"><div class="panel stat"><b>' + R2(total) + '</b><span>Held in trust</span></div><div class="panel stat"><b>' + ids.filter(function (id) { return trustBal(id) > 0; }).length + '</b><span>Clients with money in trust</span></div><div class="panel stat"><b>' + R2(inMonth) + '</b><span>Received into trust this month</span></div><div class="panel stat"><b>' + R2(outMonth) + '</b><span>Paid out of trust this month</span></div></div>' +
      '<div class="panel"><div class="hd"><h2>Balance per client</h2><span class="meta">A client’s balance can never go below zero: the CRM refuses a payment out that is bigger than what is held.</span></div><div class="tbl"><table><tr><th>Client</th><th style="text-align:right">Received</th><th style="text-align:right">Paid out</th><th style="text-align:right">Balance</th><th></th></tr>' +
      (ids.map(function (id) { var b = trustBal(id); return '<tr><td><a href="#client=' + id + '"><b>' + esc(clientName(id)) + '</b></a></td><td class="mono" style="text-align:right">' + R2(trustIn(id)) + '</td><td class="mono" style="text-align:right">' + R2(trustOut(id)) + '</td><td class="mono" style="text-align:right"><b>' + R2(b) + '</b></td><td style="text-align:right;white-space:nowrap"><button class="btn sm" data-act="trust-statement" data-client="' + id + '">Statement</button> ' + (b > 0 ? '<button class="btn sm" data-act="trust-transfer" data-client="' + id + '">Transfer to fees</button> <button class="btn sm" data-act="trust-out" data-client="' + id + '">Pay out</button>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="5">' + empty('No trust money recorded yet. Record a payment and choose “Trust account”.') + '</td></tr>') + '</table></div></div>' +
      '<div class="panel"><div class="hd"><h2>Recent trust movements</h2></div><div class="tbl"><table><tr><th>Date</th><th>Client</th><th>Movement</th><th style="text-align:right">In</th><th style="text-align:right">Out</th><th></th></tr>' +
      (moves.map(function (m) { return '<tr><td class="mono">' + fmt(m.date) + '</td><td>' + esc(clientName(m.cid)) + '</td><td>' + esc(m.desc) + '</td><td class="mono" style="text-align:right">' + (m.inAmt ? R2(m.inAmt) : '') + '</td><td class="mono" style="text-align:right">' + (m.out ? R2(m.out) : '') + '</td><td style="text-align:right">' + (m.entry ? '<button class="btn sm" data-act="trust-reverse" data-id="' + m.entry.id + '">Reverse</button>' : '<button class="btn sm" data-act="open-payment" data-id="' + m.pay.id + '">Open</button>') + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('Nothing yet.') + '</td></tr>') + '</table></div></div>';
  }
  var _payBase = V.payments;
  V.payments = function () {
    var tab = S.ui.payTab || 'Received & owed';
    var tabs = '<div class="subtabs">' + ['Received & owed', 'Trust ledger'].map(function (x) { return '<button data-paytab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    if (tab === 'Trust ledger') return head('Payments', 'Trust ledger', 'Money held for clients, kept apart from fees as the Legal Practice Act (s86) requires. Deposits come from payments marked “Trust account”; transfers to fees settle invoices.', '<button class="btn pri" data-act="trust-deposit">Record trust deposit</button><button class="btn" data-act="trust-transfer">Transfer to fees</button><button class="btn" data-act="trust-out">Pay out</button>') + tabs + trustLedger();
    var base = _payBase(), i = base.indexOf('<div class="grid g4">');
    return i < 0 ? base + tabs : base.slice(0, i) + tabs + base.slice(i);
  };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-paytab]'); if (!b) return; S.ui.payTab = b.dataset.paytab; render(); });
  P2['trust-deposit'] = function (el) { $('modal-root').innerHTML = ''; editPayment(null, { account: 'trust', client_id: el.dataset.client || '' }); };
  var _openPayment = P2['open-payment'];
  P2['open-payment'] = function (el) {
    var p = byId(S.payments, el.dataset.id);
    if (p && p.method === 'Trust transfer') { toast('This payment is a transfer from trust. To undo it, reverse it in the trust ledger.'); S.ui.payTab = 'Trust ledger'; location.hash = 'payments'; render(); return; }
    return _openPayment(el);
  };
  function openInvoicesOf(cid) { return S.invoices.filter(function (i) { var k = invState(i).key; return i.client_id === cid && k !== 'paid' && k !== 'cancelled' && k !== 'draft'; }); }
  P2['trust-transfer'] = function (el) {
    var withMoney = trustClients().filter(function (id) { return trustBal(id) > 0; });
    if (!withMoney.length) { toast('No client has money in trust yet.'); return; }
    var cid = el.dataset.client && withMoney.indexOf(el.dataset.client) >= 0 ? el.dataset.client : withMoney[0];
    openForm({
      title: 'Transfer from trust to fees', saveLabel: 'Transfer',
      fields: [
        { k: 'client_id', label: 'Client', type: 'select', req: true, options: withMoney.map(function (id) { return [id, clientName(id) + ' · ' + R2(trustBal(id)) + ' in trust']; }) },
        { k: 'invoice_id', label: 'Invoice it pays', type: 'select', req: true, blank: 'Choose an invoice', options: [] },
        { k: 'amount', label: 'Amount (R)', type: 'number', step: 0.01, req: true },
        { k: 'entry_date', label: 'Date', type: 'date', req: true },
        { k: 'notes', label: 'Notes', type: 'textarea', full: true }
      ],
      values: { client_id: cid, entry_date: ymd(today()) },
      extra: '<p class="meta full" id="tt-hint" style="margin:0"></p>',
      save: async function (d) {
        var inv = byId(S.invoices, d.invoice_id), bal = trustBal(d.client_id), ib = inv ? invState(inv).bal : 0;
        if (!(d.amount > 0)) return 'Enter an amount.';
        if (d.amount > bal + 0.001) return 'Only ' + R2(bal) + ' is held in trust for this client.';
        if (d.amount > ib + 0.001) return 'The invoice balance is only ' + R2(ib) + '.';
        var r = await sb.rpc('trust_transfer', { p_client: d.client_id, p_invoice: d.invoice_id, p_amount: d.amount, p_date: d.entry_date, p_notes: d.notes || null });
        if (r.error) return r.error.message;
        await refreshMoney(); toast(R2(d.amount) + ' transferred from trust to invoice ' + inv.number); render();
      }
    });
    var cs = $('m-client_id'), is = $('m-invoice_id'), am = $('m-amount');
    var fill = function () {
      var list = openInvoicesOf(cs.value);
      is.innerHTML = '<option value="">' + (list.length ? 'Choose an invoice' : 'No unpaid invoices for this client') + '</option>' + list.map(function (i) { return '<option value="' + i.id + '">' + esc(i.number + ' · balance ' + R2(invState(i).bal)) + '</option>'; }).join('');
      if (list.length === 1) is.value = list[0].id; pick();
    };
    var pick = function () { var inv = byId(S.invoices, is.value), b = trustBal(cs.value); if (inv) am.value = Math.min(b, invState(inv).bal).toFixed(2); $('tt-hint').textContent = 'Held in trust for this client: ' + R2(b) + '.'; };
    cs.addEventListener('change', fill); is.addEventListener('change', pick); fill();
  };
  P2['trust-out'] = function (el) {
    var withMoney = trustClients().filter(function (id) { return trustBal(id) > 0; });
    if (!withMoney.length) { toast('No client has money in trust yet.'); return; }
    var cid = el.dataset.client && withMoney.indexOf(el.dataset.client) >= 0 ? el.dataset.client : withMoney[0];
    openForm({
      title: 'Pay out of trust', saveLabel: 'Record payment out',
      fields: [
        { k: 'client_id', label: 'Client', type: 'select', req: true, options: withMoney.map(function (id) { return [id, clientName(id) + ' · ' + R2(trustBal(id)) + ' in trust']; }) },
        { k: 'kind', label: 'Type', type: 'select', options: [['refund', 'Refund to the client'], ['payment_out', 'Payment on the client’s behalf']] },
        { k: 'paid_to', label: 'Paid to', ph: 'e.g. the employee (settlement), sheriff, advocate' },
        { k: 'amount', label: 'Amount (R)', type: 'number', step: 0.01, req: true },
        { k: 'entry_date', label: 'Date paid', type: 'date', req: true },
        { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
        { k: 'reference', label: 'Bank reference' },
        { k: 'notes', label: 'Notes', type: 'textarea', full: true }
      ],
      values: { client_id: cid, kind: 'refund', entry_date: ymd(today()) },
      save: async function (d) {
        var bal = trustBal(d.client_id);
        if (!(d.amount > 0)) return 'Enter an amount.';
        if (d.amount > bal + 0.001) return 'Only ' + R2(bal) + ' is held in trust for this client.';
        var r = await sb.from('trust_entries').insert(d).select().single(); if (r.error) return dbErr(r);
        S.trust.unshift(r.data); toast(R2(d.amount) + ' paid out of trust'); render();
      }
    });
  };
  P2['trust-reverse'] = async function (el) {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again to reverse'; return; }
    var e = byId(S.trust, el.dataset.id); if (!e) return;
    var r = e.payment_id ? await sb.from('payments').delete().eq('id', e.payment_id) : await sb.from('trust_entries').delete().eq('id', e.id);
    if (r.error) { toast(r.error.message); return; }
    await refreshMoney(); toast('Reversed: ' + R2(e.amount) + ' is back in trust'); render();
  };
  P2['trust-statement'] = function (el) {
    var cid = el.dataset.client, c = byId(S.clients, cid) || {}, st = S.settings || {}, rows = trustRows(cid);
    var td = 'padding:6px 8px;border-bottom:1px solid #ddd;font-size:13.5px';
    printHtml(letterHtml('Trust account statement', [
      '<p><b>Client:</b> ' + esc(c.name || '') + (c.id_or_reg_no ? ' (' + esc(c.id_or_reg_no) + ')' : '') + '<br><b>Statement date:</b> ' + fmt(today()) + '</p>',
      '<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif"><tr><th align="left" style="' + td + '">Date</th><th align="left" style="' + td + '">Movement</th><th align="right" style="' + td + '">In</th><th align="right" style="' + td + '">Out</th><th align="right" style="' + td + '">Balance</th></tr>' +
        (rows.map(function (r) { return '<tr><td style="' + td + ';white-space:nowrap">' + fmt(r.date) + '</td><td style="' + td + '">' + esc(r.desc) + '</td><td align="right" style="' + td + '">' + (r.inAmt ? R2(r.inAmt) : '') + '</td><td align="right" style="' + td + '">' + (r.out ? R2(r.out) : '') + '</td><td align="right" style="' + td + '">' + R2(r.bal) + '</td></tr>'; }).join('') || '<tr><td colspan="5" style="' + td + '">No movements.</td></tr>') + '</table>',
      '<p><b>Balance held in trust: ' + R2(trustBal(cid)) + '</b></p>',
      st.trust_account ? '<p style="font-size:13px;color:#555">Trust account: ' + esc([st.trust_bank_name, st.trust_holder, 'account ' + st.trust_account, st.trust_branch ? 'branch ' + st.trust_branch : ''].filter(Boolean).join(' · ')) + '</p>' : '',
      '<p style="font-size:13px;color:#555">Money held in trust belongs to the client and is kept in a separate trust account as required by section 86 of the Legal Practice Act, 2014.</p>'
    ], 'For ' + (st.trading_name || 'Labour Law Alliance')));
  };

  /* ----- Retainers: monthly invoices created automatically ----- */
  function retainerNext(r) {
    if (!r.active) return null;
    var t = today(), ms = new Date(t.getFullYear(), t.getMonth(), 1), start = D(r.starts_on);
    var m = r.last_month && D(r.last_month) >= ms ? new Date(t.getFullYear(), t.getMonth() + 1, 1) : ms;
    if (start > new Date(m.getFullYear(), m.getMonth() + 1, 0)) m = new Date(start.getFullYear(), start.getMonth(), 1);
    var d = new Date(m.getFullYear(), m.getMonth(), r.day_of_month);
    if (d < start) d = start;
    if (r.ends_on && D(r.ends_on) < new Date(d.getFullYear(), d.getMonth(), 1)) return null;
    return d < t ? t : d;
  }
  function retainersTab() {
    var st = S.settings || {}, rs = S.retainers.slice().sort(function (a, b) { return clientName(a.client_id) < clientName(b.client_id) ? -1 : 1; });
    var monthly = rs.filter(function (r) { return r.active; }).reduce(function (s, r) { return s + Number(r.amount); }, 0);
    var invs = S.invoices.filter(function (i) { return i.retainer_id; }).slice(0, 12);
    return '<div class="callout">Each morning the CRM creates the month’s invoice for every retainer that has reached its invoice day. With “Email automatically” ticked, the invoice is emailed to the client straight away; otherwise it waits as a draft for you to check. The morning job needs the <code>REMINDER_KEY</code> set in Vercel (Company settings → Calendar & reminders). You can also create due invoices now.</div>' +
      '<div class="grid g4"><div class="panel stat"><b>' + rs.filter(function (r) { return r.active; }).length + '</b><span>Active retainers</span></div><div class="panel stat"><b>' + R2(monthly) + '</b><span>Billed each month (excl. VAT)</span></div><div class="panel stat"><b>' + R2(monthly * 12) + '</b><span>A year of retainers</span></div><div class="panel stat"><b>' + invs.filter(function (i) { return invState(i).key === 'overdue'; }).length + '</b><span>Retainer invoices overdue</span></div></div>' +
      '<div class="panel"><div class="hd"><h2>Retainers</h2><div style="display:flex;gap:8px"><button class="btn" data-act="run-retainers">Create due invoices now</button><button class="btn pri" data-act="new-retainer">New retainer</button></div></div><div class="tbl"><table><tr><th>Client</th><th>What it covers</th><th style="text-align:right">Monthly (excl. VAT)</th><th>Invoice day</th><th>Next invoice</th><th>Emailing</th><th>Status</th></tr>' +
      (rs.map(function (r) { var n = retainerNext(r); return '<tr class="click" data-act="open-retainer" data-id="' + r.id + '"><td><b>' + esc(clientName(r.client_id)) + '</b></td><td>' + esc(r.description) + '</td><td class="mono" style="text-align:right">' + R2(r.amount) + '</td><td class="mono">' + r.day_of_month + '</td><td class="mono">' + (n ? fmt(n) : '—') + '</td><td>' + (r.email_auto ? pill('Automatic', 'p-green') : pill('Draft for review', 'p-gold')) + '</td><td>' + (r.active ? pill('Active', 'p-green') : pill('Paused', '')) + '</td></tr>'; }).join('') || '<tr><td colspan="7">' + empty('No retainers yet. Add one for each client on a monthly fee.') + '</td></tr>') + '</table></div></div>' +
      (invs.length ? '<div class="panel"><div class="hd"><h2>Recent retainer invoices</h2></div><div class="tbl"><table><tr><th>No.</th><th>Client</th><th>Date</th><th style="text-align:right">Total</th><th>Status</th></tr>' + invs.map(function (i) { var s = invState(i); return '<tr class="click" data-act="open-doc" data-kind="invoice" data-id="' + i.id + '"><td class="mono">' + esc(i.number) + '</td><td>' + esc(clientName(i.client_id)) + '</td><td class="mono">' + fmt(i.issue_date) + '</td><td class="mono" style="text-align:right">' + R2(invTotal(i)) + '</td><td>' + pill(s.label, s.cls) + '</td></tr>'; }).join('') + '</table></div></div>' : '') +
      (st.vat_registered ? '' : '<p class="meta">Retainer invoices add VAT only if you are VAT registered in Company settings.</p>');
  }
  function editRetainer(r, preset) {
    var isNew = !r || !r.id;
    openForm({
      title: isNew ? 'New retainer' : 'Retainer: ' + clientName(r.client_id),
      fields: [
        { k: 'client_id', label: 'Client', type: 'select', req: true, blank: 'Choose a client', options: S.clients.map(function (c) { return [c.id, c.name]; }) },
        { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
        { k: 'description', label: 'Line on the invoice', req: true, full: true, hint: 'The month is added automatically, e.g. “… · December 2026”.' },
        { k: 'amount', label: 'Monthly fee (R, excl. VAT)', type: 'number', step: 0.01, req: true },
        { k: 'day_of_month', label: 'Invoice on day (1–28)', type: 'number', step: 1, req: true },
        { k: 'starts_on', label: 'First month from', type: 'date', req: true },
        { k: 'ends_on', label: 'Last month (optional)', type: 'date' },
        { k: 'email_auto', label: 'Email the invoice to the client automatically', type: 'checkbox' },
        { k: 'active', label: 'Active', type: 'checkbox' },
        { k: 'notes', label: 'Note shown on each invoice', type: 'textarea', full: true }
      ],
      values: r || Object.assign({ description: 'Monthly labour law retainer', day_of_month: 1, starts_on: ymd(today()), email_auto: true, active: true }, preset || {}),
      save: async function (d) {
        d.day_of_month = Math.round(Number(d.day_of_month));
        if (!(d.day_of_month >= 1 && d.day_of_month <= 28)) return 'Choose an invoice day from 1 to 28.';
        if (!(d.amount > 0)) return 'Enter the monthly fee.';
        if (d.ends_on && d.ends_on < d.starts_on) return 'The last month is before the first.';
        if (d.email_auto) { var c = byId(S.clients, d.client_id); if (c && !c.email) return 'This client has no email address. Add one, or untick automatic emailing.'; }
        var q = isNew ? await sb.from('retainers').insert(d).select().single() : await sb.from('retainers').update(d).eq('id', r.id).select().single();
        if (q.error) return dbErr(q);
        upsertLocal(S.retainers, q.data); toast(isNew ? 'Retainer added' : 'Retainer saved'); render();
      },
      del: isNew ? null : async function () { var q = await sb.from('retainers').delete().eq('id', r.id); if (q.error) return dbErr(q); S.retainers = S.retainers.filter(function (x) { return x.id !== r.id; }); toast('Retainer deleted. Its invoices are kept.'); render(); }
    });
  }
  P2['new-retainer'] = function (el) { if (!S.clients.length) { toast('Add a client first'); return; } editRetainer(null, el.dataset.client ? { client_id: el.dataset.client } : null); };
  P2['open-retainer'] = function (el) { editRetainer(byId(S.retainers, el.dataset.id)); };
  P2['run-retainers'] = async function (el) {
    el.disabled = true;
    var r = await sb.rpc('run_retainers'); el.disabled = false;
    if (r.error) { toast(r.error.message); return; }
    var n = (r.data || []).length;
    if (n) { await refreshMoney(); var q = await sb.from('retainers').select('*'); if (!q.error) S.retainers = q.data; }
    toast(n ? n + ' retainer invoice' + (n > 1 ? 's' : '') + ' created as draft. Open each to check and email it.' : 'No retainer invoices are due yet this month.'); render();
  };

  /* ----- Save an email attachment to the document centre ----- */
  P2['mail-save'] = function (el) {
    var msg = S.mail.msg; if (!msg) return; var a = msg.attachments[Number(el.dataset.idx)]; if (!a) return;
    var from = ((msg.from[0] || {}).address || '').toLowerCase();
    var c = S.clients.find(function (x) { return (x.email || '').toLowerCase() === from; });
    var m = c && S.matters.find(function (x) { return x.client_id === c.id && x.stage !== 'Closed'; });
    openForm({
      title: 'Save attachment to documents', saveLabel: 'Save',
      fields: [
        { k: 'name', label: 'Name', req: true, full: true },
        { k: 'folder', label: 'Folder', type: 'select', options: FOLDERS },
        { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: S.matters.map(function (x) { return [x.id, x.ref + ' · ' + x.title]; }) },
        { k: 'client_id', label: 'Client', type: 'select', blank: 'Not linked', options: S.clients.map(function (x) { return [x.id, x.name]; }) }
      ],
      values: { name: a.filename, folder: 'Correspondence', matter_id: m ? m.id : '', client_id: c ? c.id : '' },
      extra: '<p class="meta full" style="margin:0">From the email “' + esc(msg.subject) + '” · ' + fileSize(a.size) + (c ? ' · matched to client ' + esc(c.name) + ' by email address' : '') + '</p>',
      save: async function (d) {
        if (a.size > 26214400) return 'This file is larger than 25 MB. Save it from Outlook instead.';
        $('mmsg').textContent = 'Saving…';
        var j = await api('/api/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', uid: msg.uid, index: Number(el.dataset.idx), name: d.name, folder: d.folder, matter_id: d.matter_id || null, client_id: d.client_id || null }) });
        if (j.error || !j.doc) return j.error || 'Could not save the attachment.';
        S.docs.unshift(j.doc); toast('Saved to ' + d.folder + (d.matter_id ? ' on ' + ((byId(S.matters, d.matter_id) || {}).ref || 'the matter') : '')); render();
      }
    });
  };

  /* ----- Hearing outcome starts the 30-day CCMA clock ----- */
  function dismissalClock(before, h) {
    if (h.status !== 'finding_issued' || !/dismiss/i.test(h.sanction || '') || /not dismiss|no dismiss/i.test(h.sanction || '')) return;
    if (before && before.status === 'finding_issued' && /dismiss/i.test(before.sanction || '')) return;
    var forEmployee = h.our_role === 'employee_representative';
    var title = forEmployee ? 'Refer the dismissal of ' + h.employee_name + ' to the CCMA / bargaining council (30 days, LRA s191(1)(b)(i))' : 'Last day for ' + h.employee_name + ' to refer the dismissal to the CCMA (30 days, LRA s191(1)(b)(i))';
    setTimeout(function () {
      openForm({
        title: 'Start the 30-day CCMA clock?', saveLabel: 'Add the deadline',
        fields: [{ k: 'dismissed_on', label: 'Date of dismissal', type: 'date', req: true, full: true, hint: 'The 30 days run from the date of dismissal, or the date the employer made a final decision to dismiss.' }],
        values: { dismissed_on: ymd(today()) },
        extra: '<p class="sub full" style="margin:0">' + (forEmployee ? 'You represent the employee, so this is your deadline to refer the dispute. A late referral needs a condonation application.' : 'The employee may refer an unfair dismissal dispute within 30 days. Knowing when that window closes tells you when the matter is likely settled, and when to expect a referral.') + '</p>',
        save: async function (d) {
          var due = ymd(addDays(D(d.dismissed_on), 30)), r;
          if (h.matter_id) { r = await sb.from('deadlines').insert({ matter_id: h.matter_id, title: title, due_date: due }).select().single(); if (r.error) return dbErr(r); S.deadlines.push(r.data); S.deadlines.sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; }); }
          else { r = await sb.from('tasks').insert({ title: title, due_date: due, client_id: h.client_id || null, assigned_to: S.user.email, priority: forEmployee ? 'high' : 'normal', status: 'open' }).select().single(); if (r.error) return dbErr(r); S.tasks.push(r.data); }
          toast('Added: ' + fmt(due) + (h.matter_id ? ' in Deadlines' : ' as a task')); render();
        }
      });
    }, 60);
  }

  /* ----- Compliance obligation turns into a quote ----- */
  P2['compliance-quote'] = function (el) {
    var c = byId(S.compliance, el.dataset.id); if (!c) return;
    editDoc('quote', null, { client_id: c.client_id, notes: 'Scope: ' + c.obligation + (c.law ? ' (' + c.law + ')' : '') + ', due ' + fmt(c.due_date) + '. We prepare the documents, check them with you and submit them before the deadline.', _items: [{ description: c.obligation + ': preparation and submission', qty: 1, unit_price: (S.settings && S.settings.hourly_rate) || 0 }] });
  };

  /* ----- Monthly practice report ----- */
  function monthBounds(key) { var p = key.split('-'); var a = new Date(+p[0], +p[1] - 1, 1); return [a, new Date(a.getFullYear(), a.getMonth() + 1, 1)]; }
  function reportData(key) {
    var b = monthBounds(key), inM = function (v) { var x = D(v); return x >= b[0] && x < b[1]; };
    var leads = S.leads.filter(function (l) { return inM(l.created_at); }), src = {};
    leads.forEach(function (l) { var k = l.source || 'Unknown'; src[k] = (src[k] || 0) + 1; });
    var billed = S.invoices.filter(function (i) { return i.status !== 'cancelled' && inM(i.issue_date); }).reduce(function (s, i) { return s + invTotal(i); }, 0);
    var od = S.invoices.filter(function (i) { return invState(i).key === 'overdue'; });
    var up = S.deadlines.filter(function (d) { var n = daysLeft(d.due_date); return !d.done && n >= 0 && n <= 30; }).map(function (d) { return [d.due_date, d.title, (byId(S.matters, d.matter_id) || {}).ref]; })
      .concat(S.compliance.filter(function (c) { var n = daysLeft(c.due_date); return c.status === 'open' && n >= 0 && n <= 30; }).map(function (c) { return [c.due_date, c.obligation + ' (' + clientName(c.client_id) + ')', '']; }))
      .sort(function (x, y) { return x[0] < y[0] ? -1 : 1; }).slice(0, 15);
    return {
      label: b[0].toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }), enquiries: leads.length, sources: Object.keys(src).map(function (k) { return [k, src[k]]; }).sort(function (x, y) { return y[1] - x[1]; }),
      clients: leads.filter(function (l) { return l.client_id; }).length,
      opened: S.matters.filter(function (m) { return inM(m.created_at); }).length,
      closed: S.activity.filter(function (a) { return a.entity === 'matters' && a.action === 'stage' && /moved to Closed$/.test(a.summary || '') && inM(a.at || a.created_at); }).length,
      open: S.matters.filter(function (m) { return m.stage !== 'Closed'; }).length,
      billed: billed, received: S.payments.filter(function (p) { return p.account === 'business' && inM(p.received_on); }).reduce(function (s, p) { return s + Number(p.amount); }, 0),
      trustIn: S.payments.filter(function (p) { return p.account === 'trust' && inM(p.received_on); }).reduce(function (s, p) { return s + Number(p.amount); }, 0),
      overdue: od.length, overdueTotal: od.reduce(function (s, i) { return s + invState(i).bal; }, 0), upcoming: up
    };
  }
  function reportView() {
    var t = today(), keys = [];
    for (var i = 0; i < 12; i++) { var x = new Date(t.getFullYear(), t.getMonth() - i, 1); keys.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); }
    var key = S.ui.repMonth || keys[1], r = reportData(key), st = S.settings || {};
    var tabs = '<div class="subtabs">' + ['Practice', 'Sales', 'Website', 'Finance', 'Report', 'Profit'].map(function (x) { return '<button data-dashtab="' + x + '" class="' + (x === 'Report' ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    return head('Monthly report', 'Practice report: ' + esc(r.label), (st.monthly_report_enabled === false ? 'The automatic email is off.' : 'Partners get this by email on the 1st of each month.') + ' Change that in Company settings → Calendar & reminders.', '<select id="rep-month" style="max-width:200px">' + keys.map(function (k) { return '<option value="' + k + '"' + (k === key ? ' selected' : '') + '>' + monthBounds(k)[0].toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) + '</option>'; }).join('') + '</select><button class="btn pri" data-act="report-print">Print / PDF</button>') + tabs +
      '<div class="grid g4"><div class="panel stat"><b>' + r.enquiries + '</b><span>New enquiries</span></div><div class="panel stat"><b>' + r.clients + '</b><span>Became clients</span></div><div class="panel stat"><b>' + r.opened + '</b><span>Matters opened</span></div><div class="panel stat"><b>' + r.closed + '</b><span>Matters closed</span></div></div>' +
      '<div class="grid g4"><div class="panel stat"><b>' + R2(r.billed) + '</b><span>Fees billed</span></div><div class="panel stat"><b>' + R2(r.received) + '</b><span>Fees received</span></div><div class="panel stat"><b' + (r.overdue ? ' style="color:var(--red)"' : '') + '>' + R2(r.overdueTotal) + '</b><span>Overdue now (' + r.overdue + ' invoice' + (r.overdue === 1 ? '' : 's') + ')</span></div><div class="panel stat"><b>' + R2(r.trustIn) + '</b><span>Received into trust</span></div></div>' +
      '<div class="grid g2"><div class="panel"><div class="hd"><h2>Where enquiries came from</h2></div>' + (r.sources.length ? r.sources.map(function (s) { var pc = Math.round(s[1] / r.enquiries * 100); return '<div style="display:flex;align-items:center;gap:10px;margin:8px 0"><span style="width:140px">' + esc(s[0]) + '</span><div style="flex:1;height:8px;border-radius:6px;background:var(--glass-3)"><div style="width:' + pc + '%;height:100%;border-radius:6px;background:var(--accent)"></div></div><span class="mono">' + s[1] + '</span></div>'; }).join('') : empty('No enquiries that month.')) + '</div>' +
      '<div class="panel"><div class="hd"><h2>Time limits in the next 30 days</h2></div><div class="list">' + (r.upcoming.map(function (u) { return '<div class="row"><span class="mono" style="width:90px">' + fmt(u[0]) + '</span><div class="grow">' + esc(u[1]) + (u[2] ? ' <span class="meta">' + esc(u[2]) + '</span>' : '') + '</div></div>'; }).join('') || empty('Nothing due in the next 30 days.')) + '</div></div></div>' +
      '<p class="meta">' + r.open + ' matters are open in total.</p>';
  }
  var _dashBase = V.dashboard;
  V.dashboard = function () {
    if ((S.ui.dashTab || 'Practice') === 'Report') return reportView();
    return _dashBase().replace('<button data-dashtab="Finance" class="">Finance</button>', '<button data-dashtab="Finance" class="">Finance</button><button data-dashtab="Report" class="">Report</button>').replace('<button data-dashtab="Finance" class="on">Finance</button>', '<button data-dashtab="Finance" class="on">Finance</button><button data-dashtab="Report" class="">Report</button>');
  };
  document.addEventListener('change', function (e) { if (e.target.id === 'rep-month') { S.ui.repMonth = e.target.value; render(); } });
  P2['report-print'] = function () {
    var r = reportData(S.ui.repMonth || (function () { var x = new Date(today().getFullYear(), today().getMonth() - 1, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); })());
    var row = function (a, b) { return '<tr><td style="padding:6px 0;border-bottom:1px solid #e5e5e5">' + a + '</td><td align="right" style="padding:6px 0;border-bottom:1px solid #e5e5e5"><b>' + b + '</b></td></tr>'; };
    printHtml(letterHtml('Practice report: ' + r.label, [
      '<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' + row('New enquiries', r.enquiries) + row('Became clients', r.clients) + row('Matters opened', r.opened) + row('Matters closed', r.closed) + row('Matters open now', r.open) + row('Fees billed', R2(r.billed)) + row('Fees received', R2(r.received)) + row('Received into trust', R2(r.trustIn)) + row('Overdue now', R2(r.overdueTotal) + ' (' + r.overdue + ')') + '</table>',
      '<h3 style="font-family:Arial,sans-serif;font-size:14px;margin-top:22px">Where enquiries came from</h3><p>' + (r.sources.map(function (s) { return esc(s[0]) + ': ' + s[1]; }).join(' · ') || 'No enquiries.') + '</p>',
      '<h3 style="font-family:Arial,sans-serif;font-size:14px;margin-top:22px">Time limits in the next 30 days</h3>' + (r.upcoming.length ? '<ul>' + r.upcoming.map(function (u) { return '<li>' + fmt(u[0]) + ': ' + esc(u[1]) + (u[2] ? ' (' + esc(u[2]) + ')' : '') + '</li>'; }).join('') + '</ul>' : '<p>Nothing due.</p>')
    ], 'Prepared ' + fmt(today())));
  };

  /* ----- Two-step sign-in (authenticator app) ----- */
  async function mfaSetup() {
    var l = await sb.auth.mfa.listFactors(); if (l.error) { toast(l.error.message); return; }
    var on = (l.data.totp || [])[0];
    if (on) {
      openForm({ title: 'Two-step sign-in', fields: [], saveLabel: 'Turn it off', extra: '<p class="sub full" style="margin:0">Two-step sign-in is <b>on</b> for your account. Each time you sign in, the CRM asks for the 6-digit code from your authenticator app. Turning it off makes your account easier to break into if your password leaks.</p>',
        save: async function () { var u = await sb.auth.mfa.unenroll({ factorId: on.id }); if (u.error) return u.error.message; S.mfaStatus = null; toast('Two-step sign-in turned off'); render(); } });
      return;
    }
    for (var i = 0; i < (l.data.all || []).length; i++) { var f = l.data.all[i]; if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id }); }
    var e = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'CRM ' + new Date().toISOString().slice(0, 16) });
    if (e.error) { toast(e.error.message); return; }
    openForm({
      title: 'Turn on two-step sign-in', saveLabel: 'Turn on',
      fields: [{ k: 'code', label: '6-digit code from the app', req: true, full: true }],
      extra: '<div class="fld full"><ol style="margin:0 0 10px;padding-left:20px;line-height:1.7"><li>Install Microsoft Authenticator or Google Authenticator on your phone.</li><li>In the app, add an account and scan this code.</li><li>Type the 6-digit code the app shows.</li></ol><img src="' + esc(e.data.totp.qr_code) + '" width="180" height="180" alt="QR code to scan" style="background:#fff;padding:8px;border-radius:12px"><div class="meta" style="margin-top:8px">Can’t scan it? Enter this key in the app instead: <code style="user-select:all">' + esc(e.data.totp.secret) + '</code></div></div>',
      save: async function (d) {
        var r = await sb.auth.mfa.challengeAndVerify({ factorId: e.data.id, code: String(d.code).replace(/\s/g, '') });
        if (r.error) return 'That code did not work. Check that your phone’s time is set automatically and type the newest code.';
        S.mfaStatus = null; toast('Two-step sign-in is on. You’ll be asked for a code each time you sign in.'); render();
      }
    });
  }
  function showMfa() {
    show('login'); $('login-form').classList.add('hidden'); $('mfa-form').classList.remove('hidden'); $('mfa-msg').textContent = ''; $('mfa-code').value = ''; setTimeout(function () { $('mfa-code').focus(); }, 50);
  }
  function resetLogin() { $('mfa-form').classList.add('hidden'); $('login-form').classList.remove('hidden'); }
  $('mfa-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var code = $('mfa-code').value.replace(/\s/g, ''), btn = e.target.querySelector('button[type=submit]');
    if (!/^\d{6}$/.test(code)) { $('mfa-msg').textContent = 'Type the 6-digit code from your authenticator app.'; return; }
    btn.disabled = true;
    var l = await sb.auth.mfa.listFactors(), f = l.data && (l.data.totp || [])[0];
    var r = f ? await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: code }) : { error: { message: 'No authenticator is set up for this account.' } };
    btn.disabled = false;
    if (r.error) { $('mfa-msg').textContent = /invalid|expired/i.test(r.error.message) ? 'That code did not work. Try the newest code in the app.' : r.error.message; return; }
    resetLogin(); start();
  });
  $('mfa-cancel').addEventListener('click', async function () { await sb.auth.signOut(); resetLogin(); show('login'); });
  async function needsMfa() {
    if (!sb.auth.mfa) return false;
    var a = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return !!(a.data && a.data.nextLevel === 'aal2' && a.data.currentLevel !== 'aal2');
  }
  function mfaPill(email) {
    if (!S.mfaStatus) { S.mfaStatus = {}; sb.rpc('staff_mfa_status').then(function (r) { if (r.error || !r.data) return; r.data.forEach(function (x) { S.mfaStatus[(x.email || '').toLowerCase()] = x.enabled; }); if (onView('settings')) render(); }); }
    var v = S.mfaStatus[(email || '').toLowerCase()];
    return v === undefined ? '' : ' ' + (v ? pill('2-step on', 'p-green') : pill('2-step off', ''));
  }

  /* =====================================================================
     PHASE 6: settlement calculator, commissioners, POPIA tools,
     client onboarding links, profit per matter
     ===================================================================== */

  /* ----- Settlement and compensation calculator (LRA s194, BCEA s37, s40, s41) ----- */
  var CALC_TYPES = [
    ['ud', 'Unfair dismissal (misconduct or incapacity)', 12, 'LRA s194(1)'],
    ['auto', 'Automatically unfair dismissal', 24, 'LRA s194(3)'],
    ['ret', 'Retrenchment (operational requirements)', 12, 'LRA s194(1), BCEA s41'],
    ['ulp', 'Unfair labour practice', 12, 'LRA s194(4)']
  ];
  function calcDefaults(m) {
    var t = /auto/i.test(m.dispute_type || '') ? 'auto' : /retrench|s189/i.test(m.dispute_type || '') ? 'ret' : /practice/i.test(m.dispute_type || '') ? 'ulp' : 'ud';
    return { type: t, monthly: '', start: '', end: m.key_rule === 'ud' && m.key_date ? m.key_date : '', leave: '', other: '', months: 3, special: false, noticeDone: false };
  }
  function calcRun(v) {
    var monthly = Number(v.monthly) || 0, weekly = monthly * 12 / 52, daily = monthly / 21.67;
    var s = v.start ? D(v.start) : null, e = v.end ? D(v.end) : today();
    var months = s ? (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) - (e.getDate() < s.getDate() ? 1 : 0) : 0;
    var years = Math.max(0, Math.floor(months / 12));
    var noticeWeeks = !s ? 0 : months < 6 ? 1 : (months < 12 && !v.special) ? 2 : 4;
    var type = CALC_TYPES.find(function (x) { return x[0] === v.type; }) || CALC_TYPES[0];
    var notice = v.noticeDone ? 0 : round2(weekly * noticeWeeks);
    var sev = v.type === 'ret' ? round2(weekly * years) : 0;
    var leave = round2(daily * (Number(v.leave) || 0));
    var other = round2(Number(v.other) || 0);
    var capM = type[2], comp = round2(monthly * Math.min(Number(v.months) || 0, capM));
    var statutory = round2(notice + sev + leave + other);
    return { monthly: monthly, weekly: round2(weekly), daily: round2(daily), months: months, years: years, noticeWeeks: noticeWeeks, notice: notice, sev: sev, leave: leave, other: other, capM: capM, cap: round2(monthly * capM), comp: comp, statutory: statutory, total: round2(statutory + comp), type: type };
  }
  function calcText(m, v, r) {
    return 'Settlement calculation (' + fmt(today()) + ')\n' + r.type[1] + ' · ' + r.type[3] + '\nMonthly pay ' + R2(r.monthly) + ' · service ' + Math.floor(r.months / 12) + ' years ' + (r.months % 12) + ' months\n' +
      (r.notice ? 'Notice pay (' + r.noticeWeeks + ' weeks, BCEA s37): ' + R2(r.notice) + '\n' : '') + (r.sev ? 'Severance pay (' + r.years + ' weeks, BCEA s41): ' + R2(r.sev) + '\n' : '') + (r.leave ? 'Leave pay (' + (Number(v.leave) || 0) + ' days, BCEA s40): ' + R2(r.leave) + '\n' : '') + (r.other ? 'Other amounts owed: ' + R2(r.other) + '\n' : '') +
      'Amounts due regardless: ' + R2(r.statutory) + '\nCompensation: ' + (Number(v.months) || 0) + ' months = ' + R2(r.comp) + ' (maximum ' + r.capM + ' months = ' + R2(r.cap) + ')\nProposed settlement: ' + R2(r.total);
  }
  function matterCalc(m) {
    S.ui.calc = S.ui.calc || {}; var v = S.ui.calc[m.id] = S.ui.calc[m.id] || calcDefaults(m), r = calcRun(v);
    var inp = function (k, label, type, extra) { return '<div class="fld"><label for="cx-' + k + '">' + label + '</label><input id="cx-' + k + '" data-cx="' + k + '" type="' + type + '" value="' + esc(v[k]) + '"' + (extra || '') + '></div>'; };
    var line = function (a, b, note) { return '<div class="row" style="align-items:center"><div class="grow">' + a + (note ? '<div class="meta">' + note + '</div>' : '') + '</div><b class="mono">' + b + '</b></div>'; };
    return '<div class="grid g2"><div><form class="f" id="calc-form" onsubmit="return false">' +
      '<div class="fld full"><label for="cx-type">Type of dispute</label><select id="cx-type" data-cx="type">' + CALC_TYPES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === v.type ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></div>' +
      inp('monthly', 'Monthly pay before deductions (R)', 'number', ' step="100" min="0"') + inp('leave', 'Leave days still owed', 'number', ' step="0.5" min="0"') +
      inp('start', 'Started work on', 'date') + inp('end', 'Dismissal date', 'date') +
      inp('other', 'Other amounts owed (R)', 'number', ' step="100" min="0"') +
      '<div class="fld"><label for="cx-months">Months of compensation: <b id="cx-mv">' + v.months + '</b> of ' + r.capM + '</label><input id="cx-months" data-cx="months" type="range" min="0" max="' + r.capM + '" step="1" value="' + Math.min(v.months, r.capM) + '"></div>' +
      '<label class="check full" style="font-weight:400"><input type="checkbox" data-cx="noticeDone"' + (v.noticeDone ? ' checked' : '') + '> Notice was already worked or paid</label>' +
      '<label class="check full" style="font-weight:400"><input type="checkbox" data-cx="special"' + (v.special ? ' checked' : '') + '> Farm or domestic worker (4 weeks’ notice after 6 months)</label>' +
      '</form></div><div id="calc-out">' + calcOut(m, v, r) + '</div></div>';
  }
  function calcOut(m, v, r) {
    var line = function (a, b, note) { return '<div class="row" style="align-items:center"><div class="grow">' + a + (note ? '<div class="meta">' + note + '</div>' : '') + '</div><b class="mono">' + b + '</b></div>'; };
    return '<div class="panel" style="margin:0;padding:16px">' +
      line('Weekly / daily pay', R2(r.weekly) + ' / ' + R2(r.daily), 'Monthly × 12 ÷ 52, and monthly ÷ 21.67 working days') +
      line('Length of service', Math.floor(r.months / 12) + ' y ' + (r.months % 12) + ' m') +
      line('Notice pay', R2(r.notice), r.noticeWeeks ? r.noticeWeeks + ' weeks (BCEA s37)' + (v.noticeDone ? ', already worked or paid' : '') : 'Add the start date') +
      (v.type === 'ret' ? line('Severance pay', R2(r.sev), r.years + ' completed year' + (r.years === 1 ? '' : 's') + ' × 1 week (BCEA s41)') : '') +
      line('Leave pay', R2(r.leave), 'Days owed × daily pay (BCEA s40)') + (r.other ? line('Other amounts owed', R2(r.other)) : '') +
      line('<b>Due regardless of fairness</b>', R2(r.statutory)) +
      line('Compensation', R2(r.comp), (Number(v.months) || 0) + ' months. Maximum ' + r.capM + ' months = ' + R2(r.cap) + ' (' + r.type[3] + ')') +
      '<div class="row" style="align-items:center;border-top:1px solid var(--line-2);margin-top:6px;padding-top:12px"><div class="grow"><b>Proposed settlement</b></div><b class="mono" style="font-size:22px;color:var(--accent)">' + R2(r.total) + '</b></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri" data-act="calc-note" data-matter="' + m.id + '">Save to file notes</button><button class="btn" data-act="calc-copy" data-matter="' + m.id + '">Copy</button></div></div>' +
      '<p class="meta" style="margin-top:10px">A guide for negotiation, not advice. Compensation must be “just and equitable” and is often lower where only the procedure was unfair. Severance and compensation are taxed as a lump sum by SARS. Check the employee’s remuneration includes regular allowances and benefits.</p>';
  }
  document.addEventListener('input', function (e) {
    var k = e.target.dataset && e.target.dataset.cx; if (!k) return;
    var id = location.hash.indexOf('#matter=') === 0 ? location.hash.slice(8) : null; if (!id || !S.ui.calc || !S.ui.calc[id]) return;
    var v = S.ui.calc[id], m = byId(S.matters, id);
    v[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'type') { var r0 = calcRun(v); v.months = Math.min(Number(v.months) || 0, r0.capM); render(); return; }
    var r = calcRun(v);
    if (k === 'months') { var mv = $('cx-mv'); if (mv) mv.textContent = e.target.value; }
    var out = $('calc-out'); if (out) out.innerHTML = calcOut(m, v, r);
  });
  document.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.cx && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox')) e.target.dispatchEvent(new Event('input', { bubbles: true })); });
  P2['calc-note'] = async function (el) {
    var m = byId(S.matters, el.dataset.matter), v = S.ui.calc[m.id], r = calcRun(v);
    if (!r.monthly) { toast('Enter the monthly pay first.'); return; }
    var q = await sb.from('matter_notes').insert({ matter_id: m.id, body: calcText(m, v, r) }).select().single();
    if (q.error) { toast(q.error.message); return; }
    if (S.notes[m.id]) S.notes[m.id].unshift(q.data); toast('Saved to file notes');
  };
  P2['calc-copy'] = function (el) { var m = byId(S.matters, el.dataset.matter), v = S.ui.calc[m.id]; navigator.clipboard.writeText(calcText(m, v, calcRun(v))).then(function () { toast('Copied'); }, function () { toast('Could not copy'); }); };

  /* ----- Commissioners, arbitrators and judges ----- */
  var OUTCOMES = [['won', 'Won'], ['partly_won', 'Partly won'], ['settled', 'Settled'], ['lost', 'Lost'], ['withdrawn', 'Withdrawn']];
  var OCLS = { won: 'p-green', partly_won: 'p-green', settled: 'p-blue', lost: 'p-red', withdrawn: '' };
  function commStats(id) {
    var ms = S.matters.filter(function (m) { return m.commissioner_id === id; }), done = ms.filter(function (m) { return m.outcome; });
    var good = done.filter(function (m) { return m.outcome === 'won' || m.outcome === 'partly_won'; }).length, decided = done.filter(function (m) { return m.outcome !== 'withdrawn' && m.outcome !== 'settled'; }).length;
    return { ms: ms, done: done, good: good, decided: decided, rate: decided ? Math.round(good / decided * 100) : null, awards: done.filter(function (m) { return m.award_amount; }) };
  }
  V.commissioners = function () {
    var q = (S.ui.commQ || '').toLowerCase();
    var list = S.commissioners.filter(function (c) { return !q || (c.name + ' ' + (c.region || '') + ' ' + (c.forum || '')).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return head('Practice', 'Commissioners and arbitrators', 'Who heard each matter, how it went and what you learned. Check a commissioner’s record here before the next set-down.', '<button class="btn pri" data-act="new-commissioner">Add commissioner</button>') +
      '<input type="search" id="comm-q" placeholder="Search by name, forum or region" value="' + esc(S.ui.commQ || '') + '" style="margin-bottom:12px">' +
      '<div class="panel"><div class="tbl"><table><tr><th>Name</th><th>Forum</th><th>Region</th><th>Matters</th><th>Our results</th><th>Win rate</th><th>Notes</th></tr>' +
      (list.map(function (c) { var s = commStats(c.id); return '<tr class="click" data-act="open-commissioner" data-id="' + c.id + '"><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.forum || '—') + '</td><td>' + esc(c.region || '—') + '</td><td class="mono">' + s.ms.length + '</td><td>' + OUTCOMES.map(function (o) { var n = s.done.filter(function (m) { return m.outcome === o[0]; }).length; return n ? pill(o[1] + ' ' + n, OCLS[o[0]]) : ''; }).join(' ') + '</td><td class="mono">' + (s.rate === null ? '—' : s.rate + '%') + '</td><td class="meta" style="max-width:280px">' + esc((c.notes || '').slice(0, 120)) + '</td></tr>'; }).join('') || '<tr><td colspan="7">' + empty('No commissioners yet. Add one, or pick one when you edit a matter.') + '</td></tr>') + '</table></div></div>' +
      '<p class="meta">Win rate counts matters that were decided (won, partly won or lost), not settlements or withdrawals.</p>';
  };
  document.addEventListener('input', function (e) { if (e.target.id !== 'comm-q') return; S.ui.commQ = e.target.value; clearTimeout(S.commT); S.commT = setTimeout(function () { render(); var n = $('comm-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300); });
  function editCommissioner(c, after) {
    var isNew = !c || !c.id, s = isNew ? null : commStats(c.id);
    openForm({
      title: isNew ? 'Add commissioner' : c.name,
      fields: [{ k: 'name', label: 'Name', req: true }, { k: 'forum', label: 'Forum', type: 'select', blank: 'Choose…', options: ['CCMA', 'Bargaining council', 'Labour Court', 'Private arbitration'] }, { k: 'region', label: 'Region or office', ph: 'e.g. CCMA Johannesburg' }, { k: 'notes', label: 'What to know', type: 'textarea', full: true, ph: 'e.g. Strict on bundles being paginated; pushes hard for settlement at con-arb; gives short postponements only with an affidavit.' }],
      values: c || {},
      extra: isNew ? '' : '<div class="fld full"><span class="lbl">Matters heard</span>' + (s.ms.map(function (m) { return '<div><a href="#matter=' + m.id + '" data-close>' + esc(m.ref + ' · ' + m.title) + '</a> ' + (m.outcome ? pill(lbl(OUTCOMES, m.outcome), OCLS[m.outcome]) : stagePill(m.stage)) + (m.award_amount ? ' <span class="meta">' + R2(m.award_amount) + '</span>' : '') + '</div>'; }).join('') || '<span class="meta">None linked yet.</span>') + '</div>',
      save: async function (d) {
        var r = isNew ? await sb.from('commissioners').insert(d).select().single() : await sb.from('commissioners').update(d).eq('id', c.id).select().single();
        if (r.error) return dbErr(r); upsertLocal(S.commissioners, r.data); toast(isNew ? 'Commissioner added' : 'Saved'); if (after) after(r.data); render();
      },
      del: isNew ? null : async function () { var r = await sb.from('commissioners').delete().eq('id', c.id); if (r.error) return dbErr(r); S.commissioners = S.commissioners.filter(function (x) { return x.id !== c.id; }); toast('Deleted. Matters keep their outcomes.'); render(); }
    });
  }
  P2['new-commissioner'] = function () { editCommissioner(null); };
  P2['open-commissioner'] = function (el) { editCommissioner(byId(S.commissioners, el.dataset.id)); };
  var _matterFields = matterFields;
  matterFields = function () {
    var f = _matterFields(), i = f.findIndex(function (x) { return x.k === 'notes'; });
    f.splice(i, 0,
      { k: 'commissioner_id', label: 'Commissioner / arbitrator / judge', type: 'select', blank: 'Not yet known', options: S.commissioners.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (c) { return [c.id, c.name + (c.region ? ' · ' + c.region : '')]; }), hint: '<a href="#" data-act="quick-commissioner">+ Add a commissioner</a>' },
      { k: 'outcome', label: 'Outcome', type: 'select', blank: 'Not decided yet', options: OUTCOMES },
      { k: 'outcome_date', label: 'Outcome date', type: 'date' },
      { k: 'award_amount', label: 'Award or settlement amount (R)', type: 'number', step: 0.01 });
    return f;
  };
  P2['quick-commissioner'] = function () {
    var form = $('mform'); var keep = {}; if (form) form.querySelectorAll('input,select,textarea').forEach(function (x) { if (x.id) keep[x.id] = x.type === 'checkbox' ? x.checked : x.value; });
    var title = document.querySelector('.modal h2') ? document.querySelector('.modal h2').textContent : '';
    var m = /^Edit /.test(title) ? S.matters.find(function (x) { return 'Edit ' + x.ref === title; }) : null;
    editCommissioner(null, function (c) { setTimeout(function () { editMatter(m ? Object.assign({}, m, readKept(keep), { commissioner_id: c.id }) : Object.assign(readKept(keep), { commissioner_id: c.id })); }, 80); });
  };
  function readKept(k) { var o = {}; Object.keys(k).forEach(function (id) { if (id.indexOf('m-') === 0) o[id.slice(2)] = k[id]; }); return o; }

  /* ----- POPIA: export, access log, retention ----- */
  function clientBundle(c) {
    var ms = S.matters.filter(function (m) { return m.client_id === c.id; }), mids = ms.map(function (m) { return m.id; });
    var by = function (arr) { return arr.filter(function (x) { return x.client_id === c.id || mids.indexOf(x.matter_id) >= 0; }); };
    return { exported_at: new Date().toISOString(), exported_by: S.user && S.user.email, firm: (S.settings || {}).trading_name, client: c, enquiries: S.leads.filter(function (l) { return l.client_id === c.id; }), matters: ms, appointments: by(S.appts), hearings: by(S.hearings), deadlines: S.deadlines.filter(function (d) { return mids.indexOf(d.matter_id) >= 0; }), tasks: by(S.tasks), quotes: S.quotes.filter(function (q) { return q.client_id === c.id; }), invoices: S.invoices.filter(function (i) { return i.client_id === c.id; }).map(function (i) { return Object.assign({}, i, { items: itemsOf('invoice', i.id) }); }), payments: S.payments.filter(function (p) { return p.client_id === c.id; }), trust: S.trust.filter(function (e) { return e.client_id === c.id; }), documents: by(S.docs).map(function (d) { return { name: d.name, folder: d.folder, added: d.created_at, size: d.size_bytes }; }), time: S.time.filter(function (t) { return mids.indexOf(t.matter_id) >= 0; }) };
  }
  P2['popia-export'] = async function (el) {
    var c = byId(S.clients, el.dataset.client); if (!c) return;
    var b = clientBundle(c), mids = b.matters.map(function (m) { return m.id; });
    if (mids.length) { var n = await sb.from('matter_notes').select('*').in('matter_id', mids).order('created_at'); if (!n.error) b.file_notes = n.data; }
    var blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'POPIA-' + c.name.replace(/[^\w]+/g, '-') + '-' + ymd(today()) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('Downloaded everything held on ' + c.name + '. Documents themselves are in the Documents tab.');
  };
  function retentionDue() {
    var yrs = (S.settings && S.settings.retention_years) || 5, cut = addMonths(today(), -12 * yrs);
    return S.clients.filter(function (c) {
      if (c.anonymised_at) return false;
      var ms = S.matters.filter(function (m) { return m.client_id === c.id; });
      if (ms.some(function (m) { return m.stage !== 'Closed'; })) return false;
      var last = [c.updated_at, c.created_at].concat(ms.map(function (m) { return m.updated_at; })).concat(S.invoices.filter(function (i) { return i.client_id === c.id; }).map(function (i) { return i.issue_date; })).concat(S.payments.filter(function (p) { return p.client_id === c.id; }).map(function (p) { return p.received_on; })).filter(Boolean).map(D).sort(function (a, b) { return b - a; })[0];
      c._last = last; return last && last < cut;
    });
  }
  function clientPopia(c) {
    var partner = isPartner(), log = S.accessLog && S.accessLog[c.id];
    if (partner && !log) { S.accessLog = S.accessLog || {}; S.accessLog[c.id] = 'loading'; var mids = S.matters.filter(function (m) { return m.client_id === c.id; }).map(function (m) { return m.id; }); sb.from('access_log').select('*').or('client_id.eq.' + c.id + (mids.length ? ',matter_id.in.(' + mids.join(',') + ')' : '')).order('at', { ascending: false }).limit(100).then(function (r) { S.accessLog[c.id] = r.error ? [] : r.data; if (location.hash === '#client=' + c.id) render(); }); }
    var due = retentionDue().indexOf(c) >= 0, open = S.matters.some(function (m) { return m.client_id === c.id && m.stage !== 'Closed'; });
    return '<div class="grid g2"><div><h3 style="margin:0 0 8px">Consent and requests</h3><div class="list">' +
      '<div class="row"><div class="grow">Consent to process personal information</div>' + pill(c.popia_consent ? 'Signed' : 'Outstanding', c.popia_consent ? 'p-green' : 'p-red') + '</div>' +
      '<div class="row"><div class="grow">Retention</div>' + (c.anonymised_at ? pill('Anonymised ' + fmt(c.anonymised_at), '') : open ? pill('Active client', 'p-blue') : due ? pill('Retention period over', 'p-amber') : pill('Within retention period', 'p-green')) + '</div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri" data-act="popia-export" data-client="' + c.id + '">Download all their data</button>' + (partner && !c.anonymised_at && !open ? '<button class="btn danger" data-act="popia-anon" data-client="' + c.id + '">Anonymise</button>' : '') + '</div>' +
      '<p class="meta" style="margin-top:10px">Use the download to answer a request for access (POPIA s23). Anonymising removes their name, contact details, notes and documents once the retention period ends; invoices and payments stay for tax purposes without their name.</p></div>' +
      '<div><h3 style="margin:0 0 8px">Who opened this file</h3>' + (!partner ? '<p class="meta">Only partners can see the access log.</p>' : log === 'loading' || !log ? '<p class="meta">Loading…</p>' : (log.length ? '<div class="tbl"><table><tr><th>When</th><th>Who</th><th>What</th></tr>' + log.map(function (a) { var m = byId(S.matters, a.matter_id); return '<tr><td class="mono">' + (a.at ? fmtDT(a.at) : '—') + '</td><td>' + esc(a.actor) + '</td><td>' + (m ? esc(m.ref) : 'Client page') + '</td></tr>'; }).join('') + '</table></div>' : empty('Nobody has opened it since logging started.'))) + '</div></div>';
  }
  P2['popia-anon'] = function (el) {
    var c = byId(S.clients, el.dataset.client); if (!c) return;
    openForm({
      title: 'Anonymise ' + c.name, saveLabel: 'Anonymise permanently',
      fields: [{ k: 'confirm', label: 'Type the client’s name to confirm', req: true, full: true }],
      extra: '<div class="callout p-red full">This cannot be undone. It permanently deletes their documents and file notes and removes their name, ID number, contact details and notes everywhere in the CRM. Invoices and payments are kept without their name. Download their data first if you may need it.</div>',
      save: async function (d) {
        if (d.confirm.trim().toLowerCase() !== c.name.trim().toLowerCase()) return 'The name does not match.';
        var r = await sb.rpc('anonymise_client', { p_id: c.id }); if (r.error) return r.error.message;
        var paths = (r.data && r.data.paths) || []; if (paths.length) await sb.storage.from('documents').remove(paths);
        await loadAll(); toast('Anonymised. ' + paths.length + ' document' + (paths.length === 1 ? '' : 's') + ' deleted.'); render();
      }
    });
  };
  function logAccess() {
    var h = location.hash, row = null;
    if (h.indexOf('#client=') === 0) row = { client_id: h.slice(8) };
    else if (h.indexOf('#matter=') === 0) { var m = byId(S.matters, h.slice(8)); if (m) row = { matter_id: m.id, client_id: m.client_id || null }; }
    if (!row || !S.user) return;
    var key = (row.matter_id || '') + '|' + (row.client_id || ''); S.logged = S.logged || {};
    if (S.logged[key] && Date.now() - S.logged[key] < 30 * 60000) return;
    S.logged[key] = Date.now(); row.actor = S.user.email;
    sb.from('access_log').insert(row).then(function () {});
  }
  function popiaSettings() {
    var st = S.settings || {}, due = retentionDue(), can = isPartner();
    return '<div class="panel"><div class="hd"><h2>Retention period</h2></div><p class="sub" style="margin:0 0 12px">How long to keep a former client’s file after their last matter closes. Five years is a common minimum for legal and tax records; check with your professional body before shortening it.</p>' +
      '<form id="ret-form" class="f" style="grid-template-columns:200px auto;align-items:end"><div class="fld"><label for="ret-years">Keep files for (years)</label><input id="ret-years" type="number" min="1" max="30" value="' + (st.retention_years || 5) + '"' + (can ? '' : ' disabled') + '></div>' + (can ? '<div><button class="btn pri" type="submit">Save</button></div>' : '') + '</form></div>' +
      '<div class="panel"><div class="hd"><h2>Ready to anonymise</h2><span class="meta">' + due.length + ' former client' + (due.length === 1 ? '' : 's') + ' past the retention period</span></div><div class="tbl"><table><tr><th>Client</th><th>Last activity</th><th></th></tr>' +
      (due.map(function (c) { return '<tr><td><a href="#client=' + c.id + '"><b>' + esc(c.name) + '</b></a></td><td class="mono">' + fmt(c._last) + '</td><td style="text-align:right"><button class="btn sm" data-act="popia-export" data-client="' + c.id + '">Download data</button>' + (can ? ' <button class="btn sm danger" data-act="popia-anon" data-client="' + c.id + '">Anonymise</button>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="3">' + empty('Nobody is past the retention period.') + '</td></tr>') + '</table></div></div>' +
      '<div class="panel"><div class="hd"><h2>Access log</h2></div><p class="sub" style="margin:0">Every time someone opens a client or matter file, the CRM records who and when. Partners can see it on each client’s POPIA tab. Entries cannot be changed or deleted.</p></div>';
  }
  document.addEventListener('submit', function (e) { if (e.target.id !== 'ret-form') return; e.preventDefault(); var y = Math.round(Number($('ret-years').value)); if (!(y >= 1 && y <= 30)) { toast('Choose 1 to 30 years.'); return; } saveSettings({ retention_years: y }, 'Saved'); });

  /* ----- Client onboarding link ----- */
  function randomToken() { var a = new Uint8Array(32); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function onboardUrl(o) { return location.origin + '/onboard#' + o.token; }
  P2['onboard-new'] = function (el) {
    var c = byId(S.clients, el.dataset.client); if (!c) return;
    var ms = S.matters.filter(function (m) { return m.client_id === c.id; }), m0 = ms.find(function (m) { return m.stage !== 'Closed'; });
    openForm({
      title: 'Onboarding link for ' + c.name, saveLabel: 'Create link',
      fields: [
        { k: 'matter_id', label: 'Matter', type: 'select', blank: 'Not linked', options: ms.map(function (m) { return [m.id, m.ref + ' · ' + m.title]; }) },
        { k: 'fee', label: 'Fee arrangement in the engagement letter', req: true, ph: 'e.g. R 1 950 per hour, billed monthly' },
        { k: 'scope', label: 'Scope of work in the engagement letter', type: 'textarea', req: true, full: true }
      ],
      values: { matter_id: m0 ? m0.id : '', fee: (m0 && m0.fee_arrangement) || '', scope: m0 ? 'Advising and representing you in ' + m0.title + (m0.forum ? ' at the ' + m0.forum : '') + '.' : '' },
      extra: '<p class="meta full" style="margin:0">The client gets a private link, valid for 14 days and usable once. They confirm their details, upload their ID and supporting documents, accept the engagement letter and give POPIA consent. You get a notification and a task to check their FICA documents.</p>',
      save: async function (d) {
        var m = byId(S.matters, d.matter_id) || {}, st = S.settings || {};
        var v = { FIRM: st.legal_name || st.trading_name || 'Labour Law Alliance', CLIENT: c.name, MATTER: m.title ? m.title + ' (' + m.ref + ')' : 'your labour law matter', ATTORNEY: m.attorney || 'An attorney of the firm', SIGN1: c.name, SIGN2: st.trading_name || 'Labour Law Alliance', 'Fee arrangement': d.fee, 'Scope of work': d.scope };
        var row = { token: randomToken(), client_id: c.id, matter_id: d.matter_id || null, expires_at: new Date(Date.now() + 14 * 864e5).toISOString(), letter_html: contractHtml('Engagement letter', v) };
        var r = await sb.from('onboarding').insert(row).select().single(); if (r.error) return dbErr(r);
        S.onboarding.unshift(r.data); render(); setTimeout(function () { showOnboardLink(r.data); }, 60);
      }
    });
  };
  function showOnboardLink(o) {
    var c = byId(S.clients, o.client_id) || {}, url = onboardUrl(o);
    openForm({
      title: 'Send the onboarding link', fields: [], saveLabel: c.email ? 'Email it to ' + c.email : 'Close',
      extra: '<div class="fld full"><label for="ob-url">Private link (valid until ' + fmt(o.expires_at) + ')</label><input id="ob-url" readonly value="' + esc(url) + '" onclick="this.select()"></div><div class="full" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="ob-copy">Copy link</button>' + (c.phone ? '<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(String(c.phone).replace(/\D/g, '').replace(/^0/, '27')) + '?text=' + encodeURIComponent('Hello ' + (c.contact_person || c.name) + ', please complete your details and documents for ' + ((S.settings || {}).trading_name || 'Labour Law Alliance') + ' here: ' + url) + '">Send by WhatsApp</a>' : '') + '</div>',
      save: async function () {
        if (!c.email) return;
        var st = S.settings || {};
        var html = '<p>Dear ' + esc(c.contact_person || c.name) + ',</p><p>Thank you for choosing ' + esc(st.trading_name || 'Labour Law Alliance') + '. Please use the secure link below to confirm your details, upload your ID and supporting documents, and accept our engagement letter. It takes about five minutes.</p><p><a href="' + esc(url) + '" style="display:inline-block;background:#16203b;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Complete my onboarding</a></p><p style="color:#666;font-size:13px">The link is private to you and works until ' + fmt(o.expires_at) + '.</p><p>Kind regards,<br>' + esc(st.trading_name || 'Labour Law Alliance') + '</p>';
        var err = await emailDoc(c.email, 'Your onboarding with ' + (st.trading_name || 'Labour Law Alliance'), html, 'Please complete your onboarding here: ' + url);
        if (err) return err; toast('Onboarding link emailed to ' + c.email);
      }
    });
  }
  P2['ob-copy'] = function () { var i = $('ob-url'); navigator.clipboard.writeText(i.value).then(function () { toast('Link copied'); }, function () { i.select(); }); };
  P2['ob-show'] = function (el) { var o = byId(S.onboarding, el.dataset.id); if (o) showOnboardLink(o); };
  P2['ob-letter'] = function (el) {
    var o = byId(S.onboarding, el.dataset.id); if (!o) return;
    var acc = '<div style="max-width:760px;margin:0 auto 40px;padding:14px 24px;border:2px solid #2e7d32;font-family:Arial,sans-serif;font-size:14px">Accepted online by <b>' + esc(o.accepted_name || '') + '</b> on ' + fmtDT(o.completed_at) + ' using a private onboarding link sent by ' + esc(o.created_by || 'the firm') + '.</div>';
    printHtml((o.letter_html || '').replace('</body>', acc + '</body>'));
  };
  function onboardPanel(c) {
    var obs = S.onboarding.filter(function (o) { return o.client_id === c.id; });
    return '<div class="panel"><div class="hd"><h2>Onboarding</h2><button class="btn sm pri" data-act="onboard-new" data-client="' + c.id + '">Send onboarding link</button></div>' +
      (obs.length ? '<div class="list">' + obs.map(function (o) { var st = o.completed_at ? pill('Completed ' + fmt(o.completed_at), 'p-green') : D(o.expires_at) < new Date() ? pill('Expired', '') : o.opened_at ? pill('Opened, not finished', 'p-amber') : pill('Sent', 'p-blue'); return '<div class="row" style="align-items:center"><div class="grow">Link created ' + fmt(o.created_at) + (o.accepted_name ? '<div class="meta">Engagement letter accepted by ' + esc(o.accepted_name) + '</div>' : '') + '</div>' + st + (o.completed_at ? '<button class="btn sm" data-act="ob-letter" data-id="' + o.id + '">Signed letter</button>' : D(o.expires_at) >= new Date() ? '<button class="btn sm" data-act="ob-show" data-id="' + o.id + '">Link</button>' : '') + '</div>'; }).join('') + '</div>' : '<p class="meta" style="margin:0">Send the client a link to fill in their details, upload their ID and payslips, and accept the engagement letter and POPIA consent on their phone.</p>') + '</div>';
  }

  /* ----- Profit per matter ----- */
  function matterProfit(m) {
    var inv = S.invoices.filter(function (i) { return i.matter_id === m.id && i.status !== 'cancelled'; });
    var billed = round2(inv.reduce(function (s, i) { return s + totals(itemsOf('invoice', i.id), 0).sub; }, 0));
    var received = round2(S.payments.filter(function (p) { return p.account === 'business' && (p.matter_id === m.id || inv.some(function (i) { return i.id === p.invoice_id; })); }).reduce(function (s, p) { return s + Number(p.amount); }, 0));
    var te = S.time.filter(function (t) { return t.matter_id === m.id; });
    var hours = round2(te.reduce(function (s, t) { return s + Number(t.hours || 0); }, 0));
    var value = round2(te.reduce(function (s, t) { return s + Number(t.hours || 0) * Number(t.rate || 0); }, 0));
    var unbilled = round2(te.filter(function (t) { return t.billable && !t.invoice_id; }).reduce(function (s, t) { return s + Number(t.hours || 0) * Number(t.rate || 0); }, 0));
    return { billed: billed, received: received, hours: hours, value: value, unbilled: unbilled, eff: hours ? round2(billed / hours) : null, writeOff: round2(Math.max(0, value - unbilled - billed)) };
  }
  function profitStrip(m) {
    var p = matterProfit(m), rate = (S.settings && S.settings.hourly_rate) || 0;
    return '<div class="grid g4" style="margin-bottom:12px"><div class="panel stat"><b>' + R2(p.billed) + '</b><span>Billed (excl. VAT)</span></div><div class="panel stat"><b>' + R2(p.received) + '</b><span>Received</span></div><div class="panel stat"><b>' + p.hours + ' h</b><span>Time logged · ' + R2(p.unbilled) + ' not billed yet</span></div><div class="panel stat"><b' + (p.eff !== null && rate && p.eff < rate * 0.8 ? ' style="color:var(--amber)"' : '') + '>' + (p.eff === null ? '—' : R2(p.eff)) + '</b><span>Earned per hour' + (rate ? ' (standard ' + R2(rate) + ')' : '') + '</span></div></div>';
  }
  function profitView() {
    var rows = S.matters.map(function (m) { return { m: m, p: matterProfit(m) }; }).filter(function (x) { return x.p.billed || x.p.hours; });
    var byType = {};
    rows.forEach(function (x) { var k = x.m.dispute_type || 'Other'; var t = byType[k] = byType[k] || { n: 0, billed: 0, hours: 0, received: 0 }; t.n++; t.billed += x.p.billed; t.hours += x.p.hours; t.received += x.p.received; });
    var types = Object.keys(byType).map(function (k) { var t = byType[k]; return [k, t.n, round2(t.billed), round2(t.hours), t.hours ? round2(t.billed / t.hours) : null, round2(t.billed / t.n)]; }).sort(function (a, b) { return (b[4] || 0) - (a[4] || 0); });
    var rate = (S.settings && S.settings.hourly_rate) || 0;
    var tabs = '<div class="subtabs">' + ['Practice', 'Sales', 'Website', 'Finance', 'Report', 'Profit'].map(function (x) { return '<button data-dashtab="' + x + '" class="' + (x === 'Profit' ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    return head('Profit', 'Which work pays best', 'Fees billed (excluding VAT) against the time logged on each matter. Earned per hour = fees billed ÷ hours logged' + (rate ? '; your standard rate is ' + R2(rate) : '') + '. It is only as good as your time records.', '<button class="btn pri" data-act="log-time">Log time</button>') + tabs +
      '<div class="panel"><div class="hd"><h2>By type of work</h2></div><div class="tbl"><table><tr><th>Type</th><th>Matters</th><th style="text-align:right">Billed</th><th style="text-align:right">Hours</th><th style="text-align:right">Earned per hour</th><th style="text-align:right">Average per matter</th></tr>' +
      (types.map(function (t) { return '<tr><td><b>' + esc(t[0]) + '</b></td><td class="mono">' + t[1] + '</td><td class="mono" style="text-align:right">' + R2(t[2]) + '</td><td class="mono" style="text-align:right">' + t[3] + '</td><td class="mono" style="text-align:right"' + (t[4] !== null && rate && t[4] < rate * 0.8 ? ' title="Below 80% of your standard rate"' : '') + '>' + (t[4] === null ? '—' : R2(t[4])) + '</td><td class="mono" style="text-align:right">' + R2(t[5]) + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('Log time and send invoices on matters to see this.') + '</td></tr>') + '</table></div></div>' +
      '<div class="panel"><div class="hd"><h2>By matter</h2></div><div class="tbl"><table><tr><th>Matter</th><th>Stage</th><th style="text-align:right">Billed</th><th style="text-align:right">Received</th><th style="text-align:right">Hours</th><th style="text-align:right">Not billed</th><th style="text-align:right">Earned per hour</th></tr>' +
      (rows.sort(function (a, b) { return (b.p.eff || 0) - (a.p.eff || 0); }).map(function (x) { var p = x.p; return '<tr class="click" data-matter="' + x.m.id + '"><td><span class="mono">' + esc(x.m.ref) + '</span><br><b>' + esc(x.m.title) + '</b></td><td>' + stagePill(x.m.stage) + '</td><td class="mono" style="text-align:right">' + R2(p.billed) + '</td><td class="mono" style="text-align:right">' + R2(p.received) + '</td><td class="mono" style="text-align:right">' + p.hours + '</td><td class="mono" style="text-align:right">' + R2(p.unbilled) + '</td><td class="mono" style="text-align:right' + (p.eff !== null && rate && p.eff < rate * 0.8 ? ';color:var(--amber)' : '') + '">' + (p.eff === null ? '—' : R2(p.eff)) + '</td></tr>'; }).join('') || '<tr><td colspan="7">' + empty('Nothing yet.') + '</td></tr>') + '</table></div></div>';
  }
  var _dash6 = V.dashboard;
  V.dashboard = function () {
    if (S.ui.dashTab === 'Profit') return profitView();
    return _dash6().replace(/(<button data-dashtab="Report" class="(?:on)?">Report<\/button>)/, '$1<button data-dashtab="Profit" class="">Profit</button>');
  };

  /* =====================================================================
     PHASE 7: quotes, invoices and payments as full pages
     (list → edit → save and send → convert → record payment → receipt)
     ===================================================================== */
  var TERMS = [['receipt', 'Due on receipt', 0], ['net7', 'Net 7', 7], ['net14', 'Net 14', 14], ['net15', 'Net 15', 15], ['net30', 'Net 30', 30], ['net45', 'Net 45', 45], ['net60', 'Net 60', 60], ['custom', 'Custom', null]];
  var PAY_MODES = [['EFT', 'Bank transfer (EFT)'], ['Cash', 'Cash'], ['Card', 'Card'], ['Cheque', 'Cheque'], ['Payment link', 'Payment link'], ['Other', 'Other']];
  function lineAmt(i) { var g = Number(i.qty || 0) * Number(i.unit_price || 0), d = Number(i.discount || 0); return round2(Math.max(0, i.discount_type === 'R' ? g - d : g * (1 - d / 100))); }
  totals = function (items, vatRate) { var sub = round2(items.reduce(function (s, i) { return s + lineAmt(i); }, 0)); var vat = round2(sub * Number(vatRate || 0) / 100); return { sub: sub, vat: vat, total: round2(sub + vat) }; };
  function termDays(k) { var t = TERMS.find(function (x) { return x[0] === k; }); return t ? t[2] : null; }
  function quoteState(q) {
    if (q.status === 'sent' && q.valid_until && daysLeft(q.valid_until) < 0) return { key: 'expired', label: 'Expired', cls: '' };
    return { key: q.status, label: { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', invoiced: 'Invoiced' }[q.status] || q.status, cls: { draft: 'p-gold', sent: 'p-blue', accepted: 'p-green', declined: 'p-red', invoiced: 'p-green' }[q.status] || '' };
  }
  quotePill = function (s) { var q = typeof s === 'object' ? s : { status: s }; var x = quoteState(q); return pill(x.label, x.cls); };
  function invLine(i) {
    var s = invState(i);
    if (s.key === 'paid') return ['Paid', 'var(--green)'];
    if (s.key === 'cancelled') return ['Cancelled', 'var(--muted)'];
    if (s.key === 'draft') return ['Draft', 'var(--muted)'];
    var n = i.due_date ? daysLeft(i.due_date) : null;
    if (n === null) return [s.key === 'part' ? 'Partially paid' : 'Sent', 'var(--accent)'];
    if (n < 0) return ['Overdue by ' + Math.abs(n) + ' day' + (n === -1 ? '' : 's'), 'var(--red)'];
    if (n === 0) return ['Due today', 'var(--amber)'];
    return [(s.key === 'part' ? 'Part paid · ' : '') + 'Due in ' + n + ' day' + (n === 1 ? '' : 's'), 'var(--accent)'];
  }
  function clientEmail(cid) { var c = byId(S.clients, cid); return c && c.email ? c.email : ''; }
  function nextNo(kind) { var st = S.settings || {}; return kind === 'quote' ? (st.quote_prefix || 'Q-') + String(st.next_quote_no || 1).padStart(4, '0') : (st.invoice_prefix || 'INV-') + String(st.next_invoice_no || 1).padStart(4, '0'); }

  /* ----- Documents: quote / invoice, payment receipt, customer statement ----- */
  function firmBlock() { var st = S.settings || {}; return [st.legal_name || st.trading_name, st.address1, st.address2, st.phone ? 'Calls ' + st.phone : '', st.whatsapp ? 'WhatsApp ' + st.whatsapp : '', st.email, st.reg_no ? 'Reg. no. ' + st.reg_no : '', st.vat_registered && st.vat_no ? 'VAT no. ' + st.vat_no : ''].filter(Boolean).map(esc).join('<br>'); }
  function docShell(title, inner, ribbon) {
    var st = S.settings || {};
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>@media print{body{background:#fff!important}}</style></head><body style="margin:0;background:#f1f1f1">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f1"><tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="700" cellpadding="0" cellspacing="0" style="width:100%;max-width:700px;background:#fff;position:relative;overflow:hidden">' +
      (ribbon ? '<tr><td style="height:0;padding:0;position:relative"><div style="position:absolute;top:22px;left:-46px;width:180px;transform:rotate(-45deg);background:' + ribbon[1] + ';color:#fff;text-align:center;font:bold 12px Arial,sans-serif;letter-spacing:2px;padding:5px 0">' + ribbon[0] + '</div></td></tr>' : '') +
      '<tr><td height="8" style="height:8px;line-height:8px;font-size:0;background:#16203b;background-image:linear-gradient(90deg,#16203b 0%,#349cfc 35%,#d3a728 70%,#fd5d14 100%)">&nbsp;</td></tr>' +
      '<tr><td style="padding:30px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="top"><img src="https://labourlawalliance.co.za/assets/images/logo.png?v=2" width="160" alt="' + esc(st.trading_name || 'Labour Law Alliance') + '" style="display:block;width:160px;height:auto;border:0"></td><td valign="top" align="right" style="font-family:Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#444">' + firmBlock() + '</td></tr></table></td></tr>' +
      inner +
      '<tr><td style="padding:14px 36px;background:#16203b;font-family:Arial,sans-serif;font-size:12px;color:#c9cfdb">' + esc(st.document_footer || '') + '&nbsp;</td></tr></table></td></tr></table></body></html>';
  }
  docHtml = function (kind, d) {
    var st = S.settings || {}, c = byId(S.clients, d.client_id) || {}, m = byId(S.matters, d.matter_id), isQ = kind === 'quote';
    var items = itemsOf(kind, d.id), t = totals(items, d.vat_rate), paid = isQ ? 0 : invPaid(d), bal = round2(t.total - paid);
    var hasDisc = items.some(function (i) { return Number(i.discount); });
    var cell = 'padding:9px 6px;border-bottom:1px solid #e3e3e3;font-family:Arial,sans-serif;font-size:13.5px;color:#1d1d1d;vertical-align:top';
    var th = cell + ';font-size:11px;letter-spacing:1px;color:#666;background:#f6f7f9';
    var bank = st.bank_account ? 'Bank: ' + esc(st.bank_name || '') + ' · Account holder: ' + esc(st.bank_holder || st.trading_name || '') + '<br>Account no.: ' + esc(st.bank_account) + ' · Branch code: ' + esc(st.bank_branch || '') + (st.bank_type ? ' · ' + esc(st.bank_type) : '') : 'Banking details: please contact us.';
    var s = isQ ? quoteState(d) : invState(d);
    var ribbon = isQ ? (s.key === 'accepted' || s.key === 'invoiced' ? [s.label.toUpperCase(), '#2e7d32'] : s.key === 'declined' ? ['DECLINED', '#b3261e'] : null) : (s.key === 'paid' ? ['PAID', '#2e7d32'] : s.key === 'overdue' ? ['OVERDUE', '#b3261e'] : null);
    var meta = isQ ? [['Quote #', d.number], ['Quote date', fmt(d.issue_date)], d.valid_until ? ['Expiry date', fmt(d.valid_until)] : null, d.reference ? ['Reference #', d.reference] : null] : [['Invoice #', d.number], ['Invoice date', fmt(d.issue_date)], d.payment_terms ? ['Terms', (TERMS.find(function (x) { return x[0] === d.payment_terms; }) || [0, d.payment_terms])[1]] : null, d.due_date ? ['Due date', fmt(d.due_date)] : null, d.order_number ? ['Order number', d.order_number] : null];
    if (m) meta.push(['Matter', m.ref]);
    var inner = '<tr><td style="padding:26px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-family:Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:1px;color:#16203b">' + (isQ ? 'QUOTE' : (st.vat_registered ? 'TAX INVOICE' : 'INVOICE')) + '</td>' +
      (isQ ? '' : '<td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#666">Balance due<br><b style="font-size:20px;color:#16203b">' + R2(bal) + '</b></td>') + '</tr></table></td></tr>' +
      '<tr><td style="padding:18px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13.5px;color:#1d1d1d"><tr>' +
      '<td valign="top" width="55%"><span style="color:#666;font-size:12px">Bill to</span><br><b style="color:#1a5fb4">' + esc(c.name || '') + '</b>' + (c.contact_person ? '<br>Attention: ' + esc(c.contact_person) : '') + (c.address ? '<br>' + esc(c.address).replace(/\n/g, '<br>') : '') + (c.email ? '<br>' + esc(c.email) : '') + (c.id_or_reg_no ? '<br>' + esc(c.id_or_reg_no) : '') + '</td>' +
      '<td valign="top" align="right"><table role="presentation" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px">' + meta.filter(Boolean).map(function (x) { return '<tr><td align="right" style="color:#666;padding:2px 12px 2px 0">' + x[0] + ' :</td><td align="right" style="padding:2px 0">' + esc(x[1]) + '</td></tr>'; }).join('') + '</table></td></tr></table></td></tr>' +
      (d.subject ? '<tr><td style="padding:16px 36px 0;font-family:Arial,sans-serif;font-size:13.5px"><span style="color:#666">Subject :</span><br>' + esc(d.subject) + '</td></tr>' : '') +
      '<tr><td style="padding:18px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><th align="left" style="' + th + ';width:24px">#</th><th align="left" style="' + th + '">ITEM &amp; DESCRIPTION</th><th align="right" style="' + th + '">QTY</th><th align="right" style="' + th + '">RATE</th>' + (hasDisc ? '<th align="right" style="' + th + '">DISCOUNT</th>' : '') + '<th align="right" style="' + th + '">AMOUNT</th></tr>' +
      items.map(function (i, n) { return '<tr><td style="' + cell + '">' + (n + 1) + '</td><td style="' + cell + '">' + esc(i.description) + (i.details ? '<div style="color:#666;font-size:12.5px;margin-top:3px;white-space:pre-wrap">' + esc(i.details) + '</div>' : '') + '</td><td align="right" style="' + cell + '">' + Number(i.qty) + '</td><td align="right" style="' + cell + ';white-space:nowrap">' + R2(i.unit_price) + '</td>' + (hasDisc ? '<td align="right" style="' + cell + ';white-space:nowrap">' + (Number(i.discount) ? (i.discount_type === 'R' ? R2(i.discount) : Number(i.discount) + '%') : '') + '</td>' : '') + '<td align="right" style="' + cell + ';white-space:nowrap">' + R2(lineAmt(i)) + '</td></tr>'; }).join('') + '</table></td></tr>' +
      '<tr><td style="padding:8px 36px 0"><table role="presentation" align="right" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13.5px;min-width:280px">' +
      '<tr><td style="padding:6px 16px 6px 0;color:#444">Sub total</td><td align="right" style="padding:6px 0">' + R2(t.sub) + '</td></tr>' +
      (Number(d.vat_rate) ? '<tr><td style="padding:6px 16px 6px 0;color:#444">VAT (' + Number(d.vat_rate) + '%)</td><td align="right" style="padding:6px 0">' + R2(t.vat) + '</td></tr>' : '') +
      '<tr><td style="padding:8px 16px 8px 0;font-weight:bold;border-top:1px solid #ddd">Total' + (d.monthly ? ' per month' : '') + '</td><td align="right" style="padding:8px 0;font-weight:bold;border-top:1px solid #ddd">' + R2(t.total) + '</td></tr>' +
      (!isQ && paid ? '<tr><td style="padding:6px 16px 6px 0;color:#444">Payment made</td><td align="right" style="padding:6px 0;color:#b3261e">(-) ' + R2(paid) + '</td></tr>' : '') +
      (!isQ ? '<tr><td style="padding:8px 16px 8px 0;font-weight:bold;background:#f6f7f9">Balance due</td><td align="right" style="padding:8px 6px;font-weight:bold;background:#f6f7f9">' + R2(bal) + '</td></tr>' : '') + '</table></td></tr>' +
      (d.notes ? '<tr><td style="padding:22px 36px 0;font-family:Arial,sans-serif;font-size:13px;color:#1d1d1d"><b>Notes</b><div style="white-space:pre-wrap;margin-top:4px">' + esc(d.notes) + '</div></td></tr>' : '') +
      (d.terms ? '<tr><td style="padding:16px 36px 0;font-family:Arial,sans-serif;font-size:13px;color:#1d1d1d"><b>Terms &amp; Conditions</b><div style="white-space:pre-wrap;margin-top:4px;color:#444">' + esc(d.terms) + '</div></td></tr>' : '') +
      '<tr><td style="padding:18px 36px 28px;font-family:Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#444">' + (isQ ? 'To accept this quote, reply to the email it came with or call us on ' + esc(st.phone || '') + '.' : bank + '<br>Please use <b>' + esc(d.number) + '</b> as your payment reference.') + '</td></tr>';
    return docShell(d.number, inner, ribbon);
  };
  function receiptHtml(p) {
    var c = byId(S.clients, p.client_id) || {}, inv = byId(S.invoices, p.invoice_id);
    var inner = '<tr><td style="padding:28px 36px 0;font-family:Arial,sans-serif;font-size:15px;letter-spacing:2px;text-align:center;color:#16203b;border-bottom:1px solid #eee;padding-bottom:16px">PAYMENT RECEIPT</td></tr>' +
      '<tr><td style="padding:22px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13.5px"><tr><td valign="top"><table role="presentation" cellpadding="0" cellspacing="0">' +
      [['Payment date', fmt(p.received_on)], ['Payment #', String(p.number || '')], ['Reference number', p.reference || '—'], ['Payment mode', (PAY_MODES.find(function (x) { return x[0] === p.method; }) || [0, p.method])[1]]].map(function (x) { return '<tr><td style="color:#666;padding:6px 24px 6px 0;border-bottom:1px solid #eee">' + x[0] + '</td><td style="padding:6px 0;border-bottom:1px solid #eee"><b>' + esc(x[1]) + '</b></td></tr>'; }).join('') +
      '</table></td><td valign="top" align="right"><div style="display:inline-block;background:#5c9a63;color:#fff;padding:22px 28px;text-align:center;font-family:Arial,sans-serif"><div style="font-size:12.5px">Amount received</div><div style="font-size:22px;font-weight:bold;margin-top:6px">' + R2(p.amount) + '</div></div></td></tr></table></td></tr>' +
      '<tr><td style="padding:20px 36px 0;font-family:Arial,sans-serif;font-size:13.5px"><span style="color:#666">Received from</span><br><b style="color:#1a5fb4">' + esc(c.name || '') + '</b>' + (c.address ? '<br>' + esc(c.address) : '') + '</td></tr>' +
      (inv ? '<tr><td style="padding:22px 36px 0"><div style="font-family:Arial,sans-serif;font-size:14px;font-weight:bold;margin-bottom:8px">Payment for</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px"><tr style="background:#f6f7f9"><th align="left" style="padding:8px">Invoice number</th><th align="left" style="padding:8px">Invoice date</th><th align="right" style="padding:8px">Invoice amount</th><th align="right" style="padding:8px">Payment amount</th></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">' + esc(inv.number) + '</td><td style="padding:8px;border-bottom:1px solid #eee">' + fmt(inv.issue_date) + '</td><td align="right" style="padding:8px;border-bottom:1px solid #eee">' + R2(invTotal(inv)) + '</td><td align="right" style="padding:8px;border-bottom:1px solid #eee">' + R2(p.amount) + '</td></tr></table></td></tr>' : '') +
      (p.notes ? '<tr><td style="padding:16px 36px 0;font-family:Arial,sans-serif;font-size:13px;color:#444;white-space:pre-wrap">' + esc(p.notes) + '</td></tr>' : '') +
      '<tr><td style="padding:24px 36px 28px;font-family:Arial,sans-serif;font-size:12.5px;color:#666">Thank you for your payment.</td></tr>';
    return docShell('Payment ' + (p.number || ''), inner, ['PAID', '#2e7d32']);
  }
  function statementHtml(cid) {
    var c = byId(S.clients, cid) || {}, rows = [];
    S.invoices.filter(function (i) { return i.client_id === cid && i.status !== 'draft' && i.status !== 'cancelled'; }).forEach(function (i) { rows.push([i.issue_date, 'Invoice ' + i.number + (i.due_date ? ' · due ' + fmt(i.due_date) : ''), invTotal(i), 0]); });
    S.payments.filter(function (p) { return p.client_id === cid && p.account === 'business'; }).forEach(function (p) { rows.push([p.received_on, 'Payment received' + (p.reference ? ' · ' + p.reference : ''), 0, Number(p.amount)]); });
    rows.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    var bal = 0, td = 'padding:7px 8px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px';
    var inner = '<tr><td style="padding:26px 36px 0;font-family:Arial,sans-serif"><b style="font-size:18px;color:#16203b">STATEMENT OF ACCOUNT</b><br><span style="color:#666;font-size:13px">' + esc(c.name || '') + ' · ' + fmt(today()) + '</span></td></tr>' +
      '<tr><td style="padding:16px 36px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr style="background:#f6f7f9"><th align="left" style="' + td + '">Date</th><th align="left" style="' + td + '">Transaction</th><th align="right" style="' + td + '">Amount</th><th align="right" style="' + td + '">Payment</th><th align="right" style="' + td + '">Balance</th></tr>' +
      rows.map(function (r) { bal = round2(bal + r[2] - r[3]); return '<tr><td style="' + td + '">' + fmt(r[0]) + '</td><td style="' + td + '">' + esc(r[1]) + '</td><td align="right" style="' + td + '">' + (r[2] ? R2(r[2]) : '') + '</td><td align="right" style="' + td + '">' + (r[3] ? R2(r[3]) : '') + '</td><td align="right" style="' + td + '">' + R2(bal) + '</td></tr>'; }).join('') +
      '<tr><td colspan="4" align="right" style="' + td + ';font-weight:bold">Balance due</td><td align="right" style="' + td + ';font-weight:bold">' + R2(bal) + '</td></tr></table></td></tr>';
    return docShell('Statement ' + (c.name || ''), inner);
  }

  /* ----- PDF in the browser (attached to emails) ----- */
  function loadScript(src) { return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('Could not load the PDF maker. Check your internet connection.')); }; document.head.appendChild(s); }); }
  function loadPdfLib() {
    if (window.html2canvas && window.jspdf) return Promise.resolve();
    if (!S.pdfLoading) S.pdfLoading = Promise.all([window.html2canvas ? 0 : loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'), window.jspdf ? 0 : loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')]).catch(function (e) { S.pdfLoading = null; throw e; });
    return S.pdfLoading;
  }
  // Renders the document in its own frame (so the CRM's styles never touch it) and cuts it into A4 pages.
  async function makePdf(html, filename) {
    await loadPdfLib();
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;height:1200px;border:0;visibility:hidden';
    f.srcdoc = html.replace(/https:\/\/labourlawalliance\.co\.za\/assets\//g, location.origin + '/assets/').replace(/#f1f1f1/g, '#ffffff').replace('padding:24px 12px', 'padding:0');
    document.body.appendChild(f);
    try {
      await new Promise(function (r) { f.onload = r; setTimeout(r, 8000); });
      var d = f.contentDocument;
      await Promise.all(Array.prototype.map.call(d.images, function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); }));
      d.body.style.background = '#ffffff';
      var fullH = Math.ceil(d.body.firstElementChild ? d.body.firstElementChild.getBoundingClientRect().height : d.documentElement.scrollHeight);
      f.style.height = fullH + 'px';
      var canvas = await window.html2canvas(d.body, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 760, width: 760, height: fullH, windowHeight: fullH });
      var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      var pw = 210, ph = 297, m = 6, w = pw - 2 * m, pageH = ph - 2 * m;
      var pxPerMm = canvas.width / w, slice = Math.floor(pageH * pxPerMm);
      for (var y = 0, page = 0; y < canvas.height; y += slice, page++) {
        var h = Math.min(slice, canvas.height - y), c = document.createElement('canvas'); c.width = canvas.width; c.height = h;
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, h); ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (page) pdf.addPage();
        pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', m, m, w, h / pxPerMm);
      }
      return { filename: filename, content: pdf.output('datauristring').split(',')[1] };
    } finally { f.remove(); }
  }
  async function sendMail(o) {
    var s = await sb.auth.getSession(); var token = s.data.session && s.data.session.access_token;
    var r = await fetch('/api/send-document', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(o) });
    var j = await r.json().catch(function () { return {}; });
    return r.ok ? null : (j.error || 'The email could not be sent.');
  }
  function mailHtml(title, message, summary) {
    var st = S.settings || {};
    var paras = String(message || '').split(/\n{2,}/).map(function (p) { return '<p style="margin:0 0 14px">' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f1f1f1"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f1"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#fff">' +
      '<tr><td style="padding:22px 32px 10px"><img src="https://labourlawalliance.co.za/assets/images/logo.png?v=2" width="140" alt="' + esc(st.trading_name || 'Labour Law Alliance') + '" style="display:block;border:0"></td></tr>' +
      '<tr><td style="background:#16203b;color:#fff;text-align:center;font:20px Arial,sans-serif;padding:26px 20px">' + esc(title) + '</td></tr>' +
      '<tr><td style="padding:26px 40px 6px;font:15px/1.6 Arial,sans-serif;color:#1d1d1d">' + paras + '</td></tr>' +
      (summary ? '<tr><td style="padding:0 40px 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fefbe8;border:1px solid #f1e7b4"><tr><td style="padding:18px;text-align:center;font:14px Arial,sans-serif;color:#1d1d1d">' + summary + '</td></tr></table></td></tr>' : '') +
      '<tr><td style="padding:14px 32px;background:#16203b;font:12px Arial,sans-serif;color:#c9cfdb">' + esc([st.trading_name, st.phone, st.email].filter(Boolean).join(' · ')) + '</td></tr></table></td></tr></table></body></html>';
  }

  /* ----- Lists ----- */
  var _quotesBase = V.quotes;
  function stateText(label, color) { return '<span style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:' + color + '">' + esc(label) + '</span>'; }
  function qColor(k) { return { draft: 'var(--muted)', sent: 'var(--accent)', accepted: 'var(--green)', invoiced: 'var(--green)', declined: 'var(--red)', expired: 'var(--amber)' }[k] || 'var(--muted)'; }
  function iColor(k) { return { draft: 'var(--muted)', sent: 'var(--accent)', part: 'var(--amber)', overdue: 'var(--red)', paid: 'var(--green)', cancelled: 'var(--muted)' }[k] || 'var(--muted)'; }
  function listBar(kind) {
    var f = S.ui[kind + 'Filter'] || 'all', q = S.ui[kind + 'Q'] || '';
    var opts = kind === 'quote' ? [['all', 'All quotes'], ['draft', 'Draft'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['invoiced', 'Invoiced'], ['declined', 'Declined'], ['expired', 'Expired']] : [['all', 'All invoices'], ['draft', 'Draft'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['part', 'Partially paid'], ['paid', 'Paid'], ['cancelled', 'Cancelled']];
    return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><select data-lfilter="' + kind + '" style="max-width:200px">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === f ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><input type="search" data-lsearch="' + kind + '" placeholder="Search number, customer or reference" value="' + esc(q) + '" style="max-width:320px"><span style="flex:1"></span><button class="btn pri" data-act="new-' + kind + '">+ New</button></div>';
  }
  function filtered(kind) {
    var f = S.ui[kind + 'Filter'] || 'all', q = (S.ui[kind + 'Q'] || '').toLowerCase();
    var arr = kind === 'quote' ? S.quotes : S.invoices;
    return arr.filter(function (d) {
      var k = kind === 'quote' ? quoteState(d).key : invState(d).key;
      if (f !== 'all') { if (kind === 'invoice' && f === 'unpaid') { if (['sent', 'part', 'overdue'].indexOf(k) < 0) return false; } else if (k !== f) return false; }
      if (q) { var hay = (d.number + ' ' + clientName(d.client_id) + ' ' + (d.reference || '') + ' ' + (d.order_number || '') + ' ' + (d.subject || '')).toLowerCase(); if (hay.indexOf(q) < 0) return false; }
      return true;
    }).sort(function (a, b) { return (a.issue_date || '') < (b.issue_date || '') ? 1 : (a.issue_date || '') > (b.issue_date || '') ? -1 : (a.number < b.number ? 1 : -1); });
  }
  function quoteList() {
    var rows = filtered('quote');
    return listBar('quote') + '<div class="panel"><div class="tbl"><table><tr><th>Date</th><th>Quote #</th><th>Reference #</th><th>Customer name</th><th>Status</th><th style="text-align:right">Amount</th></tr>' +
      (rows.map(function (q) { var s = quoteState(q); return '<tr class="click" data-go="#quote=' + q.id + '"><td class="mono">' + fmt(q.issue_date) + '</td><td><a href="#quote=' + q.id + '" class="mono" style="color:var(--accent)">' + esc(q.number) + '</a></td><td>' + esc(q.reference || '') + '</td><td>' + esc(clientName(q.client_id)) + '</td><td>' + stateText(s.label, qColor(s.key)) + '</td><td class="mono" style="text-align:right">' + R2(totals(itemsOf('quote', q.id), q.vat_rate).total) + '</td></tr>'; }).join('') || '<tr><td colspan="6">' + empty('No quotes here yet.') + '</td></tr>') + '</table></div></div>';
  }
  function invoiceList() {
    var rows = filtered('invoice'), open = S.invoices.filter(function (i) { return ['sent', 'part', 'overdue'].indexOf(invState(i).key) >= 0; });
    var sum = function (a) { return a.reduce(function (s, i) { return s + invState(i).bal; }, 0); };
    var dueIn = function (lo, hi) { return sum(open.filter(function (i) { var n = i.due_date ? daysLeft(i.due_date) : 0; return n >= lo && n <= hi; })); };
    return '<div class="grid g4"><div class="panel stat"><b>' + R2(sum(open)) + '</b><span>Total outstanding</span></div><div class="panel stat"><b>' + R2(dueIn(0, 0)) + '</b><span>Due today</span></div><div class="panel stat"><b>' + R2(dueIn(1, 30)) + '</b><span>Due within 30 days</span></div><div class="panel stat"><b style="color:var(--red)">' + R2(sum(open.filter(function (i) { return invState(i).key === 'overdue'; }))) + '</b><span>Overdue</span></div></div>' +
      listBar('invoice') + '<div class="panel"><div class="tbl"><table><tr><th>Date</th><th>Invoice #</th><th>Order number</th><th>Customer name</th><th>Status</th><th>Due date</th><th style="text-align:right">Amount</th><th style="text-align:right">Balance due</th></tr>' +
      (rows.map(function (i) { var s = invState(i), l = invLine(i); return '<tr class="click" data-go="#invoice=' + i.id + '"><td class="mono">' + fmt(i.issue_date) + '</td><td><a href="#invoice=' + i.id + '" class="mono" style="color:var(--accent)">' + esc(i.number) + '</a></td><td>' + esc(i.order_number || '') + '</td><td>' + esc(clientName(i.client_id)) + '</td><td>' + stateText(l[0], l[1]) + '</td><td class="mono">' + fmt(i.due_date) + '</td><td class="mono" style="text-align:right">' + R2(invTotal(i)) + '</td><td class="mono" style="text-align:right">' + R2(s.key === 'cancelled' ? 0 : s.bal) + '</td></tr>'; }).join('') || '<tr><td colspan="8">' + empty('No invoices here yet.') + '</td></tr>') + '</table></div></div>';
  }
  function itemsTab() {
    return '<div class="panel"><div class="hd"><h2>Items</h2><button class="btn pri" data-act="new-item">+ New item</button></div><p class="sub" style="margin:0 0 10px">Services and fees you pick from when adding lines to a quote or invoice. The rate fills in automatically and can still be changed on each document.</p><div class="tbl"><table><tr><th>Name</th><th>Description</th><th style="text-align:right">Rate</th><th>Unit</th><th>Status</th></tr>' +
      (S.catalog.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (it) { return '<tr class="click" data-act="open-item" data-id="' + it.id + '"><td><b>' + esc(it.name) + '</b></td><td class="meta">' + esc(it.description || '') + '</td><td class="mono" style="text-align:right">' + R2(it.rate) + '</td><td>' + esc(it.unit || '') + '</td><td>' + (it.active ? pill('Active', 'p-green') : pill('Inactive', '')) + '</td></tr>'; }).join('') || '<tr><td colspan="5">' + empty('No items yet.') + '</td></tr>') + '</table></div></div>';
  }
  V.quotes = function () {
    var tab = S.ui.qTab || 'Invoices';
    if (tab === 'Retainers' || tab === 'Unbilled time') return _quotesBase();
    var tabs = '<div class="subtabs">' + ['Invoices', 'Quotes', 'Retainers', 'Unbilled time', 'Items'].map(function (x) { return '<button data-qtab="' + x + '" class="' + (x === tab ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>';
    var warn = (S.settings && !S.settings.bank_account) ? '<div class="callout p-amber">Your bank details are not set, so invoices say “please contact us” instead. <a href="#settings">Add them in Company settings</a>.</div>' : '';
    return head('Sales', 'Quotes and invoices', 'Create a quote, send it, turn it into an invoice, then record the payment. Everything uses your firm and banking details from Company settings.', '<button class="btn pri" data-act="new-invoice">New invoice</button><button class="btn" data-act="new-quote">New quote</button>') + warn + tabs + (tab === 'Quotes' ? quoteList() : tab === 'Items' ? itemsTab() : invoiceList());
  };
  var _qb = _quotesBase;
  _quotesBase = function () { return _qb().replace("['Invoices', 'Quotes', 'Retainers', 'Unbilled time']", '').replace('<button data-qtab="Unbilled time" class="on">Unbilled time</button>', '<button data-qtab="Unbilled time" class="on">Unbilled time</button><button data-qtab="Items" class="">Items</button>').replace('<button data-qtab="Unbilled time" class="">Unbilled time</button>', '<button data-qtab="Unbilled time" class="">Unbilled time</button><button data-qtab="Items" class="">Items</button>'); };
  document.addEventListener('change', function (e) { var k = e.target.dataset && e.target.dataset.lfilter; if (!k) return; S.ui[k + 'Filter'] = e.target.value; render(); });
  document.addEventListener('input', function (e) { var k = e.target.dataset && e.target.dataset.lsearch; if (!k) return; S.ui[k + 'Q'] = e.target.value; clearTimeout(S.lsT); S.lsT = setTimeout(function () { render(); var n = document.querySelector('[data-lsearch="' + k + '"]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });

  /* ----- Item catalogue ----- */
  function editItem(it, after) {
    var isNew = !it || !it.id;
    openForm({
      title: isNew ? 'New item' : it.name,
      fields: [{ k: 'name', label: 'Name', req: true }, { k: 'rate', label: 'Rate (R)', type: 'number', step: 0.01 }, { k: 'unit', label: 'Unit', ph: 'e.g. hour, day' }, { k: 'active', label: 'Active', type: 'checkbox' }, { k: 'description', label: 'Description (shown under the item on documents)', type: 'textarea', full: true }],
      values: it || { active: true, rate: (S.settings && S.settings.hourly_rate) || 0 },
      save: async function (d) { d.rate = d.rate || 0; var r = isNew ? await sb.from('catalog_items').insert(d).select().single() : await sb.from('catalog_items').update(d).eq('id', it.id).select().single(); if (r.error) return dbErr(r); upsertLocal(S.catalog, r.data); toast(isNew ? 'Item added' : 'Item saved'); if (after) setTimeout(function () { after(r.data); }, 60); else render(); },
      del: isNew ? null : async function () { var r = await sb.from('catalog_items').delete().eq('id', it.id); if (r.error) return dbErr(r); S.catalog = S.catalog.filter(function (x) { return x.id !== it.id; }); toast('Item deleted'); render(); }
    });
  }
  P2['new-item'] = function () { editItem(null); };
  P2['open-item'] = function (el) { editItem(byId(S.catalog, el.dataset.id)); };

  /* ----- Edit page: #quote-edit=new|id, #invoice-edit=new|id ----- */
  function blankLine() { return { item_id: null, description: '', details: '', qty: 1, unit_price: '', discount: 0, discount_type: '%' }; }
  function startDraft(kind, id) {
    var st = S.settings || {}, p = S.docPreset || {}, d = id ? byId(kind === 'quote' ? S.quotes : S.invoices, id) : null;
    var lines = d ? itemsOf(kind, d.id).map(function (i) { return { item_id: i.item_id || null, description: i.description, details: i.details || '', qty: i.qty, unit_price: i.unit_price, discount: i.discount || 0, discount_type: i.discount_type || '%' }; }) : (p._items || []).map(function (i) { return Object.assign(blankLine(), i); });
    if (!lines.length) lines = [blankLine()];
    var cid = d ? d.client_id : (p.client_id || '');
    var c = byId(S.clients, cid) || {};
    var dr = d ? Object.assign({}, d) : { client_id: cid, matter_id: p.matter_id || '', issue_date: ymd(today()), status: 'draft', vat_rate: st.vat_registered ? (st.vat_rate || 15) : 0, notes: p.notes || (kind === 'quote' ? st.quote_notes : st.invoice_notes) || '', terms: p.terms || (kind === 'quote' ? st.quote_terms : st.invoice_terms) || '', attorney_email: p.attorney_email || (S.me && S.me.email) || '', subject: p.subject || '' };
    if (!d) {
      if (kind === 'quote') dr.valid_until = ymd(addDays(today(), 30));
      else { dr.payment_terms = c.payment_terms || p.payment_terms || 'net' + (st.payment_terms_days || 14); if (!termDays(dr.payment_terms) && dr.payment_terms !== 'receipt') dr.payment_terms = 'net14'; dr.due_date = ymd(addDays(today(), termDays(dr.payment_terms) || 0)); }
      if (p.reference) dr.reference = p.reference;
      if (p.order_number) dr.order_number = p.order_number;
    }
    S.draft = { kind: kind, id: id || null, doc: dr, lines: lines, files: [], preset: d ? null : p, key: location.hash };
    S.docPreset = null;
  }
  function matterOptions(cid, sel) { return '<option value="">Not linked</option>' + S.matters.filter(function (m) { return !cid || m.client_id === cid; }).map(function (m) { return '<option value="' + m.id + '"' + (m.id === sel ? ' selected' : '') + '>' + esc(m.ref + ' · ' + m.title) + '</option>'; }).join(''); }
  function custBox(dr) {
    var c = byId(S.clients, dr.client_id);
    return '<div class="combo" id="cust-combo"><button type="button" class="combo-btn" data-act="cust-open">' + (c ? '<span class="avatar sm">' + esc((c.name || '?')[0].toUpperCase()) + '</span><span style="flex:1;text-align:left"><b>' + esc(c.name) + '</b>' + (c.email ? ' <span class="meta">' + esc(c.email) + '</span>' : '') + '</span>' : '<span class="meta" style="flex:1;text-align:left">Select or add a customer</span>') + '<span aria-hidden="true">▾</span></button></div>' +
      (c ? '<div class="meta" style="margin-top:8px;display:flex;gap:24px;flex-wrap:wrap"><span><b style="color:var(--ink)">Billing address</b><br>' + (c.address ? esc(c.address).replace(/\n/g, '<br>') : '<a href="#" data-act="edit-client" data-id="' + c.id + '">Add address</a>') + '</span>' + (c.contact_person ? '<span><b style="color:var(--ink)">Attention</b><br>' + esc(c.contact_person) + '</span>' : '') + '</div>' : '');
  }
  function lineRows() {
    var dr = S.draft;
    return dr.lines.map(function (l, i) {
      return '<tr class="dl" data-i="' + i + '"><td><div class="combo"><input type="text" class="it-name" data-l="description" value="' + esc(l.description) + '" placeholder="Type or click to select an item" autocomplete="off"></div><textarea class="it-det" data-l="details" placeholder="Description (optional)" rows="' + Math.max(1, Math.min(6, (l.details || '').split('\n').length)) + '">' + esc(l.details || '') + '</textarea></td>' +
        '<td><input type="number" data-l="qty" step="0.25" min="0" value="' + esc(l.qty) + '"></td><td><input type="number" data-l="unit_price" step="0.01" min="0" value="' + esc(l.unit_price) + '"></td>' +
        '<td><div style="display:flex;gap:4px"><input type="number" data-l="discount" step="0.01" min="0" value="' + esc(l.discount || 0) + '" style="min-width:0"><select data-l="discount_type" style="width:56px;padding-left:6px">' + ['%', 'R'].map(function (x) { return '<option' + (x === l.discount_type ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div></td>' +
        '<td class="mono l-amt" style="text-align:right;padding-top:14px">' + R2(lineAmt(l)) + '</td><td><button type="button" class="btn sm" data-act="dl-del" data-i="' + i + '" aria-label="Remove line" title="Remove line">×</button></td></tr>';
    }).join('');
  }
  function totalsBox() {
    var dr = S.draft, t = totals(dr.lines, dr.doc.vat_rate), qty = dr.lines.reduce(function (s, l) { return s + Number(l.qty || 0); }, 0);
    return '<div class="row"><div class="grow">Sub total</div><b class="mono">' + R2(t.sub) + '</b></div>' +
      '<div class="row" style="align-items:center"><div class="grow">VAT <input type="number" data-f="vat_rate" step="0.01" min="0" value="' + esc(dr.doc.vat_rate || 0) + '" style="width:70px;display:inline-block;margin-left:6px"> %</div><span class="mono">' + R2(t.vat) + '</span></div>' +
      '<div class="row" style="border-top:1px solid var(--line-2);padding-top:12px"><div class="grow"><b style="font-size:16px">Total ( R )</b></div><b class="mono" style="font-size:18px">' + R2(t.total) + '</b></div>' +
      '<span id="dt-foot" hidden>' + R2(t.total) + '|' + qty + '</span>';
  }
  function editPage(kind, id) {
    if (!S.draft || S.draft.key !== location.hash) startDraft(kind, id);
    var dr = S.draft, d = dr.doc, isQ = kind === 'quote', st = S.settings || {};
    if (id && !byId(isQ ? S.quotes : S.invoices, id)) return empty('Not found. <a href="#quotes">Back to quotes and invoices</a>');
    var fld = function (label, input, req) { return '<div class="de-row"><label' + (req ? ' class="req"' : '') + '>' + label + '</label><div>' + input + '</div></div>'; };
    var inp = function (k, type, extra) { return '<input type="' + (type || 'text') + '" data-f="' + k + '" value="' + esc(d[k] == null ? '' : d[k]) + '"' + (extra || '') + '>'; };
    var recips = d.client_id && clientEmail(d.client_id) ? '<label class="check" style="font-weight:400"><input type="checkbox" checked disabled> ' + esc(clientName(d.client_id)) + ' &lt;' + esc(clientEmail(d.client_id)) + '&gt;</label>' : '<span class="meta">Choose a customer with an email address to send this.</span>';
    var files = S.docs.filter(function (x) { return id && (isQ ? x.quote_id === id : x.invoice_id === id); });
    return '<div class="de" id="doc-edit">' +
      '<div class="de-head"><h1>' + (id ? 'Edit ' + (isQ ? 'quote ' : 'invoice ') + esc(d.number) : (isQ ? 'New quote' : 'New invoice')) + '</h1><a href="' + (id ? '#' + kind + '=' + id : '#quotes') + '" class="btn sm" aria-label="Close">✕</a></div>' +
      '<div class="panel de-sec">' + fld('Customer name', custBox(d), true) + '</div>' +
      '<div class="panel de-sec">' +
      fld(isQ ? 'Quote #' : 'Invoice #', '<input type="text" value="' + esc(id ? d.number : nextNo(kind)) + '" disabled title="Numbers are given automatically"><span class="meta">' + (id ? '' : 'Given automatically when you save') + '</span>', true) +
      (isQ ? fld('Reference #', inp('reference', 'text', ' maxlength="80"')) : fld('Order number', inp('order_number', 'text', ' maxlength="80"'))) +
      '<div class="de-row"><label class="req">' + (isQ ? 'Quote date' : 'Invoice date') + '</label><div class="de-inline">' + inp('issue_date', 'date') +
      (isQ ? '<span class="lbl2">Expiry date</span>' + inp('valid_until', 'date') : '<span class="lbl2">Terms</span><select data-f="payment_terms">' + TERMS.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === d.payment_terms ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select><span class="lbl2">Due date</span>' + inp('due_date', 'date')) + '</div></div>' +
      fld('Attorney', '<select data-f="attorney_email"><option value="">Not assigned</option>' + S.staff.filter(function (s) { return s.active; }).map(function (s) { return '<option value="' + esc(s.email) + '"' + (s.email === d.attorney_email ? ' selected' : '') + '>' + esc(s.full_name || s.email) + '</option>'; }).join('') + '</select>') +
      fld('Matter', '<select data-f="matter_id" id="de-matter">' + matterOptions(d.client_id, d.matter_id) + '</select>') +
      fld('Subject', '<textarea data-f="subject" rows="2" maxlength="250" placeholder="Let your customer know what this ' + (isQ ? 'quote' : 'invoice') + ' is for">' + esc(d.subject || '') + '</textarea>') +
      (isQ ? fld('', '<label class="check" style="font-weight:400"><input type="checkbox" data-f="monthly"' + (d.monthly ? ' checked' : '') + '> This is a monthly fee (retainer)</label>') : '') +
      '</div>' +
      '<div class="panel de-sec"><div class="hd"><h2>Item table</h2><button type="button" class="btn sm" data-act="dl-bulk">Add items in bulk</button></div><div class="tbl"><table class="de-lines"><thead><tr><th>Item details</th><th style="width:100px">Quantity</th><th style="width:130px">Rate</th><th style="width:150px">Discount</th><th style="width:130px;text-align:right">Amount</th><th style="width:44px"></th></tr></thead><tbody id="de-lines">' + lineRows() + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn sm" data-act="dl-add">+ Add new row</button></div>' +
      '<div class="grid g2" style="margin-top:16px;align-items:start"><div><label class="lbl" for="de-notes">Customer notes</label><textarea id="de-notes" data-f="notes" rows="3">' + esc(d.notes || '') + '</textarea><div class="meta">Shown on the ' + (isQ ? 'quote' : 'invoice') + '.</div></div><div class="panel de-totals" id="de-totals" style="margin:0">' + totalsBox() + '</div></div></div>' +
      '<div class="panel de-sec"><div class="grid g2" style="align-items:start"><div><label class="lbl" for="de-terms">Terms &amp; conditions</label><textarea id="de-terms" data-f="terms" rows="5" placeholder="Enter the terms and conditions of your business">' + esc(d.terms || '') + '</textarea></div>' +
      '<div><span class="lbl">Attach files to ' + (isQ ? 'quote' : 'invoice') + '</span><div style="margin-top:6px"><label class="btn sm" style="cursor:pointer">Upload file<input type="file" id="de-files" multiple hidden></label></div><div class="meta" style="margin-top:6px">Up to 5 files, 10 MB each. They are saved in the Document centre.</div><div id="de-filelist" style="margin-top:6px">' + files.map(function (x) { return '<div class="meta">📎 ' + esc(x.name) + '</div>'; }).join('') + dr.files.map(function (f) { return '<div class="meta">📎 ' + esc(f.name) + ' (will upload when you save)</div>'; }).join('') + '</div></div></div>' +
      '<div style="margin-top:14px"><span class="lbl">Email communications</span><div style="margin-top:6px">' + recips + '</div></div></div>' +
      '<div class="de-foot"><button type="button" class="btn" data-act="de-save" data-mode="draft">Save as draft</button><button type="button" class="btn pri" data-act="de-save" data-mode="send">Save and send</button><a class="btn" href="' + (id ? '#' + kind + '=' + id : '#quotes') + '">Cancel</a><span style="flex:1"></span><span class="meta" id="de-foot-sum"></span></div>' +
      '</div>';
  }
  function syncFoot() { var f = $('dt-foot'), o = $('de-foot-sum'); if (f && o) { var p = f.textContent.split('|'); o.innerHTML = 'Total amount: <b>' + p[0] + '</b> · Total quantity: ' + p[1]; } }
  function refreshLines() { var tb = $('de-lines'); if (tb) tb.innerHTML = lineRows(); refreshTotals(); }
  function refreshTotals() { var b = $('de-totals'); if (b) b.innerHTML = totalsBox(); syncFoot(); }
  document.addEventListener('input', function (e) {
    if (!S.draft || !e.target.closest || !e.target.closest('#doc-edit')) return;
    var t = e.target, dr = S.draft;
    if (t.dataset.f) {
      var k = t.dataset.f; dr.doc[k] = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'vat_rate') { var tb = $('de-totals'); var v = t.value; refreshTotals(); var n = document.querySelector('[data-f="vat_rate"]'); if (n && document.activeElement !== n) { n.focus(); n.value = v; } return; }
      if (k === 'payment_terms') { var days = termDays(t.value); if (days !== null) { dr.doc.due_date = ymd(addDays(D(dr.doc.issue_date || ymd(today())), days)); var dd = document.querySelector('[data-f="due_date"]'); if (dd) dd.value = dr.doc.due_date; } }
      if (k === 'issue_date' && dr.kind === 'invoice') { var dd2 = termDays(dr.doc.payment_terms); if (dd2 !== null && t.value) { dr.doc.due_date = ymd(addDays(D(t.value), dd2)); var x = document.querySelector('[data-f="due_date"]'); if (x) x.value = dr.doc.due_date; } }
      if (k === 'due_date' && dr.kind === 'invoice') { dr.doc.payment_terms = 'custom'; var ts = document.querySelector('[data-f="payment_terms"]'); if (ts) ts.value = 'custom'; }
      return;
    }
    if (t.dataset.l) {
      var row = t.closest('tr.dl'), i = Number(row.dataset.i), l = dr.lines[i]; if (!l) return;
      l[t.dataset.l] = t.value;
      if (t.dataset.l === 'description') { l.item_id = null; itemMenu(t, i); }
      if (t.dataset.l === 'details') t.rows = Math.max(1, Math.min(6, t.value.split('\n').length));
      row.querySelector('.l-amt').textContent = R2(lineAmt(l)); refreshTotals();
    }
  });
  document.addEventListener('change', function (e) { if (S.draft && e.target.closest && e.target.closest('#doc-edit') && e.target.tagName === 'SELECT') e.target.dispatchEvent(new Event('input', { bubbles: true })); });
  document.addEventListener('focusin', function (e) { if (S.draft && e.target.classList && e.target.classList.contains('it-name')) itemMenu(e.target, Number(e.target.closest('tr.dl').dataset.i)); });
  function itemMenu(input, i) {
    var q = input.value.trim().toLowerCase(), list = S.catalog.filter(function (it) { return it.active && (!q || it.name.toLowerCase().indexOf(q) >= 0 || (it.description || '').toLowerCase().indexOf(q) >= 0); }).slice(0, 8);
    var html = '<div class="menu-list">' + list.map(function (it) { return '<button type="button" class="hit" data-act="dl-pick" data-i="' + i + '" data-id="' + it.id + '"><span style="flex:1;min-width:0;text-align:left"><b style="display:block">' + esc(it.name) + '</b><span class="meta">Rate: ' + R2(it.rate) + (it.unit ? ' per ' + esc(it.unit) : '') + '</span></span></button>'; }).join('') + (list.length ? '' : '<div class="meta" style="padding:8px 12px">No saved item matches. Keep typing to use it as a one-off line.</div>') + '<hr><button type="button" class="hit" data-act="dl-newitem" data-i="' + i + '"><span class="ic">' + icon('plus', 16) + '</span><b>Add new item</b></button></div>';
    var p = popover(html, input, 'menu'); p.dataset.kind = 'items'; p.style.minWidth = Math.max(300, input.offsetWidth) + 'px';
  }
  P2['dl-pick'] = function (el) { var it = byId(S.catalog, el.dataset.id), l = S.draft.lines[Number(el.dataset.i)]; if (!it || !l) return; l.item_id = it.id; l.description = it.name; l.details = it.description || ''; l.unit_price = it.rate; closePop(); refreshLines(); };
  P2['dl-newitem'] = function (el) { var i = Number(el.dataset.i), l = S.draft.lines[i]; closePop(); editItem({ name: l.description, rate: l.unit_price || ((S.settings && S.settings.hourly_rate) || 0), active: true, description: l.details }, function (it) { l.item_id = it.id; l.description = it.name; l.details = it.description || ''; l.unit_price = it.rate; refreshLines(); }); var t = document.querySelector('.modal h2'); if (t) t.textContent = 'New item'; };
  P2['dl-add'] = function () { S.draft.lines.push(blankLine()); refreshLines(); var r = document.querySelectorAll('#de-lines .it-name'); if (r.length) r[r.length - 1].focus(); };
  P2['dl-del'] = function (el) { S.draft.lines.splice(Number(el.dataset.i), 1); if (!S.draft.lines.length) S.draft.lines.push(blankLine()); refreshLines(); };
  P2['dl-bulk'] = function () {
    var items = S.catalog.filter(function (x) { return x.active; });
    openForm({ title: 'Add items in bulk', saveLabel: 'Add items', fields: [], extra: '<div class="fld full">' + (items.map(function (it) { return '<label class="check" style="font-weight:400;justify-content:space-between"><span><input type="checkbox" class="bulk-it" data-id="' + it.id + '"> ' + esc(it.name) + '</span><span class="meta">' + R2(it.rate) + '</span></label>'; }).join('') || '<p class="meta">No saved items yet.</p>') + '</div>',
      save: function () { var picked = Array.prototype.filter.call(document.querySelectorAll('.bulk-it'), function (c) { return c.checked; }).map(function (c) { return byId(S.catalog, c.dataset.id); }); if (!picked.length) return 'Tick at least one item.'; var dr = S.draft; dr.lines = dr.lines.filter(function (l) { return l.description; }); picked.forEach(function (it) { dr.lines.push(Object.assign(blankLine(), { item_id: it.id, description: it.name, details: it.description || '', unit_price: it.rate })); }); setTimeout(refreshLines, 30); } });
  };
  P2['cust-open'] = function (el) {
    var html = '<div style="padding:8px"><input type="search" id="cust-q" placeholder="Search" autocomplete="off"></div><div class="menu-list" id="cust-list"></div><hr><button type="button" class="hit" data-act="cust-new"><span class="ic">' + icon('plus', 16) + '</span><b>New customer</b></button>';
    var p = popover(html, el, 'menu'); p.dataset.kind = 'cust'; p.style.minWidth = el.offsetWidth + 'px';
    var draw = function () { var q = ($('cust-q').value || '').toLowerCase(); $('cust-list').innerHTML = S.clients.filter(function (c) { return !c.anonymised_at && (!q || (c.name + ' ' + (c.email || '') + ' ' + (c.contact_person || '')).toLowerCase().indexOf(q) >= 0); }).slice(0, 30).map(function (c) { return '<button type="button" class="hit" data-act="cust-pick" data-id="' + c.id + '"><span class="avatar sm">' + esc((c.name || '?')[0].toUpperCase()) + '</span><span style="flex:1;min-width:0;text-align:left"><b style="display:block">' + esc(c.name) + '</b><span class="meta">' + esc([c.email, c.contact_person].filter(Boolean).join(' · ')) + '</span></span></button>'; }).join('') || '<div class="meta" style="padding:8px 12px">No match.</div>'; };
    draw(); $('cust-q').addEventListener('input', draw); setTimeout(function () { $('cust-q').focus(); }, 30);
  };
  function pickCustomer(cid) {
    var dr = S.draft, c = byId(S.clients, cid); dr.doc.client_id = cid;
    if (dr.doc.matter_id && (byId(S.matters, dr.doc.matter_id) || {}).client_id !== cid) dr.doc.matter_id = '';
    if (!dr.doc.matter_id) { var m = S.matters.find(function (x) { return x.client_id === cid && x.stage !== 'Closed'; }); if (m) dr.doc.matter_id = m.id; }
    if (dr.kind === 'invoice' && c && c.payment_terms && !dr.id) { dr.doc.payment_terms = c.payment_terms; var n = termDays(c.payment_terms); if (n !== null) dr.doc.due_date = ymd(addDays(D(dr.doc.issue_date), n)); }
    closePop(); render();
  }
  P2['cust-pick'] = function (el) { pickCustomer(el.dataset.id); };
  P2['cust-new'] = function () {
    closePop();
    openForm({
      title: 'New customer', saveLabel: 'Save',
      fields: [{ k: 'kind', label: 'Customer type', type: 'select', options: [['employer', 'Business'], ['individual', 'Individual'], ['union', 'Trade union']] }, { k: 'name', label: 'Display name', req: true, hint: 'The name on quotes and invoices.' }, { k: 'contact_person', label: 'Primary contact' }, { k: 'email', label: 'Email address', type: 'email' }, { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'id_or_reg_no', label: 'ID or registration number' }, { k: 'payment_terms', label: 'Payment terms', type: 'select', options: TERMS.filter(function (t) { return t[0] !== 'custom'; }).map(function (t) { return [t[0], t[1]]; }) }, { k: 'address', label: 'Billing address', type: 'textarea', full: true }],
      values: { kind: 'employer', payment_terms: 'net' + ((S.settings && S.settings.payment_terms_days) || 14) },
      save: async function (d) { d.fica_status = 'outstanding'; d.popia_consent = false; var r = await sb.from('clients').insert(d).select().single(); if (r.error) return dbErr(r); S.clients.push(r.data); S.clients.sort(function (a, b) { return a.name < b.name ? -1 : 1; }); toast('Customer added'); setTimeout(function () { pickCustomer(r.data.id); }, 60); }
    });
  };
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'de-files' || !S.draft) return;
    var add = Array.prototype.slice.call(e.target.files); var bad = add.find(function (f) { return f.size > 10485760; }); if (bad) { toast(bad.name + ' is larger than 10 MB.'); return; }
    S.draft.files = S.draft.files.concat(add).slice(0, 5); var l = $('de-filelist'); if (l) l.insertAdjacentHTML('beforeend', add.map(function (f) { return '<div class="meta">📎 ' + esc(f.name) + ' (will upload when you save)</div>'; }).join(''));
  });
  P2['de-save'] = async function (el) {
    var dr = S.draft, kind = dr.kind, isQ = kind === 'quote', tbl = isQ ? 'quotes' : 'invoices', d = dr.doc, mode = el.dataset.mode;
    var lines = dr.lines.filter(function (l) { return String(l.description || '').trim(); }).map(function (l, i) { return { item_id: l.item_id || null, description: String(l.description).trim().slice(0, 500), details: (l.details || '').trim() || null, qty: Number(l.qty || 0), unit_price: Number(l.unit_price || 0), discount: Number(l.discount || 0), discount_type: l.discount_type === 'R' ? 'R' : '%', sort: i }; });
    if (!d.client_id) { toast('Choose a customer.'); return; }
    if (!lines.length) { toast('Add at least one item.'); return; }
    if (!d.issue_date) { toast('Add the ' + (isQ ? 'quote' : 'invoice') + ' date.'); return; }
    if (mode === 'send' && !clientEmail(d.client_id)) { toast('This customer has no email address. Add one, or save as draft.'); return; }
    document.querySelectorAll('[data-act="de-save"]').forEach(function (b) { b.disabled = true; });
    var done = function () { document.querySelectorAll('[data-act="de-save"]').forEach(function (b) { b.disabled = false; }); };
    var row = { client_id: d.client_id, matter_id: d.matter_id || null, issue_date: d.issue_date, vat_rate: Number(d.vat_rate || 0), notes: d.notes || null, terms: d.terms || null, subject: d.subject || null, attorney_email: d.attorney_email || null };
    if (isQ) { row.valid_until = d.valid_until || null; row.reference = d.reference || null; row.monthly = !!d.monthly; } else { row.due_date = d.due_date || null; row.order_number = d.order_number || null; row.payment_terms = d.payment_terms || null; }
    var r, p = dr.preset || {};
    if (!dr.id) {
      var num = await sb.rpc('next_doc_number', { kind: kind }); if (num.error) { done(); toast(num.error.message); return; }
      row.number = num.data; row.status = 'draft';
      if (p.lead_id) row.lead_id = p.lead_id;
      if (!isQ && p.quote_id) row.quote_id = p.quote_id;
      r = await sb.from(tbl).insert(row).select().single();
    } else r = await sb.from(tbl).update(row).eq('id', dr.id).select().single();
    if (r.error) { done(); toast(r.error.message); return; }
    upsertLocal(S[tbl], r.data);
    var le = await saveLines(kind, r.data.id, lines); if (le) { done(); toast(le); return; }
    if (!dr.id && !isQ && p._timeIds && p._timeIds.length) { var tr = await sb.from('time_entries').update({ invoice_id: r.data.id }).in('id', p._timeIds).select(); if (!tr.error) tr.data.forEach(function (x) { upsertLocal(S.time, x); }); }
    if (!dr.id && !isQ && p.quote_id) { var qr = await sb.from('quotes').update({ status: 'invoiced' }).eq('id', p.quote_id).select().single(); if (!qr.error) upsertLocal(S.quotes, qr.data); }
    if (!dr.id && isQ && p.lead_id) { var lr = await sb.from('leads').update({ status: 'quote_sent', est_value: totals(lines, row.vat_rate).total }).eq('id', p.lead_id).select().single(); if (!lr.error) upsertLocal(S.leads, lr.data); }
    for (var i = 0; i < dr.files.length; i++) {
      var f = dr.files[i], path = 'Correspondence/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + i) + '-' + f.name.replace(/[^\w.\- ]+/g, '_').slice(-100);
      var up = await sb.storage.from('documents').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
      if (!up.error) { var dd = { folder: 'Correspondence', name: f.name, storage_path: path, mime: f.type || null, size_bytes: f.size, client_id: d.client_id, matter_id: d.matter_id || null }; dd[isQ ? 'quote_id' : 'invoice_id'] = r.data.id; var di = await sb.from('documents').insert(dd).select().single(); if (!di.error) S.docs.unshift(di.data); }
    }
    var st = S.settings; if (!dr.id && st) { if (isQ) st.next_quote_no = (st.next_quote_no || 1) + 1; else st.next_invoice_no = (st.next_invoice_no || 1) + 1; }
    S.draft = null; done();
    toast((isQ ? 'The quote ' : 'The invoice ') + r.data.number + ' has been ' + (dr.id ? 'saved' : 'created') + '.');
    location.hash = mode === 'send' ? 'send=' + kind + ':' + r.data.id : kind + '=' + r.data.id;
  };

  /* ----- Send email page: #send=quote:id | invoice:id | receipt:id ----- */
  function sendInfo(kind, id) {
    var st = S.settings || {}, firm = st.trading_name || 'Labour Law Alliance';
    if (kind === 'receipt') { var p = byId(S.payments, id); if (!p) return null; var c = byId(S.clients, p.client_id) || {}, inv = byId(S.invoices, p.invoice_id); return { rec: p, client: c, title: 'Payment Received', subject: 'Payment received by ' + firm, msg: 'Dear ' + (c.contact_person || c.name || 'Sir/Madam') + ',\n\nThank you for your payment. It was a pleasure doing business with you. We look forward to working together again!\n\nKind regards,\n' + firm, summary: 'Payment amount<br><b style="font-size:20px">' + R2(p.amount) + '</b><br><span style="color:#666">Received ' + fmt(p.received_on) + (inv ? ' · Invoice ' + esc(inv.number) : '') + '</span>', pdf: function () { return makePdf(receiptHtml(p), 'Payment-' + (p.number || '') + '.pdf'); }, label: 'Attach payment receipt PDF', back: '#receipt=' + id }; }
    var isQ = kind === 'quote', d = byId(isQ ? S.quotes : S.invoices, id); if (!d) return null;
    var c2 = byId(S.clients, d.client_id) || {}, t = totals(itemsOf(kind, d.id), d.vat_rate), name = c2.contact_person || c2.name || 'Sir/Madam';
    return isQ ? { rec: d, client: c2, title: 'Quote #' + d.number, subject: 'Quote - ' + d.number + ' is awaiting your approval', msg: 'Dear ' + name + ',\n\nThank you for contacting us. Your quote is attached as a PDF. Please let us know if you would like to go ahead, or if you have any questions.\n\nKind regards,\n' + firm, summary: 'Quote amount<br><b style="font-size:20px">' + R2(t.total) + '</b>' + (d.valid_until ? '<br><span style="color:#666">Valid until ' + fmt(d.valid_until) + '</span>' : ''), pdf: function () { return makePdf(docHtml('quote', d), d.number + '.pdf'); }, label: 'Attach quote PDF', back: '#quote=' + id }
      : { rec: d, client: c2, title: 'Invoice #' + d.number, subject: 'Invoice - ' + d.number + ' from ' + firm, msg: 'Dear ' + name + ',\n\nThank you for your business. Your invoice is attached as a PDF. Please pay by the due date using the banking details on the invoice, with ' + d.number + ' as the payment reference.\n\nKind regards,\n' + firm, summary: 'Invoice amount<br><b style="font-size:20px">' + R2(invState(d).bal === undefined ? t.total : invState(d).bal) + '</b>' + (d.due_date ? '<br><span style="color:#666">Due ' + fmt(d.due_date) + '</span>' : ''), pdf: function () { return makePdf(docHtml('invoice', d), d.number + '.pdf'); }, statement: function () { return makePdf(statementHtml(d.client_id), 'Statement-' + (c2.name || '').replace(/[^\w]+/g, '-') + '.pdf'); }, label: 'Attach invoice PDF', back: '#invoice=' + id };
  }
  function sendPage(kind, id) {
    var x = sendInfo(kind, id); if (!x) return empty('Not found. <a href="#quotes">Back</a>');
    var st = S.settings || {};
    S.sendKey = location.hash;
    return '<div class="de"><div class="de-head"><h1>Email to ' + esc(x.client.name || '') + '</h1><a href="' + x.back + '" class="btn sm" aria-label="Close">✕</a></div>' +
      '<div class="panel de-sec"><div class="de-row"><label>From</label><div class="meta" style="padding-top:8px">' + esc((st.trading_name || 'Labour Law Alliance') + ' <' + (st.email || 'info@labourlawalliance.co.za') + '>') + '</div></div>' +
      '<div class="de-row"><label for="em-to">Send to</label><div><input id="em-to" type="text" value="' + esc(x.client.email || '') + '" placeholder="name@example.com, another@example.com"></div></div>' +
      '<div class="de-row"><label for="em-cc">Cc</label><div><input id="em-cc" type="text" value="' + esc(S.user ? S.user.email : '') + '"></div></div>' +
      '<div class="de-row"><label for="em-subject">Subject</label><div><input id="em-subject" type="text" value="' + esc(x.subject) + '" maxlength="200"></div></div></div>' +
      '<div class="panel de-sec" style="padding:0;overflow:hidden"><div class="em-prev"><div class="em-logo"><img src="/assets/images/logo.png?v=2" alt="" width="130"></div><div class="em-band">' + esc(x.title) + '</div><div class="em-body"><textarea id="em-msg" rows="9">' + esc(x.msg) + '</textarea><div class="em-sum">' + x.summary + '</div></div></div></div>' +
      '<div class="panel de-sec"><label class="check" style="font-weight:400"><input type="checkbox" id="em-pdf" checked> ' + x.label + '</label>' + (x.statement ? '<label class="check" style="font-weight:400"><input type="checkbox" id="em-stmt"> Attach customer statement</label>' : '') + '<p class="meta" style="margin:6px 0 0">The office also gets a copy of every email. Replies come to your info@ mailbox.</p></div>' +
      '<div class="de-foot"><button class="btn pri" data-act="em-send" data-kind="' + kind + '" data-id="' + id + '">Send</button><a class="btn" href="' + x.back + '">Cancel</a><span class="msg" id="em-msg-out" style="margin-left:8px"></span></div></div>';
  }
  P2['em-send'] = async function (el) {
    var kind = el.dataset.kind, id = el.dataset.id, x = sendInfo(kind, id); if (!x) return;
    var out = $('em-msg-out'); el.disabled = true; out.className = 'msg'; out.textContent = 'Preparing…';
    try {
      var att = [];
      if ($('em-pdf').checked) { out.textContent = 'Making the PDF…'; att.push(await x.pdf()); }
      if ($('em-stmt') && $('em-stmt').checked) att.push(await x.statement());
      out.textContent = 'Sending…';
      var err = await sendMail({ to: $('em-to').value, cc: $('em-cc').value, subject: $('em-subject').value.trim(), html: mailHtml(x.title, $('em-msg').value, x.summary), text: $('em-msg').value, attachments: att });
      if (err) { out.textContent = err; el.disabled = false; return; }
    } catch (er) { out.textContent = er.message || 'Could not send.'; el.disabled = false; return; }
    var now = new Date().toISOString(), r;
    if (kind === 'quote') { r = await sb.from('quotes').update({ status: x.rec.status === 'draft' ? 'sent' : x.rec.status, sent_at: now }).eq('id', id).select().single(); if (!r.error) upsertLocal(S.quotes, r.data); }
    if (kind === 'invoice') { r = await sb.from('invoices').update({ status: x.rec.status === 'draft' ? 'sent' : x.rec.status, sent_at: now }).eq('id', id).select().single(); if (!r.error) upsertLocal(S.invoices, r.data); }
    if (kind === 'receipt') { r = await sb.from('payments').update({ thanks_sent_at: now }).eq('id', id).select().single(); if (!r.error) upsertLocal(S.payments, r.data); }
    toast(kind === 'quote' ? 'Your quote has been sent.' : kind === 'invoice' ? 'Your invoice has been sent.' : 'The payment receipt has been sent.');
    location.hash = x.back.slice(1);
  };

  /* ----- View pages (split list + document) ----- */
  function sideList(kind, sel) {
    var arr = kind === 'quote' ? filtered('quote') : kind === 'invoice' ? filtered('invoice') : S.payments.filter(function (p) { return p.account === 'business'; }).slice().sort(function (a, b) { return a.received_on < b.received_on ? 1 : -1; });
    var head2 = { quote: 'All quotes', invoice: 'All invoices', receipt: 'Payments received' }[kind];
    return '<aside class="slist panel"><div class="slist-h"><b>' + head2 + '</b>' + (kind === 'receipt' ? '' : '<button class="btn sm pri" data-act="new-' + kind + '" aria-label="New">+</button>') + '</div><div class="slist-b">' +
      arr.map(function (d) {
        if (kind === 'receipt') return '<a href="#receipt=' + d.id + '" class="si' + (d.id === sel ? ' on' : '') + '"><div class="si-t"><b>' + esc(clientName(d.client_id)) + '</b><span class="mono">' + R2(d.amount) + '</span></div><div class="meta">' + (d.number || '') + ' · ' + fmt(d.received_on) + '</div><div style="font-size:11.5px;font-weight:700;color:var(--green)">PAID · ' + esc((PAY_MODES.find(function (x) { return x[0] === d.method; }) || [0, d.method])[1]) + '</div></a>';
        var l = kind === 'quote' ? (function () { var s = quoteState(d); return [s.label, qColor(s.key)]; })() : invLine(d);
        var amt = kind === 'quote' ? totals(itemsOf('quote', d.id), d.vat_rate).total : invTotal(d);
        return '<a href="#' + kind + '=' + d.id + '" class="si' + (d.id === sel ? ' on' : '') + '"><div class="si-t"><b>' + esc(clientName(d.client_id)) + '</b><span class="mono">' + R2(amt) + '</span></div><div class="meta">' + esc(d.number) + ' · ' + fmt(d.issue_date) + '</div><div style="font-size:11.5px;font-weight:700;text-transform:uppercase;color:' + l[1] + '">' + esc(l[0]) + '</div></a>';
      }).join('') + '</div></aside>';
  }
  function frame(html) { return '<iframe class="docframe" title="Document preview" sandbox="allow-same-origin" srcdoc="' + esc(html) + '"></iframe>'; }
  function viewPage(kind, id) {
    var isQ = kind === 'quote', d = byId(isQ ? S.quotes : S.invoices, id);
    if (!d) return empty('Not found. <a href="#quotes">Back to quotes and invoices</a>');
    var s = isQ ? quoteState(d) : invState(d), pays = isQ ? [] : S.payments.filter(function (p) { return p.invoice_id === id; });
    var files = S.docs.filter(function (x) { return isQ ? x.quote_id === id : x.invoice_id === id; }), inv = isQ ? S.invoices.find(function (i) { return i.quote_id === id; }) : null, fromQ = !isQ && d.quote_id ? byId(S.quotes, d.quote_id) : null;
    var tools = '<button class="btn sm" data-go="#' + kind + '-edit=' + id + '">Edit</button><button class="btn sm" data-go="#send=' + kind + ':' + id + '">Send email</button><button class="btn sm" data-act="doc-print" data-kind="' + kind + '" data-id="' + id + '">PDF / Print</button><button class="btn sm" data-act="doc-pdf" data-kind="' + kind + '" data-id="' + id + '">Download PDF</button>' +
      (isQ ? (s.key !== 'invoiced' ? '<button class="btn sm pri" data-act="quote-to-invoice" data-id="' + id + '">Convert to invoice</button>' : '') : (['sent', 'part', 'overdue', 'draft'].indexOf(s.key) >= 0 ? '<button class="btn sm pri" data-go="#pay=' + id + '">Record payment</button>' : '')) +
      '<button class="btn sm" data-act="doc-more" data-kind="' + kind + '" data-id="' + id + '" aria-label="More">⋯</button>';
    return '<div class="split">' + sideList(kind, id) + '<section class="sdoc"><div class="panel sdoc-h"><div><div class="meta">' + (isQ ? 'Quote' : 'Invoice') + '</div><h1 style="margin:0">' + esc(d.number) + '</h1></div><div class="sdoc-tools">' + tools + '</div></div>' +
      (s.key === 'draft' ? '<div class="callout">This ' + (isQ ? 'quote' : 'invoice') + ' is a draft. <a href="#send=' + kind + ':' + id + '">Send it</a>' + (isQ ? '' : ' or <a href="#" data-act="mark-sent" data-id="' + id + '">mark it as sent</a>') + '.</div>' : '') +
      (inv ? '<div class="callout p-blue">Converted to invoice <a href="#invoice=' + inv.id + '">' + esc(inv.number) + '</a>.</div>' : '') + (fromQ ? '<div class="callout p-blue">Made from quote <a href="#quote=' + fromQ.id + '">' + esc(fromQ.number) + '</a>.</div>' : '') +
      '<div class="panel" style="padding:0;overflow:hidden">' + frame(docHtml(kind, d)) + '</div>' +
      (!isQ ? '<div class="panel"><div class="hd"><h2>Payments received</h2>' + (s.key !== 'paid' && s.key !== 'cancelled' ? '<button class="btn sm" data-go="#pay=' + id + '">Record payment</button>' : '') + '</div>' + (pays.length ? '<div class="tbl"><table><tr><th>Date</th><th>Payment #</th><th>Reference</th><th>Mode</th><th style="text-align:right">Amount</th></tr>' + pays.map(function (p) { return '<tr class="click" data-go="#receipt=' + p.id + '"><td class="mono">' + fmt(p.received_on) + '</td><td class="mono">' + (p.number || '') + '</td><td>' + esc(p.reference || '') + '</td><td>' + esc(p.method) + '</td><td class="mono" style="text-align:right">' + R2(p.amount) + '</td></tr>'; }).join('') + '</table></div>' : '<p class="meta" style="margin:0">No payments yet.</p>') + '</div>' : '') +
      '<div class="panel"><div class="hd"><h2>More information</h2></div><dl class="kv"><dt>Email recipients</dt><dd>' + esc(clientEmail(d.client_id) || '—') + '</dd>' + (d.sent_at ? '<dt>Last sent</dt><dd>' + fmtDT(d.sent_at) + '</dd>' : '') + (d.attorney_email ? '<dt>Attorney</dt><dd>' + esc(d.attorney_email) + '</dd>' : '') + (d.matter_id && byId(S.matters, d.matter_id) ? '<dt>Matter</dt><dd><a href="#matter=' + d.matter_id + '">' + esc(byId(S.matters, d.matter_id).ref) + '</a></dd>' : '') + (files.length ? '<dt>Attachments</dt><dd>' + files.map(function (f) { return '<a href="#" data-act="doc-open" data-id="' + f.id + '">' + esc(f.name) + '</a>'; }).join('<br>') + '</dd>' : '') + '</dl></div>' +
      '</section></div>';
  }
  P2['doc-pdf'] = async function (el) {
    var k = el.dataset.kind, d = k === 'receipt' ? byId(S.payments, el.dataset.id) : byId(k === 'quote' ? S.quotes : S.invoices, el.dataset.id); el.disabled = true;
    try { var f = await makePdf(k === 'receipt' ? receiptHtml(d) : docHtml(k, d), (k === 'receipt' ? 'Payment-' + d.number : d.number) + '.pdf'); var a = document.createElement('a'); a.href = 'data:application/pdf;base64,' + f.content; a.download = f.filename; document.body.appendChild(a); a.click(); a.remove(); }
    catch (er) { toast(er.message || 'Could not make the PDF.'); }
    el.disabled = false;
  };
  P2['doc-print'] = function (el) { var k = el.dataset.kind; if (k === 'receipt') return printHtml(receiptHtml(byId(S.payments, el.dataset.id))); printHtml(docHtml(k, byId(S[k === 'quote' ? 'quotes' : 'invoices'], el.dataset.id))); };
  P2['doc-more'] = function (el) {
    var k = el.dataset.kind, id = el.dataset.id, d = byId(k === 'quote' ? S.quotes : S.invoices, id);
    var items = menuItem('doc', 'Clone', 'data-act="doc-clone" data-kind="' + k + '" data-id="' + id + '"');
    if (k === 'quote') items += (d.status !== 'accepted' && d.status !== 'invoiced' ? menuItem('check', 'Mark as accepted', 'data-act="quote-mark" data-s="accepted" data-id="' + id + '"') : '') + (d.status !== 'declined' && d.status !== 'invoiced' ? menuItem('out', 'Mark as declined', 'data-act="quote-mark" data-s="declined" data-id="' + id + '"') : '');
    else items += (d.status === 'draft' ? menuItem('check', 'Mark as sent', 'data-act="mark-sent" data-id="' + id + '"') : '') + (d.status !== 'cancelled' && invPaid(d) === 0 ? menuItem('out', 'Void (cancel)', 'data-act="inv-void" data-id="' + id + '"') : '');
    items += '<hr>' + menuItem('out', 'Delete', 'data-act="doc-delete" data-kind="' + k + '" data-id="' + id + '"');
    var p = popover(items, el, 'menu'); p.dataset.kind = 'more';
  };
  P2['quote-mark'] = async function (el) { var r = await sb.from('quotes').update({ status: el.dataset.s }).eq('id', el.dataset.id).select().single(); if (r.error) { toast(r.error.message); return; } upsertLocal(S.quotes, r.data); toast('Quote marked as ' + el.dataset.s); render(); };
  P2['mark-sent'] = async function (el) { var r = await sb.from('invoices').update({ status: 'sent' }).eq('id', el.dataset.id).select().single(); if (r.error) { toast(r.error.message); return; } upsertLocal(S.invoices, r.data); toast('Marked as sent'); render(); };
  P2['inv-void'] = async function (el) { if (!confirm('Void this invoice? It stays on record as cancelled.')) return; var r = await sb.from('invoices').update({ status: 'cancelled' }).eq('id', el.dataset.id).select().single(); if (r.error) { toast(r.error.message); return; } upsertLocal(S.invoices, r.data); toast('Invoice voided'); render(); };
  P2['doc-delete'] = async function (el) {
    var k = el.dataset.kind, tbl = k === 'quote' ? 'quotes' : 'invoices', d = byId(S[tbl], el.dataset.id);
    if (k === 'invoice' && invPaid(d) > 0) { toast('Payments are recorded against this invoice. Void it instead.'); return; }
    if (!confirm('Delete ' + d.number + '? This cannot be undone.')) return;
    var r = await sb.from(tbl).delete().eq('id', d.id); if (r.error) { toast(r.error.message); return; }
    S[tbl] = S[tbl].filter(function (x) { return x.id !== d.id; }); S.items = S.items.filter(function (i) { return i[k + '_id'] !== d.id; }); toast(d.number + ' deleted'); location.hash = 'quotes';
  };
  P2['doc-clone'] = function (el) { var k = el.dataset.kind, d = byId(k === 'quote' ? S.quotes : S.invoices, el.dataset.id); S.docPreset = { client_id: d.client_id, matter_id: d.matter_id, notes: d.notes, terms: d.terms, subject: d.subject, _items: itemsOf(k, d.id).map(function (i) { return { item_id: i.item_id, description: i.description, details: i.details, qty: i.qty, unit_price: i.unit_price, discount: i.discount, discount_type: i.discount_type }; }) }; S.draft = null; location.hash = k + '-edit=new'; };

  /* ----- Record payment: #pay=invoiceId ----- */
  function payPage(id) {
    var inv = byId(S.invoices, id); if (!inv) return empty('Invoice not found.');
    var s = invState(inv), c = byId(S.clients, inv.client_id) || {}, nextP = S.payments.reduce(function (m, p) { return Math.max(m, p.number || 0); }, 0) + 1;
    var row = function (label, input, req) { return '<div class="de-row"><label' + (req ? ' class="req"' : '') + '>' + label + '</label><div>' + input + '</div></div>'; };
    return '<div class="split">' + sideList('invoice', id) + '<section class="sdoc"><div class="panel sdoc-h"><h1 style="margin:0">Payment for ' + esc(inv.number) + '</h1><a href="#invoice=' + id + '" class="btn sm" aria-label="Close">✕</a></div>' +
      '<form class="panel de-sec" id="pay-form" onsubmit="return false">' +
      row('Customer name', '<input type="text" value="' + esc(c.name || '') + '" disabled>', true) +
      row('Payment #', '<input type="text" value="' + nextP + '" disabled title="Numbered automatically">', true) +
      '<div class="de-row"><label class="req" for="pf-amount">Amount received (R)</label><div class="de-inline"><input type="number" id="pf-amount" step="0.01" min="0" value="' + (s.bal > 0 ? s.bal.toFixed(2) : '') + '"><span class="lbl2">Bank charges (if any)</span><input type="number" id="pf-charges" step="0.01" min="0" value=""></div></div>' +
      '<div class="de-row"><label class="req" for="pf-date">Payment date</label><div class="de-inline"><input type="date" id="pf-date" value="' + ymd(today()) + '"><span class="lbl2">Payment mode</span><select id="pf-mode">' + PAY_MODES.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="de-row"><label for="pf-ref">Reference #</label><div class="de-inline"><input type="text" id="pf-ref" maxlength="120" placeholder="e.g. the bank reference"><span class="lbl2">Deposit to</span><select id="pf-acc"><option value="business">Business account</option></select></div></div>' +
      row('Notes', '<textarea id="pf-notes" rows="2"></textarea>') +
      '<div class="meta" style="margin:4px 0 12px">Balance due on ' + esc(inv.number) + ': <b>' + R2(s.bal) + '</b>. Money held for a client goes through Payments → Trust ledger instead.</div>' +
      (c.email ? '<label class="check" style="font-weight:400"><input type="checkbox" id="pf-thanks" checked> Send a “thank you” note for this payment</label><label class="check" style="font-weight:400;margin-left:26px"><input type="checkbox" checked disabled> ' + esc(c.email) + '</label>' : '<p class="meta">Add an email address to the customer to send a thank-you note with the receipt.</p>') +
      '</form><div class="de-foot"><button class="btn pri" data-act="pay-save" data-id="' + id + '">Save as paid</button><a class="btn" href="#invoice=' + id + '">Cancel</a><span class="msg" id="pf-msg" style="margin-left:8px"></span></div></section></div>';
  }
  P2['pay-save'] = async function (el) {
    var inv = byId(S.invoices, el.dataset.id), s = invState(inv), amt = Number($('pf-amount').value), msg = $('pf-msg');
    if (!(amt > 0)) { msg.textContent = 'Enter the amount received.'; return; }
    if (amt > s.bal + 0.009 && !confirm('That is more than the balance due (' + R2(s.bal) + '). Record it anyway?')) return;
    if (!$('pf-date').value) { msg.textContent = 'Add the payment date.'; return; }
    el.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving…';
    var row = { client_id: inv.client_id, invoice_id: inv.id, matter_id: inv.matter_id || null, amount: amt, bank_charges: Number($('pf-charges').value || 0), received_on: $('pf-date').value, method: $('pf-mode').value, account: 'business', reference: $('pf-ref').value.trim() || null, notes: $('pf-notes').value.trim() || null };
    var r = await sb.from('payments').insert(row).select().single();
    if (r.error) { el.disabled = false; msg.textContent = r.error.message; return; }
    S.payments.unshift(r.data);
    if (inv.status === 'draft') { var u = await sb.from('invoices').update({ status: 'sent' }).eq('id', inv.id).select().single(); if (!u.error) upsertLocal(S.invoices, u.data); }
    var c = byId(S.clients, inv.client_id) || {};
    if ($('pf-thanks') && $('pf-thanks').checked && c.email) {
      msg.textContent = 'Sending the thank-you note…';
      try {
        var x = sendInfo('receipt', r.data.id), pdf = await x.pdf();
        var err = await sendMail({ to: c.email, subject: x.subject, html: mailHtml(x.title, x.msg, x.summary), text: x.msg, attachments: [pdf] });
        if (!err) { var t = await sb.from('payments').update({ thanks_sent_at: new Date().toISOString() }).eq('id', r.data.id).select().single(); if (!t.error) upsertLocal(S.payments, t.data); }
        else toast('Payment saved, but the thank-you note was not sent: ' + err);
      } catch (er) { toast('Payment saved, but the thank-you note was not sent.'); }
    }
    toast('The payment from the customer has been recorded.');
    location.hash = 'invoice=' + inv.id;
  };

  /* ----- Payment receipt: #receipt=paymentId ----- */
  function receiptPage(id) {
    var p = byId(S.payments, id); if (!p) return empty('Payment not found. <a href="#payments">Payments</a>');
    var inv = byId(S.invoices, p.invoice_id);
    return '<div class="split">' + sideList('receipt', id) + '<section class="sdoc"><div class="panel sdoc-h"><div><div class="meta">Payment received</div><h1 style="margin:0">' + (p.number || '') + '</h1></div><div class="sdoc-tools"><button class="btn sm" data-act="rc-edit" data-id="' + id + '">Edit</button><button class="btn sm" data-go="#send=receipt:' + id + '">Send email</button><button class="btn sm" data-act="doc-print" data-kind="receipt" data-id="' + id + '">PDF / Print</button><button class="btn sm" data-act="doc-pdf" data-kind="receipt" data-id="' + id + '">Download PDF</button>' + (inv ? '<a class="btn sm" href="#invoice=' + inv.id + '">Invoice ' + esc(inv.number) + '</a>' : '') + '</div></div>' +
      (p.thanks_sent_at ? '<div class="callout p-green">Thank-you note and receipt sent ' + fmtDT(p.thanks_sent_at) + '.</div>' : '') +
      '<div class="panel" style="padding:0;overflow:hidden">' + frame(receiptHtml(p)) + '</div></section></div>';
  }
  P2['rc-edit'] = function (el) { editPayment(byId(S.payments, el.dataset.id)); };

  /* ----- Routing for the new pages ----- */
  function salesRoute(h) {
    var m = /^(quote|invoice)=(.+)$/.exec(h); if (m) return viewPage(m[1], m[2]);
    m = /^(quote|invoice)-edit=(.+)$/.exec(h); if (m) return editPage(m[1], m[2] === 'new' ? null : m[2]);
    m = /^send=(quote|invoice|receipt):(.+)$/.exec(h); if (m) return sendPage(m[1], m[2]);
    m = /^pay=(.+)$/.exec(h); if (m) return payPage(m[1]);
    m = /^receipt=(.+)$/.exec(h); if (m) return receiptPage(m[1]);
    return null;
  }
  function salesSection(h) { if (/^(receipt=|send=receipt:)/.test(h)) return 'payments'; if (/^(quote|invoice|quote-edit|invoice-edit|pay)=|^send=/.test(h)) return 'quotes'; return null; }

  /* Old entry points now open the new pages */
  editDoc = function (kind, d, preset) { S.draft = null; S.docPreset = preset || null; location.hash = kind + '-edit=' + (d && d.id ? d.id : 'new'); };
  P2['open-doc'] = function (el) { location.hash = el.dataset.kind + '=' + el.dataset.id; };
  P2['new-quote'] = function (el) { if (!S.clients.length) { toast('Add a client first'); } editDoc('quote', null, el.dataset.client ? { client_id: el.dataset.client, matter_id: el.dataset.matter || null } : null); };
  P2['new-invoice'] = function (el) { editDoc('invoice', null, el.dataset.client ? { client_id: el.dataset.client, matter_id: el.dataset.matter || null } : null); };
  P2['quote-to-invoice'] = function (el) {
    var q = byId(S.quotes, el.dataset.id); if (!q) return;
    editDoc('invoice', null, { client_id: q.client_id, matter_id: q.matter_id, quote_id: q.id, order_number: q.reference || '', subject: q.subject, terms: (S.settings && S.settings.invoice_terms) || q.terms, _items: itemsOf('quote', q.id).map(function (i) { return { item_id: i.item_id, description: i.description, details: i.details, qty: i.qty, unit_price: i.unit_price, discount: i.discount, discount_type: i.discount_type }; }) });
  };
  P2['new-payment'] = function (el) { if (el.dataset.invoice) { $('modal-root').innerHTML = ''; location.hash = 'pay=' + el.dataset.invoice; return; } $('modal-root').innerHTML = ''; editPayment(null); };
  var _openPay7 = P2['open-payment'];
  P2['open-payment'] = function (el) { var p = byId(S.payments, el.dataset.id); if (p && p.account === 'business' && p.method !== 'Trust transfer') { location.hash = 'receipt=' + p.id; return; } return _openPay7(el); };
  document.addEventListener('load', function (e) { var f = e.target; if (!f.classList || !f.classList.contains('docframe')) return; try { f.style.height = (f.contentDocument.documentElement.scrollHeight + 4) + 'px'; } catch (er) { /* cross-origin */ } }, true);

  /* =====================================================================
     PHASE 8: share links, paying invoices from trust, defaults for older documents
     ===================================================================== */
  function shareToken() { var a = new Uint8Array(32); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function shareUrl(sh) { return location.origin + '/view#' + sh.token; }
  function activeShare(kind, id) { return (S.shares || []).find(function (s) { return s.kind === kind && s.doc_id === id && !s.revoked && (!s.expires_at || D(s.expires_at) > new Date()); }); }
  function shareDoc(kind, id) {
    if (kind === 'receipt') { var p = byId(S.payments, id); return p ? { html: receiptHtml(p), title: 'Payment receipt ' + (p.number || ''), client_id: p.client_id } : null; }
    var d = byId(kind === 'quote' ? S.quotes : S.invoices, id); return d ? { html: docHtml(kind, d), title: (kind === 'quote' ? 'Quote ' : 'Invoice ') + d.number, client_id: d.client_id } : null;
  }
  async function ensureShare(kind, id, days) {
    var x = shareDoc(kind, id); if (!x) throw new Error('Document not found.');
    var cur = activeShare(kind, id), exp = days ? new Date(Date.now() + days * 864e5).toISOString() : null, r;
    if (cur) { var upd = { html: x.html, title: x.title, updated_at: new Date().toISOString() }; if (days !== undefined) upd.expires_at = exp; r = await sb.from('doc_shares').update(upd).eq('id', cur.id).select('id,token,kind,doc_id,expires_at,revoked,views,last_viewed_at,response,responded_at,responded_name,response_note').single(); }
    else r = await sb.from('doc_shares').insert({ token: shareToken(), kind: kind, doc_id: id, client_id: x.client_id, title: x.title, html: x.html, expires_at: days === undefined ? new Date(Date.now() + 90 * 864e5).toISOString() : exp }).select('id,token,kind,doc_id,expires_at,revoked,views,last_viewed_at,response,responded_at,responded_name,response_note').single();
    if (r.error) throw new Error(r.error.message);
    S.shares = (S.shares || []).filter(function (s) { return s.id !== r.data.id; }); S.shares.unshift(r.data); return r.data;
  }
  function refreshShare(kind, id) { if (activeShare(kind, id)) ensureShare(kind, id).catch(function () {}); }
  function shareDialog(kind, id) {
    var sh = activeShare(kind, id), x = shareDoc(kind, id); if (!x) return;
    var c = byId(S.clients, x.client_id) || {}, url = sh ? shareUrl(sh) : '';
    var info = sh ? '<div class="fld full"><label for="sh-url">Link anyone can open (no sign-in needed)</label><input id="sh-url" readonly value="' + esc(url) + '" onclick="this.select()"></div>' +
      '<div class="full" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="sh-copy">Copy link</button>' + (c.phone ? '<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(String(c.phone).replace(/\D/g, '').replace(/^0/, '27')) + '?text=' + encodeURIComponent('Hello ' + (c.contact_person || c.name || '') + ', you can view your ' + x.title.toLowerCase() + ' here: ' + url) + '">Send by WhatsApp</a>' : '') + '<a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener">Open</a><button type="button" class="btn sm danger" data-act="sh-off" data-kind="' + kind + '" data-id="' + id + '">Disable link</button></div>' +
      '<p class="meta full" style="margin:0">' + (sh.expires_at ? 'Works until ' + fmt(sh.expires_at) : 'Never expires') + ' · Viewed ' + (sh.views || 0) + ' time' + (sh.views === 1 ? '' : 's') + (sh.last_viewed_at ? ', last on ' + fmtDT(sh.last_viewed_at) : '') + (sh.response ? ' · ' + (sh.response === 'accepted' ? 'Accepted' : 'Declined') + ' by ' + esc(sh.responded_name || '') + ' on ' + fmtDT(sh.responded_at) : '') + '</p>' : '<p class="sub full" style="margin:0">Create a private link to this ' + (kind === 'receipt' ? 'receipt' : kind) + '. Your client can view it, print it and download the PDF' + (kind === 'quote' ? ', and accept or decline the quote online' : '') + '. Only people with the link can open it, and it never shows anything else from the CRM.</p>';
    openForm({
      title: 'Share ' + x.title, saveLabel: sh ? 'Update link' : 'Create link',
      fields: [{ k: 'days', label: 'Link expires', type: 'select', options: [['30', 'In 30 days'], ['90', 'In 90 days'], ['365', 'In a year'], ['0', 'Never']] }],
      values: { days: sh && !sh.expires_at ? '0' : '90' }, extra: info,
      save: async function (d) { try { await ensureShare(kind, id, Number(d.days) || 0); } catch (e) { return e.message; } toast(sh ? 'Link updated' : 'Link created'); setTimeout(function () { shareDialog(kind, id); render(); }, 60); }
    });
  }
  P2['doc-share'] = function (el) { shareDialog(el.dataset.kind, el.dataset.id); };
  P2['sh-copy'] = function () { var i = $('sh-url'); navigator.clipboard.writeText(i.value).then(function () { toast('Link copied'); }, function () { i.select(); }); };
  P2['sh-off'] = async function (el) {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Click again to disable'; return; }
    var sh = activeShare(el.dataset.kind, el.dataset.id); if (!sh) return;
    var r = await sb.from('doc_shares').update({ revoked: true }).eq('id', sh.id).select('id,token,kind,doc_id,expires_at,revoked,views,last_viewed_at,response,responded_at,responded_name,response_note').single(); if (r.error) { toast(r.error.message); return; }
    S.shares = S.shares.filter(function (s) { return s.id !== sh.id; }).concat([r.data]); $('modal-root').innerHTML = ''; toast('Link disabled. Anyone opening it now sees “not available”.'); render();
  };

  /* Emails get a “View online” button */
  var _mailHtml = mailHtml;
  mailHtml = function (title, message, summary, link, linkLabel) {
    var h = _mailHtml(title, message, summary);
    if (!link) return h;
    var btn = '<tr><td align="center" style="padding:0 40px 28px"><a href="' + esc(link) + '" style="display:inline-block;background:#16203b;color:#ffffff;text-decoration:none;font:bold 15px Arial,sans-serif;padding:13px 26px;border-radius:6px">' + esc(linkLabel || 'View online') + '</a></td></tr>';
    var i = h.lastIndexOf('<tr><td style="padding:14px 32px;background:#16203b');
    return i < 0 ? h : h.slice(0, i) + btn + h.slice(i);
  };
  var _sendPage = sendPage;
  sendPage = function (kind, id) {
    var h = _sendPage(kind, id);
    var sh = activeShare(kind, id);
    var box = '<label class="check" style="font-weight:400"><input type="checkbox" id="em-link" checked> Include a link to view' + (kind === 'quote' ? ', download and accept the quote' : kind === 'invoice' ? ' and download the invoice' : ' and download the receipt') + ' online' + (sh ? ' (uses the existing link)' : ' (creates a private link that works for 90 days)') + '</label>';
    return h.replace('<p class="meta" style="margin:6px 0 0">The office also gets a copy', box + '<p class="meta" style="margin:6px 0 0">The office also gets a copy');
  };
  P2['em-send'] = async function (el) {
    var kind = el.dataset.kind, id = el.dataset.id, x = sendInfo(kind, id); if (!x) return;
    var out = $('em-msg-out'); el.disabled = true; out.className = 'msg'; out.textContent = 'Preparing…';
    try {
      var link = null;
      if ($('em-link') && $('em-link').checked) { out.textContent = 'Creating the online link…'; link = shareUrl(await ensureShare(kind, id)); }
      var att = [];
      if ($('em-pdf').checked) { out.textContent = 'Making the PDF…'; att.push(await x.pdf()); }
      if ($('em-stmt') && $('em-stmt').checked) att.push(await x.statement());
      out.textContent = 'Sending…';
      var label = kind === 'quote' ? 'View and accept the quote' : kind === 'invoice' ? 'View invoice' : 'View receipt';
      var err = await sendMail({ to: $('em-to').value, cc: $('em-cc').value, subject: $('em-subject').value.trim(), html: mailHtml(x.title, $('em-msg').value, x.summary, link, label), text: $('em-msg').value + (link ? '\n\n' + label + ': ' + link : ''), attachments: att });
      if (err) { out.textContent = err; el.disabled = false; return; }
    } catch (er) { out.textContent = er.message || 'Could not send.'; el.disabled = false; return; }
    var now = new Date().toISOString(), r;
    if (kind === 'quote') { r = await sb.from('quotes').update({ status: x.rec.status === 'draft' ? 'sent' : x.rec.status, sent_at: now }).eq('id', id).select().single(); if (!r.error) upsertLocal(S.quotes, r.data); }
    if (kind === 'invoice') { r = await sb.from('invoices').update({ status: x.rec.status === 'draft' ? 'sent' : x.rec.status, sent_at: now }).eq('id', id).select().single(); if (!r.error) upsertLocal(S.invoices, r.data); }
    if (kind === 'receipt') { r = await sb.from('payments').update({ thanks_sent_at: now }).eq('id', id).select().single(); if (!r.error) upsertLocal(S.payments, r.data); }
    if (kind !== 'receipt') refreshShare(kind, id);
    toast(kind === 'quote' ? 'Your quote has been sent.' : kind === 'invoice' ? 'Your invoice has been sent.' : 'The payment receipt has been sent.');
    location.hash = x.back.slice(1);
  };

  /* View pages: Share button and link status */
  var _viewPage = viewPage;
  viewPage = function (kind, id) {
    var h = _viewPage(kind, id), sh = activeShare(kind, id), all = (S.shares || []).filter(function (s) { return s.kind === kind && s.doc_id === id && s.response; })[0];
    h = h.replace('<button class="btn sm" data-act="doc-print" data-kind="' + kind + '" data-id="' + id + '">PDF / Print</button>', '<button class="btn sm" data-act="doc-share" data-kind="' + kind + '" data-id="' + id + '">Share</button><button class="btn sm" data-act="doc-print" data-kind="' + kind + '" data-id="' + id + '">PDF / Print</button>');
    var note = (all ? '<div class="callout ' + (all.response === 'accepted' ? 'p-green' : 'p-red') + '">' + (all.response === 'accepted' ? 'Accepted' : 'Declined') + ' online by <b>' + esc(all.responded_name || '') + '</b> on ' + fmtDT(all.responded_at) + (all.response_note ? ': “' + esc(all.response_note) + '”' : '') + '</div>' : '') +
      (sh ? '<div class="callout">Shared online · viewed ' + (sh.views || 0) + ' time' + (sh.views === 1 ? '' : 's') + (sh.last_viewed_at ? ', last ' + fmtDT(sh.last_viewed_at) : '') + ' · <a href="#" data-act="doc-share" data-kind="' + kind + '" data-id="' + id + '">Manage link</a></div>' : '');
    return note ? h.replace('<div class="panel" style="padding:0;overflow:hidden"><iframe', note + '<div class="panel" style="padding:0;overflow:hidden"><iframe') : h;
  };
  var _receiptPage = receiptPage;
  receiptPage = function (id) { return _receiptPage(id).replace('<button class="btn sm" data-act="doc-print" data-kind="receipt"', '<button class="btn sm" data-act="doc-share" data-kind="receipt" data-id="' + id + '">Share</button><button class="btn sm" data-act="doc-print" data-kind="receipt"'); };

  /* Keep shared copies up to date */
  var _deSave = P2['de-save'];
  P2['de-save'] = async function (el) { var dr = S.draft; await _deSave(el); if (dr && dr.id) refreshShare(dr.kind, dr.id); };
  ['quote-mark', 'mark-sent', 'inv-void'].forEach(function (k) { var f = P2[k]; P2[k] = async function (el) { await f(el); var id = el.dataset.id; refreshShare(k === 'quote-mark' ? 'quote' : 'invoice', id); }; });

  /* Older documents pick up today’s defaults when opened for editing */
  var _startDraft = startDraft;
  startDraft = function (kind, id) {
    _startDraft(kind, id);
    if (!id || !S.draft) return;
    var d = S.draft.doc, st = S.settings || {};
    if (!d.terms) d.terms = (kind === 'quote' ? st.quote_terms : st.invoice_terms) || '';
    if (d.notes == null) d.notes = (kind === 'quote' ? st.quote_notes : st.invoice_notes) || '';
    if (!d.subject && d.matter_id) { var m = byId(S.matters, d.matter_id); if (m) d.subject = m.title; }
    if (kind === 'invoice' && !d.payment_terms) { var n = d.due_date && d.issue_date ? Math.round((D(d.due_date) - D(d.issue_date)) / 864e5) : null; var t = TERMS.find(function (x) { return x[2] === n; }); d.payment_terms = t ? t[0] : (d.due_date ? 'custom' : 'net14'); }
    if (!d.attorney_email && d.matter_id) { var mm = byId(S.matters, d.matter_id); if (mm && mm.assigned_email) d.attorney_email = mm.assigned_email; }
  };

  /* Record payment: pay from the client’s trust balance */
  var _payPage = payPage;
  payPage = function (id) {
    var inv = byId(S.invoices, id); var h = _payPage(id); if (!inv) return h;
    var tb = trustBal(inv.client_id);
    h = h.replace('<select id="pf-acc"><option value="business">Business account</option></select>', '<select id="pf-acc"><option value="business">Business account (paid by the client)</option>' + (tb > 0 ? '<option value="trust">From trust: ' + esc(R2(tb)) + ' held for this client</option>' : '') + '</select>');
    return h.replace('Money held for a client goes through Payments → Trust ledger instead.', tb > 0 ? 'This client has ' + R2(tb) + ' in trust. Choose “From trust” under Deposit to, and the money moves from the trust ledger to settle this invoice.' : 'To pay this invoice from money held in trust, first record the trust deposit under Payments.');
  };
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'pf-acc') return;
    var tr = e.target.value === 'trust', inv = byId(S.invoices, (location.hash.match(/pay=(.+)$/) || [])[1]); if (!inv) return;
    ['pf-mode', 'pf-charges'].forEach(function (k) { $(k).disabled = tr; });
    if (tr) { $('pf-amount').value = Math.min(trustBal(inv.client_id), invState(inv).bal).toFixed(2); $('pf-charges').value = ''; }
    else $('pf-amount').value = invState(inv).bal.toFixed(2);
  });
  var _paySave = P2['pay-save'];
  P2['pay-save'] = async function (el) {
    var inv = byId(S.invoices, el.dataset.id);
    if (!$('pf-acc') || $('pf-acc').value !== 'trust') { await _paySave(el); if (inv) refreshShare('invoice', inv.id); return; }
    var s = invState(inv), amt = Number($('pf-amount').value), tb = trustBal(inv.client_id), msg = $('pf-msg');
    if (!(amt > 0)) { msg.textContent = 'Enter the amount to transfer.'; return; }
    if (amt > tb + 0.009) { msg.textContent = 'Only ' + R2(tb) + ' is held in trust for this client.'; return; }
    if (amt > s.bal + 0.009) { msg.textContent = 'The balance due is only ' + R2(s.bal) + '.'; return; }
    el.disabled = true; msg.className = 'msg'; msg.textContent = 'Transferring from trust…';
    var r = await sb.rpc('trust_transfer', { p_client: inv.client_id, p_invoice: inv.id, p_amount: amt, p_date: $('pf-date').value, p_notes: [$('pf-ref').value.trim(), $('pf-notes').value.trim()].filter(Boolean).join(' · ') || null });
    if (r.error) { el.disabled = false; msg.textContent = r.error.message; return; }
    await refreshMoney();
    if (inv.status === 'draft') { var u = await sb.from('invoices').update({ status: 'sent' }).eq('id', inv.id).select().single(); if (!u.error) upsertLocal(S.invoices, u.data); }
    var entry = byId(S.trust, r.data), pay = entry && byId(S.payments, entry.payment_id), c = byId(S.clients, inv.client_id) || {};
    if (pay && $('pf-thanks') && $('pf-thanks').checked && c.email) {
      msg.textContent = 'Sending the receipt…';
      try { var x = sendInfo('receipt', pay.id), pdf = await x.pdf(); var err = await sendMail({ to: c.email, subject: x.subject, html: mailHtml(x.title, x.msg.replace('Thank you for your payment.', 'We have settled invoice ' + inv.number + ' from the money you hold in our trust account.'), x.summary), text: x.msg, attachments: [pdf] }); if (!err) { var t = await sb.from('payments').update({ thanks_sent_at: new Date().toISOString() }).eq('id', pay.id).select().single(); if (!t.error) upsertLocal(S.payments, t.data); } }
      catch (er) { toast('Transfer saved, but the receipt was not sent.'); }
    }
    refreshShare('invoice', inv.id);
    toast(R2(amt) + ' transferred from trust to invoice ' + inv.number + '.');
    location.hash = 'invoice=' + inv.id;
  };
  var _rcEdit = P2['rc-edit'];
  P2['rc-edit'] = function (el) { var p = byId(S.payments, el.dataset.id); if (p && p.method === 'Trust transfer') { toast('This payment came from trust. To undo it, reverse it in Payments → Trust ledger.'); return; } return _rcEdit(el); };
  var _openPay8 = P2['open-payment'];
  P2['open-payment'] = function (el) { var p = byId(S.payments, el.dataset.id); if (p && p.method === 'Trust transfer' && p.invoice_id) { location.hash = 'receipt=' + p.id; return; } return _openPay8(el); };

  /* =====================================================================
     PHASE 9: labour-law pipeline templates (boards per type of matter)
     ===================================================================== */
  function pipe(key) { return (S.pipes || []).find(function (p) { return p.key === key; }); }
  function pipeStages(p) { return (p && p.stages || []).map(function (s) { return s.name; }); }
  function stageOf(m, p) { var names = pipeStages(p); return names.indexOf(m.pipeline_stage) >= 0 ? m.pipeline_stage : names[0]; }
  function daysSince(t) { return t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 864e5)) : 0; }
  async function reloadTasks(mid) { var r = await sb.from('tasks').select('*').eq('matter_id', mid); if (!r.error) { S.tasks = S.tasks.filter(function (t) { return t.matter_id !== mid; }).concat(r.data); } }
  async function moveMatter(m, key, stage) {
    var before = S.tasks.filter(function (t) { return t.matter_id === m.id; }).length;
    var r = await sb.from('matters').update({ pipeline: key || null, pipeline_stage: key ? (stage || null) : null }).eq('id', m.id).select().single();
    if (r.error) { toast(r.error.message); return; }
    upsertLocal(S.matters, r.data); await reloadTasks(m.id);
    var added = S.tasks.filter(function (t) { return t.matter_id === m.id; }).length - before;
    toast(key ? r.data.ref + ' moved to ' + r.data.pipeline_stage + (added > 0 ? ' · ' + added + ' task' + (added === 1 ? '' : 's') + ' added' : '') : r.data.ref + ' removed from the pipeline');
    render();
  }

  /* ----- Pipeline page: Enquiries + one board per template ----- */
  var _pipeBase = V.pipeline;
  function pipeTabs(sel) {
    var open = S.matters.filter(function (m) { return m.stage !== 'Closed'; });
    return '<div class="subtabs" style="flex-wrap:wrap">' + [['enquiries', 'Enquiries', S.leads.filter(function (l) { return l.status !== 'closed' && l.status !== 'client'; }).length]].concat((S.pipes || []).filter(function (p) { return p.active; }).map(function (p) { return [p.key, p.name, open.filter(function (m) { return m.pipeline === p.key; }).length]; })).map(function (x) { return '<button data-pipe="' + x[0] + '" class="' + (x[0] === sel ? 'on' : '') + '">' + esc(x[1]) + ' <span class="meta">' + x[2] + '</span></button>'; }).join('') + '</div>';
  }
  V.pipeline = function () {
    var sel = S.ui.pipe || 'enquiries', p = pipe(sel);
    if (!p) { var h = _pipeBase(); var i = h.indexOf('<div class="board">'); return i < 0 ? h : h.slice(0, i) + pipeTabs('enquiries') + h.slice(i); }
    var stages = pipeStages(p), ms = S.matters.filter(function (m) { return m.pipeline === p.key && (S.ui.pipeShowClosed || m.stage !== 'Closed'); });
    var col = function (name, i) {
      var here = ms.filter(function (m) { return stageOf(m, p) === name; });
      var st = p.stages[i] || {};
      return '<div class="col" data-mdrop="' + esc(name) + '"><h3><span title="' + esc((st.tasks || []).map(function (t) { return '• ' + t.title; }).join('\n')) + '">' + esc(name) + '</span><span>' + here.length + '</span></h3>' +
        here.map(function (m) {
          var open = S.tasks.filter(function (t) { return t.matter_id === m.id && t.status === 'open'; }), late = open.filter(function (t) { return t.due_date && daysLeft(t.due_date) < 0; }).length, d = daysSince(m.pipeline_moved_at);
          var who = S.staff.find(function (s) { return s.email === m.assigned_email; });
          return '<button class="card" draggable="true" data-mdrag="' + m.id + '" data-matter="' + m.id + '"><span class="mono meta">' + esc(m.ref) + '</span><b>' + esc(m.title) + '</b><span class="meta">' + esc(clientName(m.client_id)) + '</span>' +
            '<span class="meta" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px"><span title="Days in this stage">' + d + 'd</span>' + (open.length ? '<span>' + open.length + ' task' + (open.length === 1 ? '' : 's') + '</span>' : '') + (late ? '<span style="color:var(--red)">' + late + ' late</span>' : '') + (m.next_date ? '<span>' + fmt(m.next_date) + '</span>' : '') + (who ? '<span>' + esc((who.full_name || who.email).split(' ')[0]) + '</span>' : '') + '</span></button>';
        }).join('') + (st.tasks && st.tasks.length ? '<span class="meta" style="margin-top:auto;font-size:11.5px">' + st.tasks.length + ' task' + (st.tasks.length === 1 ? '' : 's') + ' added on entry</span>' : '') + '</div>';
    };
    return head('Pipeline', esc(p.name), esc(p.description || '') + ' Drag a matter to the next stage: its tasks are added automatically for the responsible attorney.', '<button class="btn pri" data-act="pipe-new-matter" data-key="' + p.key + '">New matter</button><button class="btn" data-act="pipe-add" data-key="' + p.key + '">Add existing matter</button>') +
      pipeTabs(sel) +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:4px 0 10px;flex-wrap:wrap"><span class="meta">' + ms.length + ' matter' + (ms.length === 1 ? '' : 's') + ' · hover a column title to see its tasks</span><label class="check" style="font-weight:400"><input type="checkbox" id="pipe-closed"' + (S.ui.pipeShowClosed ? ' checked' : '') + '> Show closed matters</label></div>' +
      '<div class="board">' + stages.map(col).join('') + '</div>';
  };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-pipe]'); if (!b) return; S.ui.pipe = b.dataset.pipe; render(); });
  document.addEventListener('change', function (e) { if (e.target.id === 'pipe-closed') { S.ui.pipeShowClosed = e.target.checked; render(); } });
  document.addEventListener('dragstart', function (e) { var c = e.target.closest && e.target.closest('[data-mdrag]'); if (!c) return; e.dataTransfer.setData('text/matter', c.dataset.mdrag); e.dataTransfer.effectAllowed = 'move'; c.style.opacity = '.5'; });
  document.addEventListener('dragend', function (e) { var c = e.target.closest && e.target.closest('[data-mdrag]'); if (c) c.style.opacity = ''; document.querySelectorAll('[data-mdrop]').forEach(function (x) { x.style.outline = ''; }); });
  document.addEventListener('dragover', function (e) { var c = e.target.closest && e.target.closest('[data-mdrop]'); if (!c || !Array.prototype.includes.call(e.dataTransfer.types, 'text/matter')) return; e.preventDefault(); document.querySelectorAll('[data-mdrop]').forEach(function (x) { x.style.outline = x === c ? '2px dashed var(--accent)' : ''; }); });
  document.addEventListener('drop', function (e) { var c = e.target.closest && e.target.closest('[data-mdrop]'); if (!c) return; var id = e.dataTransfer.getData('text/matter'); if (!id) return; e.preventDefault(); c.style.outline = ''; var m = byId(S.matters, id); if (m && stageOf(m, pipe(m.pipeline)) !== c.dataset.mdrop) moveMatter(m, m.pipeline, c.dataset.mdrop); });
  P2['pipe-add'] = function (el) {
    var p = pipe(el.dataset.key), cand = S.matters.filter(function (m) { return m.pipeline !== p.key && m.stage !== 'Closed'; });
    if (!cand.length) { toast('Every open matter is already in this pipeline.'); return; }
    openForm({ title: 'Add a matter to ' + p.name, saveLabel: 'Add', fields: [{ k: 'matter_id', label: 'Matter', type: 'select', req: true, full: true, options: cand.map(function (m) { return [m.id, m.ref + ' · ' + m.title + (m.pipeline && pipe(m.pipeline) ? ' (now in ' + pipe(m.pipeline).name + ')' : '')]; }) }, { k: 'stage', label: 'Start at stage', type: 'select', full: true, options: pipeStages(p) }],
      values: { stage: pipeStages(p)[0] }, save: async function (d) { var m = byId(S.matters, d.matter_id); setTimeout(function () { moveMatter(m, p.key, d.stage); }, 30); } });
  };
  P2['pipe-new-matter'] = function (el) {
    var p = pipe(el.dataset.key), rx = p && p.dispute_match ? new RegExp(p.dispute_match, 'i') : null;
    var dt = rx ? DISPUTES.find(function (x) { return rx.test(x); }) : null;
    editMatter(null, dt ? { dispute_type: dt } : null);
  };

  /* ----- Matter page: pipeline strip ----- */
  var _matterDetail = matterDetail;
  matterDetail = function (m) {
    S.tasksChecked = S.tasksChecked || {}; if (!S.tasksChecked[m.id]) { S.tasksChecked[m.id] = 1; reloadTasks(m.id).then(function () { if (location.hash === '#matter=' + m.id) render(); }); }
    var h = _matterDetail(m), p = pipe(m.pipeline), cur = p ? stageOf(m, p) : null, ci = p ? pipeStages(p).indexOf(cur) : -1;
    var strip = '<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><span class="meta">Pipeline' + (p ? ' · in this stage ' + daysSince(m.pipeline_moved_at) + ' day' + (daysSince(m.pipeline_moved_at) === 1 ? '' : 's') : '') + '</span><select data-mpipe="' + m.id + '" style="max-width:300px"><option value="">Not in a pipeline</option>' + (S.pipes || []).filter(function (x) { return x.active || x.key === m.pipeline; }).map(function (x) { return '<option value="' + x.key + '"' + (x.key === m.pipeline ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
      (p ? '<div class="steps">' + pipeStages(p).map(function (s, i) { return '<button data-mpstage="' + esc(s) + '" data-id="' + m.id + '" class="' + (i < ci ? 'done' : i === ci ? 'now' : '') + '" title="' + esc(((p.stages[i] || {}).tasks || []).map(function (t) { return '• ' + t.title; }).join('\n')) + '">' + esc(s) + '</button>'; }).join('') + '</div>' + (ci < pipeStages(p).length - 1 ? '<div class="meta" style="margin-top:8px">Next: <b>' + esc(pipeStages(p)[ci + 1]) + '</b>' + (((p.stages[ci + 1] || {}).tasks || []).length ? ' adds ' + p.stages[ci + 1].tasks.map(function (t) { return esc(t.title); }).join('; ') : '') + '</div>' : '') : '<div class="meta">Choose a pipeline to track this matter on a board and add each stage’s tasks automatically.</div>') + '</div>';
    var i = h.indexOf('<div class="panel"><div class="tabs" role="tablist">');
    return i < 0 ? h : h.slice(0, i) + strip + h.slice(i);
  };
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-mpstage]'); if (!b) return; var m = byId(S.matters, b.dataset.id); if (!m || b.classList.contains('now')) return; moveMatter(m, m.pipeline, b.dataset.mpstage); });
  document.addEventListener('change', function (e) { var s = e.target.dataset && e.target.dataset.mpipe; if (!s) return; var m = byId(S.matters, s); if (m) moveMatter(m, e.target.value || null, null); });

  /* ----- Company settings → Pipelines: edit the templates ----- */
  function stagesToText(p) { return (p.stages || []).map(function (s) { return s.name + ((s.tasks || []).length ? ': ' + s.tasks.map(function (t) { return t.title + ' (' + (t.days == null ? 7 : t.days) + ')'; }).join('; ') : ''); }).join('\n'); }
  function textToStages(txt) {
    return txt.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var i = l.indexOf(':'), name = (i < 0 ? l : l.slice(0, i)).trim().slice(0, 80), rest = i < 0 ? '' : l.slice(i + 1);
      var tasks = rest.split(';').map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) { var mm = /\((\d{1,3})\)\s*$/.exec(t); return { title: (mm ? t.slice(0, mm.index) : t).trim().slice(0, 250), days: mm ? Number(mm[1]) : 7 }; }).filter(function (t) { return t.title; });
      return { name: name, tasks: tasks };
    }).filter(function (s) { return s.name; });
  }
  function pipelinesSettings() {
    var can = isPartner();
    return '<div class="panel"><div class="hd"><h2>Pipeline templates</h2>' + (can ? '<button class="btn pri" data-act="pipe-tpl-new">New template</button>' : '') + '</div><p class="sub" style="margin:0 0 12px">Each template is a board on the Pipeline page. New matters are placed in the template that matches their type, and each stage adds its tasks when a matter arrives there.</p><div class="tbl"><table><tr><th>Template</th><th>Stages</th><th>Tasks</th><th>Open matters</th><th>Status</th></tr>' +
      (S.pipes || []).map(function (p) { var n = (p.stages || []).reduce(function (s, x) { return s + (x.tasks || []).length; }, 0); return '<tr class="click" data-act="pipe-tpl-edit" data-key="' + p.key + '"><td><b>' + esc(p.name) + '</b><div class="meta">' + esc(p.description || '') + '</div></td><td class="mono">' + (p.stages || []).length + '</td><td class="mono">' + n + '</td><td class="mono">' + S.matters.filter(function (m) { return m.pipeline === p.key && m.stage !== 'Closed'; }).length + '</td><td>' + (p.active ? pill('Active', 'p-green') : pill('Hidden', '')) + '</td></tr>'; }).join('') + '</table></div></div>';
  }
  function editPipe(p) {
    var isNew = !p, can = isPartner();
    openForm({
      title: isNew ? 'New pipeline template' : p.name, saveLabel: can ? 'Save template' : 'Close',
      fields: [{ k: 'name', label: 'Name', req: true }, { k: 'active', label: 'Show on the Pipeline page', type: 'checkbox' }, { k: 'description', label: 'Description', full: true }, { k: 'dispute_match', label: 'Matter types it applies to', full: true, hint: 'Words from the “Type of matter” list, separated by | (for example: dismissal|constructive). New matters of that type start in this pipeline.' }, { k: 'stages_text', label: 'Stages and tasks', type: 'textarea', full: true, req: true, hint: 'One stage per line. After a colon, list the tasks separated by semicolons, with the days until each is due in brackets. Example: Referral filed: Draft LRA Form 7.11 (3); File with the CCMA (4)' }],
      values: p ? Object.assign({}, p, { stages_text: stagesToText(p) }) : { active: true, stages_text: 'Intake: Get the documents (2)\nIn progress\nClosed: Send the final invoice (3)' },
      save: async function (d) {
        if (!can) return;
        var stages = textToStages(d.stages_text); if (stages.length < 2) return 'Add at least two stages.';
        var names = stages.map(function (s) { return s.name.toLowerCase(); }); if (names.some(function (n, i) { return names.indexOf(n) !== i; })) return 'Two stages have the same name.';
        if (d.dispute_match) { try { new RegExp(d.dispute_match, 'i'); } catch (er) { return 'Check the matter types: use words separated by |.'; } }
        var row = { name: d.name.trim(), description: d.description || null, dispute_match: d.dispute_match ? d.dispute_match.toLowerCase().trim() : null, active: !!d.active, stages: stages };
        var r;
        if (isNew) { row.key = (d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'pipe') + '_' + Math.random().toString(36).slice(2, 6); row.sort = 100 + (S.pipes || []).length; r = await sb.from('pipeline_templates').insert(row).select().single(); }
        else {
          var gone = pipeStages(p).filter(function (n) { return !stages.some(function (s) { return s.name === n; }); });
          var stranded = S.matters.filter(function (m) { return m.pipeline === p.key && gone.indexOf(m.pipeline_stage) >= 0; });
          if (stranded.length && !confirm(stranded.length + ' matter' + (stranded.length === 1 ? ' is' : 's are') + ' in a stage you removed or renamed. They will show in the first stage. Save anyway?')) return 'Not saved.';
          r = await sb.from('pipeline_templates').update(row).eq('key', p.key).select().single();
        }
        if (r.error) return dbErr(r);
        S.pipes = S.pipes.filter(function (x) { return x.key !== r.data.key; }).concat([r.data]); S.pipes.sort(function (a, b) { return a.sort - b.sort; }); toast('Template saved'); render();
      },
      del: isNew || !can ? null : async function () { var r = await sb.from('pipeline_templates').delete().eq('key', p.key); if (r.error) return dbErr(r); S.pipes = S.pipes.filter(function (x) { return x.key !== p.key; }); S.matters.forEach(function (m) { if (m.pipeline === p.key) { m.pipeline = null; m.pipeline_stage = null; } }); toast('Template deleted. Its matters are no longer on a board.'); render(); }
    });
  }
  P2['pipe-tpl-new'] = function () { editPipe(null); };
  P2['pipe-tpl-edit'] = function (el) { editPipe(pipe(el.dataset.key)); };

  /* ----- Shell: popovers, theme, sidebar ----- */
  function popover(html, anchor, cls) {
    closePop();
    var el = document.createElement('div'); el.id = 'pop'; el.className = 'pop ' + (cls || ''); el.innerHTML = html; document.body.appendChild(el);
    if (anchor) { var r = anchor.getBoundingClientRect(), w = el.offsetWidth; var left = Math.min(Math.max(12, r.right - w), window.innerWidth - w - 12); if (r.left < 300 && anchor.id !== 'avatar-btn') left = Math.max(12, r.left); el.style.left = left + 'px'; el.style.right = 'auto'; el.style.top = (r.bottom + 10 > window.innerHeight - 200 ? Math.max(12, r.top - el.offsetHeight - 10) : r.bottom + 10) + 'px'; el.style.transformOrigin = r.left < 300 ? 'bottom left' : 'top right'; }
    return el;
  }
  function menuItem(ic, label, attrs, sub) { return '<button class="hit" ' + attrs + '><span class="ic">' + icon(ic, 16) + '</span><span style="flex:1;min-width:0"><b style="display:block;font-weight:600">' + label + '</b>' + (sub ? '<span class="meta">' + sub + '</span>' : '') + '</span></button>'; }
  $('btn-new').addEventListener('click', function (e) {
    e.stopPropagation();
    if ($('pop') && $('pop').dataset.kind === 'new') { closePop(); return; }
    var p = popover(menuItem('inbox', 'Enquiry', 'data-act="new-lead"', 'Phone, WhatsApp or walk-in') + menuItem('users', 'Client', 'data-act="new-client"') + menuItem('brief', 'Matter', 'data-act="new-matter"') + menuItem('task', 'Task', 'data-act="new-task"') + menuItem('cal', 'Appointment', 'data-act="new-appt"') + menuItem('gavel', 'Disciplinary hearing', 'data-act="new-hearing"') + '<hr>' + menuItem('doc', 'Invoice', 'data-act="new-invoice"') + menuItem('doc', 'Quote', 'data-act="new-quote"') + menuItem('wallet', 'Payment', 'data-act="new-payment"') + menuItem('upload', 'Upload files', 'data-act="upload"'), this, 'menu');
    p.dataset.kind = 'new';
  });
  function accountMenu(anchor) {
    if ($('pop') && $('pop').dataset.kind === 'acct') { closePop(); return; }
    var dark = document.documentElement.dataset.theme !== 'light';
    var p = popover('<div style="display:flex;gap:10px;align-items:center;padding:10px 12px 8px"><span class="avatar">' + esc(initials()) + '</span><span style="min-width:0"><b style="display:block">' + esc((S.me && S.me.full_name) || (S.user && S.user.email) || '') + '</b><span class="meta">' + esc(S.user ? S.user.email : '') + '</span></span></div><hr>' +
      menuItem('sun', 'My work', 'data-go="#mywork"') + menuItem(dark ? 'sun' : 'moon', dark ? 'Light theme' : 'Dark theme', 'data-shell="theme"') + menuItem('side', document.documentElement.classList.contains('mini') ? 'Expand sidebar' : 'Collapse sidebar', 'data-shell="side"') + menuItem('key', 'Set password', 'data-shell="pw"') + menuItem('shield', 'Two-step sign-in', 'data-shell="mfa"') + menuItem('cog', 'Company settings', 'data-go="#settings"') + '<hr>' + menuItem('out', 'Sign out', 'data-shell="out"'), anchor, 'menu');
    p.dataset.kind = 'acct';
  }
  $('avatar-btn').addEventListener('click', function (e) { e.stopPropagation(); accountMenu(this); });
  $('me-card').addEventListener('click', function (e) { e.stopPropagation(); accountMenu(this); });
  $('search-pill').addEventListener('click', function () { openPalette(); });
  function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('lla_theme', t); } catch (e) {} $('theme-ic').innerHTML = ICONS[t === 'light' ? 'moon' : 'sun']; }
  $('theme-btn').addEventListener('click', function () { setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); });
  function toggleSide() { var on = document.documentElement.classList.toggle('mini'); try { localStorage.setItem('lla_side', on ? 'mini' : 'full'); } catch (e) {} }
  $('collapse').addEventListener('click', toggleSide);
  $('menu-btn').addEventListener('click', function (e) { e.stopPropagation(); document.documentElement.classList.toggle('side-open'); });
  document.addEventListener('click', function (e) { if (document.documentElement.classList.contains('side-open') && !e.target.closest('#side,#menu-btn')) document.documentElement.classList.remove('side-open'); if (e.target.closest('#nav a')) document.documentElement.classList.remove('side-open'); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-shell]'); if (!b) return; closePop();
    var a = b.dataset.shell;
    if (a === 'theme') setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    if (a === 'side') toggleSide();
    if (a === 'pw') $('setpw').click();
    if (a === 'mfa') mfaSetup();
    if (a === 'out') $('logout').click();
  });
  if (/Mac|iPhone|iPad/.test(navigator.platform || '') === false) $('kbd-k').textContent = 'Ctrl K';
  setTheme(document.documentElement.dataset.theme || 'dark');
  function initials() { var n = (S.me && S.me.full_name) || (S.user && S.user.email) || 'LL'; var p = n.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean); return ((p[0] || 'L')[0] + ((p[1] || p[0] || 'L')[0] || '')).toUpperCase(); }

  /* ----- Page chrome: breadcrumb, next-up card, enter motion, count-up ----- */
  var SECTION = {}; NAV.forEach(function (x) { if (x.id) SECTION[x.id] = x.label; });
  function greet() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function drawCrumbs() {
    var h = location.hash.slice(1), cur = current(), parts = [];
    parts.push('<span class="hide-sm">' + greet() + ((S.me && S.me.full_name) ? ', ' + esc(S.me.full_name.split(' ')[0]) : '') + '</span>');
    parts.push('<a href="#' + cur + '">' + esc(SECTION[cur] || 'Dashboard') + '</a>');
    if (h.indexOf('matter=') === 0) { var m = byId(S.matters, h.slice(7)); if (m) parts.push('<b>' + esc(m.ref) + '</b>'); }
    else if (h.indexOf('client=') === 0) { var c = byId(S.clients, h.slice(7)); if (c) parts.push('<b>' + esc(c.name) + '</b>'); }
    else { var tabKey = { dashboard: 'dashTab', inbox: 'inboxTab', quotes: 'qTab', website: 'wTab', settings: 'sTab', documents: 'dTab', mywork: 'mwTab' }[cur]; var tv = tabKey && S.ui[tabKey]; parts[parts.length - 1] = '<b>' + esc(SECTION[cur] || 'Dashboard') + '</b>'; if (tv) parts.push('<span>' + esc(tv) + '</span>'); }
    $('crumbs').innerHTML = parts.join('<span class="sep">›</span>');
  }
  function drawNextUp() {
    var nx = agenda().filter(function (d) { return d.date >= new Date(Date.now() - 30 * 60000) || (d.left >= 0 && !/\d:\d/.test(d.what)); }).filter(function (d) { return d.left >= 0; })[0];
    var el = $('nextup');
    if (!nx) { el.innerHTML = '<span class="sw-ic">' + icon('task', 18) + '</span><span class="sw-t"><small>Next up</small><b>Nothing scheduled</b></span>'; el.onclick = function () { location.hash = 'mywork'; }; return; }
    var when = nx.left === 0 ? (/·\s*\d\d:\d\d/.test(nx.what) ? 'Today ' + (nx.what.match(/(\d\d:\d\d)/) || [''])[0] : 'Today') : nx.left === 1 ? 'Tomorrow' : 'In ' + nx.left + ' days';
    el.innerHTML = '<span class="sw-ic">' + icon(nx.kind === 'Hearing' ? 'gavel' : /Time limit|Deadline|Compliance/.test(nx.kind) ? 'clock' : nx.kind === 'Task' ? 'task' : 'cal', 18) + '</span><span class="sw-t"><small>Next up · ' + esc(when) + '</small><b>' + esc(nx.what.replace(/ · \d\d:\d\d.*/, '')) + '</b></span>';
    el.onclick = function () { location.hash = nx.matter ? 'matter=' + nx.matter : 'deadlines'; };
  }
  function countUp(root) {
    root.querySelectorAll('.stat b, .ring .lab b').forEach(function (b) {
      var txt = b.textContent, m = txt.match(/^(.*?)(-?[\d\s]*\d(?:[.,]\d+)?)(.*)$/);
      if (!m) return;
      var raw = m[2].replace(/\s/g, ''), target = parseFloat(raw.replace(',', '.')); if (!isFinite(target) || target === 0) return;
      var dec = (raw.split(/[.,]/)[1] || '').length, pre = m[1], post = m[3], t0 = performance.now(), dur = 900;
      var fmtN = function (v) { var s = v.toFixed(dec); var parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return parts.join('.'); };
      (function step(now) { var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = pre + fmtN(target * e) + post; if (k < 1) requestAnimationFrame(step); else b.textContent = txt; })(t0);
    });
    root.querySelectorAll('.ring .val').forEach(function (c) { var target = c.getAttribute('data-off'); requestAnimationFrame(function () { requestAnimationFrame(function () { c.style.strokeDashoffset = target; }); }); });
  }
  function ring(pct, big, small) { var r = 40, cc = 2 * Math.PI * r, off = cc * (1 - Math.max(0, Math.min(1, pct))); return '<div class="ring"><svg width="96" height="96" viewBox="0 0 96 96"><circle class="trk" cx="48" cy="48" r="' + r + '"/><circle class="val" cx="48" cy="48" r="' + r + '" stroke-dasharray="' + cc.toFixed(1) + '" stroke-dashoffset="' + cc.toFixed(1) + '" data-off="' + off.toFixed(1) + '"/></svg><div class="lab"><span><b>' + big + '</b><small>' + small + '</small></span></div></div>'; }
  var lastRoute = null;
  function afterRender() {
    logAccess();
    var v = $('view'), route = location.hash.split('&')[0];
    drawCrumbs(); drawNextUp();
    var av = initials(); $('me-av').textContent = av; $('avatar-btn').textContent = av;
    $('me-name').textContent = (S.me && S.me.full_name) || (S.user && S.user.email.split('@')[0]) || 'Staff';
    $('me-role').textContent = S.me && S.me.role ? roleLabelShort(S.me.role) : (S.user ? S.user.email : '');
    if (route !== lastRoute) { lastRoute = route; v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); countUp(v); window.scrollTo({ top: 0 }); }
    else v.querySelectorAll('.ring .val').forEach(function (c) { c.style.strokeDashoffset = c.getAttribute('data-off'); });
  }

  /* ----- Notifications ----- */
  function unseen() { var seen = S.me && S.me.last_seen_activity ? D(S.me.last_seen_activity) : new Date(0); return S.activity.filter(function (a) { return D(a.at) > seen && (a.actor || '').toLowerCase() !== myEmail(); }); }
  function updateBell() { var n = unseen().length, b = $('bell-n'); b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n); }
  function showBell() {
    var u = unseen(), ids = u.map(function (a) { return a.id; });
    var list = S.activity.slice(0, 40);
    var bellHtml = '<div class="ph"><b>Notifications</b><span style="display:flex;gap:8px;align-items:center"><span class="meta">' + u.length + ' new</span>' + (u.length ? '<button class="btn sm" id="bell-seen">Mark all read</button>' : '') + '</span></div>' +
      (list.map(function (a) { var mine = (a.for_email || '').toLowerCase() === myEmail(); return '<a class="hit' + (ids.indexOf(a.id) >= 0 ? ' unseen' : '') + '" href="' + ENTITY_LINK(a) + '"><span style="min-width:0;flex:1">' + (mine && a.entity === 'tasks' && a.action !== 'done' ? '<b style="color:var(--red)">For you · </b>' : '') + esc(a.summary) + '<span class="meta" style="display:block">' + esc(actorLabel(a)) + ' · ' + fmtDT(a.at) + '</span></span></a>'; }).join('') || '<div class="empty">Nothing yet. New enquiries, payments, assignments and changes appear here.</div>');
    var bp = popover(bellHtml, $('bell')); bp.dataset.kind = 'bell';
    var sb2 = $('bell-seen'); if (sb2) sb2.onclick = markSeen;
  }
  async function markSeen() { var r = await sb.rpc('mark_activity_seen'); if (!r.error && r.data) { S.me.last_seen_activity = r.data; } else { S.me.last_seen_activity = new Date().toISOString(); } updateBell(); if ($('pop')) showBell(); }
  $('bell').addEventListener('click', function (e) { e.stopPropagation(); if ($('pop') && $('pop').dataset.kind === 'bell') { closePop(); return; } showBell(); });
  document.addEventListener('click', function (e) { if (e.target.closest('#pop a.hit')) setTimeout(closePop, 0); });
  var actTimer = null;
  function startActivity() {
    updateBell();
    if (actTimer) return;
    actTimer = setInterval(async function () {
      if (document.hidden || !S.user) return;
      var maxId = S.activity.reduce(function (m, a) { return Math.max(m, a.id); }, 0);
      var r = await sb.from('activity').select('*').gt('id', maxId).order('id', { ascending: false }).limit(50);
      if (r.error || !r.data.length) return;
      S.activity = r.data.concat(S.activity);
      var fresh = r.data.filter(function (a) { return (a.actor || '').toLowerCase() !== myEmail(); });
      updateBell();
      if (fresh.length) {
        toast(fresh.length === 1 ? fresh[0].summary : fresh.length + ' new updates: ' + fresh[0].summary);
        var tables = {}; fresh.forEach(function (a) { tables[a.entity] = 1; });
        var map = { leads: 'leads', appointments: 'appts', payments: 'payments', tasks: 'tasks', matters: 'matters', invoices: 'invoices', documents: 'docs', clients: 'clients', hearings: 'hearings' };
        await Promise.all(Object.keys(tables).filter(function (t) { return map[t]; }).map(function (t) { return sb.from(t).select('*').then(function (x) { if (!x.error) S[map[t]] = x.data; }); }));
        if (!$('mform')) render();
      }
    }, 60000);
  }

  /* ---------- Router ---------- */
  function current() { var h = location.hash.slice(1); var ss = salesSection(h); if (ss) return ss; if (h.indexOf('matter=') === 0) return 'matters'; if (h.indexOf('client=') === 0) return 'clients'; if (h.indexOf('lead=') === 0) return 'inbox'; return V[h] ? h : 'dashboard'; }
  function render() {
    var h = location.hash.slice(1), cur = current();
    renderNav(cur);
    if (h.indexOf('lead=') === 0) { var ref = h.slice(5); var l = S.leads.find(function (x) { return x.ref === ref || x.id === ref; }); if (l) { S.ui.inboxSel = l.id; markSeen(l); } history.replaceState(null, '', '#inbox'); }
    if (h.indexOf('client=') === 0) {
      var cl = byId(S.clients, h.slice(7));
      $('view').innerHTML = cl ? clientPage(cl) : empty('That client was not found. <a href="#clients">All clients</a>');
    } else if (h.indexOf('matter=') === 0) {
      var m = byId(S.matters, h.slice(7));
      if (!m) { $('view').innerHTML = empty('That matter was not found. <a href="#matters">All matters</a>'); return; }
      if (S.ui.matterTab === 'File notes' && !S.notes[m.id]) loadNotes(m.id).then(render);
      $('view').innerHTML = matterDetail(m);
    } else if (salesSection(h)) { $('view').innerHTML = salesRoute(h) || empty('Not found.'); syncFoot();
    } else $('view').innerHTML = V[cur]();
    bind(); afterRender();
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
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.style.outline = '2px dashed var(--accent)'; });
      col.addEventListener('dragleave', function () { col.style.outline = ''; });
      col.addEventListener('drop', async function (e) { e.preventDefault(); col.style.outline = ''; var id = e.dataTransfer.getData('text/plain'); var r = await sb.from('leads').update({ status: col.dataset.drop }).eq('id', id).select().single(); if (r.error) { toast(r.error.message); return; } upsertLocal(S.leads, r.data); toast('Moved to ' + leadLabel(col.dataset.drop)); render(); });
    });
  }
  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-act],[data-lead],[data-client],[data-matter],[data-appt],[data-inboxtab],[data-mtab],[data-stage],[data-week],[data-close]');
    if (!el) return;
    if (el.hasAttribute('data-close') && !el.dataset.act) { $('modal-root').innerHTML = ''; return; }
    var act = el.dataset.act, id = el.dataset.id;
    if (el.closest('#pop')) closePop();
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
    if (el.dataset.stage) { var mm = byId(S.matters, location.hash.slice(8)); if (mm && mm.stage !== el.dataset.stage) stageAssistant(mm, el.dataset.stage); return; }
    if (el.dataset.lead) { e.preventDefault(); var l = byId(S.leads, el.dataset.lead); S.ui.inboxSel = l.id; markSeen(l); if (current() !== 'inbox') location.hash = 'inbox'; else render(); return; }
    if (el.dataset.client) { e.preventDefault(); $('modal-root').innerHTML = ''; location.hash = 'client=' + el.dataset.client; return; }
    if (el.dataset.matter) { location.hash = 'matter=' + el.dataset.matter; return; }
    if (el.dataset.appt) { $('modal-root').innerHTML = ''; return editAppt(byId(S.appts, el.dataset.appt)); }
  });
  window.addEventListener('hashchange', function () { if (location.hash.indexOf('#matter=') === 0) S.ui.matterTab = S.ui.matterTab || 'Overview'; if (S.user) { render(); window.scrollTo(0, 0); } });

  /* ---------- Auth ---------- */
  function show(view) { $('login').classList.toggle('hidden', view !== 'login'); $('app').classList.toggle('hidden', view !== 'app'); }
  async function start() {
    var res = await sb.auth.getSession();
    if (!res.data.session) return show('login');
    if (await needsMfa()) return showMfa();
    var ok = await sb.rpc('is_staff');
    if (ok.error || !ok.data) { await sb.auth.signOut(); $('login-msg').textContent = 'This account is not on the staff list. Ask the administrator to add you.'; return show('login'); }
    sb.rpc('link_staff');
    S.user = res.data.session.user;
    $('who').textContent = S.user.email;
    show('app');
    if (await loadAll()) { render(); startActivity(); }
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
  $('logout').addEventListener('click', async function () { await sb.auth.signOut(); S.user = null; resetLogin(); show('login'); });
  sb.auth.onAuthStateChange(function (event) { if (event === 'SIGNED_OUT') { S.user = null; show('login'); } });
  start();
})();
