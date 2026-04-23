(function () {
  const STORAGE_KEY = 'saigon-trip-checks-v1';
  const checkboxes = document.querySelectorAll('input.checkbox');
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    checkboxes.forEach((cb, i) => { if (saved[i]) cb.checked = true; });
  } catch (e) {}

  function updateProgress() {
    const total = checkboxes.length;
    const done = Array.from(checkboxes).filter((cb) => cb.checked).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = '已完成 ' + done + ' / ' + total + '（' + pct + '%）';
  }
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const state = Array.from(checkboxes).map((c) => c.checked);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      updateProgress();
    });
  });
  updateProgress();

  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('details').forEach((d) => {
      d.dataset.wasOpen = d.open ? '1' : '0';
      d.open = true;
    });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('details').forEach((d) => {
      d.open = d.dataset.wasOpen === '1';
    });
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('theme');
    const startDark = saved ? saved === 'dark' : prefersDark;
    document.body.classList.toggle('dark', startDark);
    themeBtn.textContent = startDark ? '☀️' : '🌙';
    themeBtn.addEventListener('click', () => {
      const nowDark = !document.body.classList.contains('dark');
      document.body.classList.toggle('dark', nowDark);
      themeBtn.textContent = nowDark ? '☀️' : '🌙';
      try { localStorage.setItem('theme', nowDark ? 'dark' : 'light'); } catch (e) {}
    });
  }

  document.querySelectorAll('.day-jump a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      target.open = true;
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    });
  });

  function parseTimeCell(txt) {
    const cleaned = txt.replace(/[（(][^)）]*[)）]/g, '').replace(/～/g, '').trim();
    let m = cleaned.match(/^(\d{1,2}):(\d{2})[–\-](\d{1,2}):(\d{2})$/);
    if (m) return { start: +m[1] * 60 + +m[2], end: +m[3] * 60 + +m[4] };
    m = cleaned.match(/^(\d{1,2}):(\d{2})[–\-]$/);
    if (m) return { start: +m[1] * 60 + +m[2], end: 24 * 60 };
    m = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (m) { const s = +m[1] * 60 + +m[2]; return { start: s, end: s + 30 }; }
    return null;
  }

  function updateNowIndicator() {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const localDate = y + '-' + mo + '-' + d;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    document.querySelectorAll('tr.now').forEach((tr) => tr.classList.remove('now'));
    document.querySelectorAll('.day-jump a.today').forEach((a) => a.classList.remove('today'));
    const day = document.querySelector('details[data-date="' + localDate + '"]');
    if (!day) return;
    const link = document.querySelector('.day-jump a[href="#' + day.id + '"]');
    if (link) link.classList.add('today');
    const rows = day.querySelectorAll('table tr');
    let matched = null;
    rows.forEach((tr) => {
      const td = tr.querySelector('td');
      if (!td) return;
      const t = parseTimeCell(td.textContent);
      if (t && nowMin >= t.start && nowMin < t.end) matched = tr;
    });
    if (matched) {
      matched.classList.add('now');
      if (!day.open) day.open = true;
    }
  }
  updateNowIndicator();
  setInterval(updateNowIndicator, 60000);

  const fxVnd = document.getElementById('fx-vnd');
  const fxTwd = document.getElementById('fx-twd');
  const fxTwdInput = document.getElementById('fx-twd-input');
  const fxVndOutput = document.getElementById('fx-vnd-output');
  const fxRate = document.getElementById('fx-rate');
  const FX_KEY = 'fx-vnd-twd-v1';
  let rate = null;

  function fmt(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function parseNum(s) { return parseFloat(String(s).replace(/,/g, '')); }

  function updateConversions() {
    if (fxVnd && fxTwd) {
      const v = parseNum(fxVnd.value);
      if (!isNaN(v) && rate != null) {
        const twd = v * rate;
        fxTwd.textContent = fmt(twd, twd < 10 ? 2 : twd < 100 ? 1 : 0) + ' TWD';
      } else { fxTwd.textContent = '—'; }
    }
    if (fxTwdInput && fxVndOutput) {
      const t = parseNum(fxTwdInput.value);
      if (!isNaN(t) && rate != null && rate > 0) {
        const vnd = t / rate;
        fxVndOutput.textContent = fmt(Math.round(vnd), 0) + ' VND';
      } else { fxVndOutput.textContent = '—'; }
    }
  }

  function renderRate(r, dateStr, cached) {
    rate = r;
    const per100k = r * 100000;
    const dateLabel = dateStr ? '（' + dateStr + (cached ? '・快取' : '') + '）' : '';
    fxRate.innerHTML =
      '1 VND = ' + r.toFixed(5) + ' TWD｜100,000 VND ≈ ' + fmt(per100k, 0) + ' TWD' +
      dateLabel + ' <span class="fx-refresh" id="fx-refresh">↻ 更新</span>';
    const btn = document.getElementById('fx-refresh');
    if (btn) btn.addEventListener('click', fetchRate);
    updateConversions();
  }

  async function fetchRate() {
    if (fxRate) fxRate.textContent = '匯率載入中…';
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/VND', { cache: 'no-store' });
      const data = await r.json();
      if (data && data.rates && data.rates.TWD) {
        const fresh = data.rates.TWD;
        const date = (data.time_last_update_utc || '').split(' ').slice(0, 4).join(' ');
        try { localStorage.setItem(FX_KEY, JSON.stringify({ rate: fresh, date: date, ts: Date.now() })); } catch (e) {}
        renderRate(fresh, date, false);
        return;
      }
      throw new Error('no rate');
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem(FX_KEY) || 'null');
        if (cached && cached.rate) { renderRate(cached.rate, cached.date || '', true); return; }
      } catch (err) {}
      if (fxRate) {
        fxRate.innerHTML = '匯率載入失敗 <span class="fx-refresh" id="fx-refresh">↻ 重試</span>';
        const btn = document.getElementById('fx-refresh');
        if (btn) btn.addEventListener('click', fetchRate);
      }
    }
  }

  if (fxVnd) {
    fxVnd.addEventListener('input', (e) => {
      const digits = String(e.target.value).replace(/[^\d]/g, '');
      e.target.value = digits ? parseInt(digits).toLocaleString('en-US') : '';
      updateConversions();
    });
  }
  if (fxTwdInput) {
    fxTwdInput.addEventListener('input', (e) => {
      const v = String(e.target.value).replace(/[^\d.]/g, '');
      const parts = v.split('.');
      const intPart = parts[0] ? parseInt(parts[0]).toLocaleString('en-US') : '';
      const decPart = parts.length > 1 ? '.' + parts.slice(1).join('').slice(0, 2) : '';
      e.target.value = intPart + decPart;
      updateConversions();
    });
  }
  if (fxRate) fetchRate();

  async function loadWeather() {
    const box = document.getElementById('weather-days');
    if (!box) return;
    const WEATHER_KEY = 'weather-sgn-v1';
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=10.7769&longitude=106.7009&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok&start_date=2026-05-01&end_date=2026-05-05';
    const emojiFor = (c) => {
      if (c === 0) return '☀️';
      if (c <= 3) return '⛅';
      if (c <= 48) return '🌫️';
      if (c <= 57) return '🌦️';
      if (c <= 67) return '🌧️';
      if (c <= 77) return '❄️';
      if (c <= 82) return '🌧️';
      if (c >= 95) return '⛈️';
      return '☁️';
    };
    const dayNames = ['5/1 四', '5/2 五', '5/3 六', '5/4 日', '5/5 一'];

    function render(daily, cached) {
      if (!daily || !daily.time) { box.textContent = '無天氣資料'; return; }
      let html = '';
      for (let i = 0; i < daily.time.length; i++) {
        const tmax = Math.round(daily.temperature_2m_max[i]);
        const tmin = Math.round(daily.temperature_2m_min[i]);
        const rain = daily.precipitation_probability_max[i] || 0;
        html +=
          '<div class="weather-day">' +
            '<div class="wd-name">' + (dayNames[i] || daily.time[i].slice(5)) + '</div>' +
            '<div class="wd-emoji">' + emojiFor(daily.weather_code[i]) + '</div>' +
            '<div class="wd-temp">' + tmin + '° / ' + tmax + '°</div>' +
            '<div class="wd-rain">💧' + rain + '%</div>' +
          '</div>';
      }
      if (cached) html += '<div class="wd-cached">離線快取資料</div>';
      box.innerHTML = html;
    }

    try {
      const r = await fetch(url, { cache: 'no-store' });
      const data = await r.json();
      if (data && data.daily) {
        try { localStorage.setItem(WEATHER_KEY, JSON.stringify({ daily: data.daily, ts: Date.now() })); } catch (e) {}
        render(data.daily, false);
        return;
      }
      throw new Error('no data');
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null');
        if (cached && cached.daily) { render(cached.daily, true); return; }
      } catch (err) {}
      box.textContent = '天氣暫時無法載入';
    }
  }
  loadWeather();
})();
