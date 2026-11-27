/* Labour Law Alliance — booking calendar (appointment request) */
(function () {
  'use strict';

  var form = document.getElementById('bookingForm');
  if (!form) return;

  var grid = document.getElementById('calGrid');
  var monthEl = document.getElementById('calMonth');
  var prevBtn = document.getElementById('calPrev');
  var nextBtn = document.getElementById('calNext');
  var slotsEl = document.getElementById('timeSlots');
  var summary = document.getElementById('bookingSummary');
  var dateInput = document.getElementById('prefDate');
  var timeInput = document.getElementById('prefTime');
  var msg = form.querySelector('.frm-message');

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // Office hours: Mon - Sat 8:00 to 17:00; last appointment starts at 16:00. Closed Sundays.
  var TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  var DAYS_AHEAD = 60;

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var minDate = new Date(today); minDate.setDate(minDate.getDate() + 1);   // from tomorrow
  var maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + DAYS_AHEAD);
  var view = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  var selDate = null, selTime = null;

  function sameDay(a, b) { return a && b && a.getTime() === b.getTime(); }
  function isOpen(d) { return d >= minDate && d <= maxDate && d.getDay() !== 0; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nice(d) { return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  function renderCalendar() {
    var y = view.getFullYear(), m = view.getMonth();
    monthEl.textContent = MONTHS[m] + ' ' + y;
    grid.innerHTML = '';
    var offset = (new Date(y, m, 1).getDay() + 6) % 7;   // Monday-first
    var days = new Date(y, m + 1, 0).getDate();
    for (var i = 0; i < offset; i++) {
      var blank = document.createElement('span');
      blank.className = 'cal-blank';
      grid.appendChild(blank);
    }
    for (var d = 1; d <= days; d++) {
      var date = new Date(y, m, d);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cal-day';
      b.textContent = d;
      b.setAttribute('aria-label', nice(date));
      if (sameDay(date, today)) b.classList.add('is-today');
      if (!isOpen(date)) {
        b.disabled = true;
        if (date.getDay() === 0) b.title = 'Closed on Sundays';
      } else {
        b.addEventListener('click', pickDate.bind(null, date));
      }
      if (sameDay(date, selDate)) { b.classList.add('is-selected'); b.setAttribute('aria-pressed', 'true'); }
      grid.appendChild(b);
    }
    prevBtn.disabled = (y === minDate.getFullYear() && m === minDate.getMonth());
    nextBtn.disabled = (y === maxDate.getFullYear() && m === maxDate.getMonth());
  }

  function renderSlots() {
    slotsEl.innerHTML = '';
    if (!selDate) {
      slotsEl.innerHTML = '<p class="time-hint">Select a date first to see available times.</p>';
      return;
    }
    TIMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'time-slot' + (t === selTime ? ' is-selected' : '');
      b.textContent = t;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', t === selTime ? 'true' : 'false');
      b.addEventListener('click', function () { selTime = t; renderSlots(); update(); });
      slotsEl.appendChild(b);
    });
  }

  function update() {
    dateInput.value = selDate ? nice(selDate) + ' (' + iso(selDate) + ')' : '';
    timeInput.value = selTime || '';
    if (selDate && selTime) summary.innerHTML = 'Selected: <strong>' + nice(selDate) + ' at ' + selTime + '</strong>';
    else if (selDate) summary.innerHTML = 'Selected: <strong>' + nice(selDate) + '</strong>. Now choose a time.';
    else summary.textContent = 'No date or time selected yet.';
    summary.classList.toggle('is-ready', !!(selDate && selTime));
  }

  function pickDate(date) {
    selDate = date;
    renderCalendar();
    renderSlots();
    update();
  }

  prevBtn.addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCalendar(); });
  nextBtn.addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCalendar(); });

  // Runs before the shared form handler in main.js: a date and time are required.
  form.addEventListener('submit', function (e) {
    if (selDate && selTime) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    msg.className = 'frm-message err';
    msg.textContent = 'Please choose a date and a time for your appointment.';
    document.getElementById('calendar').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, true);

  // After a successful send, main.js resets the form: clear the selection and show a booking message.
  form.addEventListener('reset', function () {
    setTimeout(function () {
      selDate = null; selTime = null;
      renderCalendar(); renderSlots(); update();
      if (msg.classList.contains('ok')) {
        msg.textContent = 'Thank you. Your appointment request has been sent. We will contact you to confirm the date and time.';
      }
    }, 0);
  });

  renderCalendar();
  renderSlots();
  update();
})();
