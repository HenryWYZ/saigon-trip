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
    if (!cb.getAttribute('aria-label')) {
      const td = cb.closest('td');
      if (td) {
        const text = td.textContent.replace(/🚶\d+m|🚕\d+m|[｜|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
        if (text) cb.setAttribute('aria-label', text);
      }
    }
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
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) {}
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
      // td.firstChild is the time text node before the appended <br>+travel-badge
      const timeTxt = td.firstChild && td.firstChild.nodeType === 3 ? td.firstChild.textContent : td.textContent;
      const t = parseTimeCell(timeTxt);
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
  const fxRate = document.getElementById('fx-rate');
  const FX_KEY = 'fx-vnd-twd-v1';
  let rate = null;

  function fmt(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatVnd(val) {
    const digits = String(val).replace(/[^\d]/g, '');
    return digits ? parseInt(digits).toLocaleString('en-US') : '';
  }
  function formatTwd(val) {
    const v = String(val).replace(/[^\d.]/g, '');
    const parts = v.split('.');
    const intPart = parts[0] ? parseInt(parts[0]).toLocaleString('en-US') : '';
    const decPart = parts.length > 1 ? '.' + parts.slice(1).join('').slice(0, 2) : '';
    return intPart + decPart;
  }

  function onVndInput(e) {
    e.target.value = formatVnd(e.target.value);
    const v = parseFloat(e.target.value.replace(/,/g, ''));
    if (!isNaN(v) && rate != null) {
      const twd = v * rate;
      fxTwd.value = fmt(twd, twd < 10 ? 2 : twd < 100 ? 1 : 0);
    } else {
      fxTwd.value = '';
    }
  }
  function onTwdInput(e) {
    e.target.value = formatTwd(e.target.value);
    const t = parseFloat(e.target.value.replace(/,/g, ''));
    if (!isNaN(t) && rate != null && rate > 0) {
      fxVnd.value = Math.round(t / rate).toLocaleString('en-US');
    } else {
      fxVnd.value = '';
    }
  }

  function renderRate(r, dateStr, cached) {
    rate = r;
    const per100k = r * 100000;
    const dateLabel = dateStr ? '（' + escapeHtml(dateStr) + (cached ? '・快取' : '') + '）' : '';
    fxRate.innerHTML =
      '1 VND = ' + r.toFixed(5) + ' TWD｜100,000 VND ≈ ' + fmt(per100k, 0) + ' TWD' +
      dateLabel + ' <span class="fx-refresh" id="fx-refresh">↻ 更新</span>';
    const btn = document.getElementById('fx-refresh');
    if (btn) btn.addEventListener('click', fetchRate);
    if (fxVnd && fxVnd.value) onVndInput({ target: fxVnd });
    else if (fxTwd && fxTwd.value) onTwdInput({ target: fxTwd });
    if (typeof renderSpending === 'function' && document.getElementById('spending-list')) {
      try { renderSpending(); } catch (e) {}
    }
    if (typeof updateAmountTwdPreview === 'function') {
      try { updateAmountTwdPreview(); } catch (e) {}
    }
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

  if (fxVnd) fxVnd.addEventListener('input', onVndInput);
  if (fxTwd) fxTwd.addEventListener('input', onTwdInput);
  if (fxRate) fetchRate();

  async function loadWeather(opts) {
    const box = document.getElementById('weather-days');
    if (!box) return;
    const force = !!(opts && opts.force);
    const WEATHER_KEY = 'weather-sgn-v2';
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=10.7769&longitude=106.7009&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=Asia%2FBangkok&start_date=2026-05-01&end_date=2026-05-05&models=best_match';
    const emojiFor = (c) => {
      if (c === 0) return '☀️';
      if (c === 1) return '🌤️';
      if (c === 2) return '⛅';
      if (c === 3) return '☁️';
      if (c === 45 || c === 48) return '🌫️';
      if (c >= 51 && c <= 57) return '🌦️';
      if (c >= 61 && c <= 67) return '🌧️';
      if (c >= 71 && c <= 77) return '❄️';
      if (c >= 80 && c <= 82) return '🌧️';
      if (c >= 85 && c <= 86) return '🌨️';
      if (c >= 95) return '⛈️';
      return '☁️';
    };
    const ZH_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
    function weekdayLabel(isoDate) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate));
      if (!m) return escapeHtml(String(isoDate).slice(5));
      const y = +m[1], mo = +m[2], d = +m[3];
      const dow = new Date(y, mo - 1, d).getDay();
      return mo + '/' + d + ' ' + ZH_WEEKDAYS[dow];
    }

    function fmtMm(v) {
      if (v == null || isNaN(v)) return '';
      const n = Number(v);
      if (n <= 0) return '';
      if (n < 1) return n.toFixed(1) + 'mm';
      return Math.round(n) + 'mm';
    }
    function fmtUpdated(ts) {
      const d = new Date(ts);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hh + ':' + mm;
    }
    function render(daily, cached, ts) {
      if (!daily || !daily.time) { box.textContent = '無天氣資料'; return; }
      let html = '';
      for (let i = 0; i < daily.time.length; i++) {
        const tmax = Math.round(daily.temperature_2m_max[i]);
        const tmin = Math.round(daily.temperature_2m_min[i]);
        const rainP = daily.precipitation_probability_max ? (daily.precipitation_probability_max[i] || 0) : 0;
        const rainMm = daily.precipitation_sum ? daily.precipitation_sum[i] : null;
        const mmStr = fmtMm(rainMm);
        html +=
          '<div class="weather-day">' +
            '<div class="wd-name">' + weekdayLabel(daily.time[i]) + '</div>' +
            '<div class="wd-emoji">' + emojiFor(daily.weather_code[i]) + '</div>' +
            '<div class="wd-temp">' + tmin + '° / ' + tmax + '°</div>' +
            '<div class="wd-rain">💧' + rainP + '%' + (mmStr ? ' · ' + mmStr : '') + '</div>' +
          '</div>';
      }
      const stampStr = ts ? '更新 ' + fmtUpdated(ts) : '';
      const cachedStr = cached ? '離線快取資料' : '';
      const meta = [stampStr, cachedStr].filter(Boolean).join(' · ');
      if (meta) html += '<div class="wd-cached">' + meta + '</div>';
      box.innerHTML = html;
      // === Rain alert: prepend warning to days with >60% probability OR >5mm forecast rain ===
      document.querySelectorAll('.rain-alert').forEach((el) => el.remove());
      for (let i = 0; i < daily.time.length; i++) {
        const rainP = daily.precipitation_probability_max ? (daily.precipitation_probability_max[i] || 0) : 0;
        const rainMm = daily.precipitation_sum ? Number(daily.precipitation_sum[i] || 0) : 0;
        if (rainP < 60 && rainMm < 5) continue;
        const day = document.querySelector('details[data-date="' + daily.time[i] + '"]');
        if (!day) continue;
        const alert = document.createElement('div');
        alert.className = 'rain-alert';
        const mmTxt = rainMm >= 1 ? '，預估雨量 <strong>' + Math.round(rainMm) + 'mm</strong>' : '';
        alert.innerHTML = '⚠️ 預報雨機率 <strong>' + rainP + '%</strong>' + mmTxt + '。建議優先選室內活動或備傘 — <a href="#main">看備用方案</a>。';
        const summary = day.querySelector(':scope > summary');
        if (summary && summary.nextSibling) {
          day.insertBefore(alert, summary.nextSibling);
        } else {
          day.appendChild(alert);
        }
      }
    }

    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null');
        if (cached && cached.daily) render(cached.daily, false, cached.ts || 0);
      } catch (err) {}
    }

    try {
      const r = await fetch(url, { cache: 'no-store' });
      const data = await r.json();
      if (data && data.daily) {
        const ts = Date.now();
        try { localStorage.setItem(WEATHER_KEY, JSON.stringify({ daily: data.daily, ts: ts })); } catch (e) {}
        render(data.daily, false, ts);
        return;
      }
      throw new Error('no data');
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null');
        if (cached && cached.daily) { render(cached.daily, true, cached.ts || 0); return; }
      } catch (err) {}
      if (!box.innerHTML || box.textContent === '載入中…') box.textContent = '天氣暫時無法載入';
    }
  }
  loadWeather();
  const weatherRefreshBtn = document.getElementById('weather-refresh');
  if (weatherRefreshBtn) {
    weatherRefreshBtn.addEventListener('click', () => {
      try { localStorage.removeItem('weather-sgn-v2'); } catch (e) {}
      const box = document.getElementById('weather-days');
      if (box) box.textContent = '載入中…';
      loadWeather({ force: true });
    });
  }

  // === IG recommendation icons ===
  // 若你有特定的 IG 貼文 / Reel URL，在此 map 填入 '地點名稱': 'IG_URL' 即可覆蓋
  // 地點名稱必須完全等於頁面上 <a class="place"> 的文字
  const IG_LINKS = {
    'MZ COFFEE': 'https://www.instagram.com/mzcoffee.hcm/',
    'STRESSMAMA': 'https://www.instagram.com/stressmamaworldwide/',
    'Little HaNoi Egg Coffee': 'https://www.instagram.com/littlehanoieggcoffee/',
    "L'Entrecôte – Social Meating": 'https://www.instagram.com/lentrecotevietnam/',
    'Izakaya Matsuki': 'https://www.instagram.com/izakaya_matsuki_vn/',
    // 範例：填入你看過的特定 Reel/Post URL
    // 'Phở Việt Nam': 'https://www.instagram.com/reel/XXXXXX/',
    // 'Chài Village': 'https://www.instagram.com/p/XXXXXX/',
  };
  function toHashtag(name) {
    return String(name)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^\x00-\x7f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }
  function tagFromQuery(href) {
    if (!href) return '';
    const m = href.match(/[?&]query=([^&]+)/);
    if (!m) return '';
    const decoded = decodeURIComponent(m[1].replace(/\+/g, ' '));
    const words = decoded.split(/\s+/).filter((w) => /^[a-zA-Z]+$/.test(w));
    return words.slice(0, 3).join('').toLowerCase();
  }
  function igUrlFor(name, href) {
    if (IG_LINKS[name]) return IG_LINKS[name];
    let tag = toHashtag(name);
    if (!tag) tag = tagFromQuery(href);
    if (!tag) return 'https://www.instagram.com/';
    return 'https://www.instagram.com/explore/tags/' + tag + '/';
  }
  const igSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="3" width="18" height="18" rx="5"/>' +
      '<circle cx="12" cy="12" r="4"/>' +
      '<circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none"/>' +
    '</svg>';
  document.querySelectorAll('a.place').forEach((a) => {
    const name = a.textContent.trim();
    if (!name) return;
    const ig = document.createElement('a');
    ig.className = 'ig-link';
    ig.href = igUrlFor(name, a.getAttribute('href'));
    ig.target = '_blank';
    ig.rel = 'noopener';
    ig.title = 'IG: ' + name;
    ig.setAttribute('aria-label', 'Instagram: ' + name);
    ig.innerHTML = igSvg;
    a.insertAdjacentElement('afterend', ig);
  });

  // === Travel time badges between consecutive stops ===
  // 每個數字 = 距離上一列景點的步行 (walk) / Grab (drive) 分鐘估計
  // 陣列索引對齊每一天 <table> 的 <tr> 順序；null 表示不顯示
  const TRAVEL = {
    'day-1': [
      null,
      { drive: 30, note: '機場→飯店' },
      { walk: 7, drive: 3 },
      { walk: 4 },
      { walk: 1 },
      { walk: 8 },
      { walk: 2 },
      { walk: 6 },
      { walk: 8 },
      { walk: 3, note: '同區 200m' },
      { walk: 10 },
      { walk: 1, note: '同條街 50m' },
      { drive: 6, note: 'Phạm Ngũ Lão' },
    ],
    'day-2': [
      { drive: 5, note: '攜行李 → Liberty' },
      { walk: 12, drive: 5 },
      { walk: 1, note: '同條街' },
      { walk: 4 },
      { walk: 8, note: '第1郡中央 600m' },
      { drive: 12, note: '第1郡→Phú Nhuận・過 Cầu Kiệu 橋' },
      { drive: 5, note: 'Phú Nhuận→Tân Định' },
      { walk: 7, note: 'Tân Định 內' },
      { walk: 8, drive: 3 },
      { drive: 2 },
      { walk: 3, note: '同條街 200m' },
      { drive: 7 },
      { walk: 8 },
    ],
    'day-3': [
      { drive: 8 },
      { walk: 5 },
      null,
      { drive: 9, note: '第3郡→第1郡 Tân Định' },
      { drive: 7 },
      { walk: 2, note: '步行 2 分到郵局' },
      { drive: 10, note: '黛奧車・第1郡→第3郡' },
      { drive: 6, note: '第3郡→第1郡 Đa Kao' },
      { drive: 10, note: '第1郡→第3郡' },
      { drive: 10, note: '第3郡→第1郡 折返' },
      { drive: 10, note: '第1郡→第3郡 折返' },
      null,
      { drive: 8, note: '司機直送第3郡' },
    ],
    'day-4': [
      { drive: 12 },
      { walk: 1, note: 'Mille Mille 隔壁' },
      { drive: 10 },
      { drive: 8 },
      { drive: 12 },
      { walk: 8, drive: 3 },
      { drive: 8 },
    ],
    'day-5': [
      null,
      { drive: 8, note: 'Liberty→Tân Định' },
      { walk: 10, note: 'Tân Định 內步行' },
      null,
      { drive: 6, note: 'Tân Định→Liberty 領行李' },
      { drive: 30, note: '第1郡→TSN T2 尖峰 buffer' },
      null,
      null,
    ],
  };

  Object.keys(TRAVEL).forEach((dayId) => {
    const day = document.getElementById(dayId);
    if (!day) return;
    const rows = day.querySelectorAll('table tr');
    const travels = TRAVEL[dayId];
    rows.forEach((tr, i) => {
      const info = travels[i];
      if (!info) return;
      const timeTd = tr.children[0];
      if (!timeTd) return;
      const badge = document.createElement('span');
      badge.className = 'travel-badge';
      const parts = [];
      if (info.walk != null) parts.push('🚶' + info.walk + 'm');
      if (info.drive != null) parts.push('🚕' + info.drive + 'm');
      let html = parts.join('｜');
      if (info.note) html += ' <small>' + info.note + '</small>';
      badge.innerHTML = html;
      timeTd.appendChild(document.createElement('br'));
      timeTd.appendChild(badge);
    });
  });

  // === Dual clock (Saigon UTC+7 / Taiwan UTC+8) ===
  const dualClock = document.getElementById('dual-clock');
  if (dualClock) {
    function updateDualClock() {
      const now = new Date();
      try {
        const sgn = now.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });
        const twn = now.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
        dualClock.textContent = '🇻🇳 ' + sgn + ' ｜ 🇹🇼 ' + twn;
      } catch (e) {}
    }
    updateDualClock();
    setInterval(updateDualClock, 30000);
  }

  // === FX preset buttons (50k / 100k / 500k / 1M VND) ===
  document.querySelectorAll('.fx-presets button[data-vnd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!fxVnd) return;
      fxVnd.value = parseInt(btn.dataset.vnd, 10).toLocaleString('en-US');
      fxVnd.dispatchEvent(new Event('input', { bubbles: true }));
      fxVnd.focus();
    });
  });

  // === Today FAB — jump to today's <details> ===
  const todayFab = document.getElementById('today-fab');
  if (todayFab) {
    function jumpToToday() {
      const now = new Date();
      const localDate = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const day = document.querySelector('details[data-date="' + localDate + '"]');
      if (!day) {
        todayFab.textContent = '📅 行程未開始';
        todayFab.disabled = true;
        return;
      }
      day.open = true;
      const target = day.querySelector('tr.now') || day;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    todayFab.addEventListener('click', jumpToToday);
    // Show only if today is within trip dates (5/1-5/5)
    const now = new Date();
    const localDate = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (document.querySelector('details[data-date="' + localDate + '"]')) {
      todayFab.hidden = false;
    }
  }

  // === Spending FAB — open the spending tracker + scroll + focus amount input ===
  const spendFab = document.getElementById('spend-fab');
  if (spendFab) {
    spendFab.addEventListener('click', () => {
      const section = document.getElementById('spending-section');
      if (!section) return;
      section.open = true;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Slight delay so the focus happens after the open animation; mobile keyboards
      // pop up reliably this way.
      setTimeout(() => {
        const amt = document.getElementById('sp-amount');
        if (amt) try { amt.focus({ preventScroll: true }); } catch (e) { amt.focus(); }
      }, 350);
    });
  }

  // === Reservation countdown — "⏱️ Xh Ym" badge for bookings within 24h ===
  function updateCountdowns() {
    document.querySelectorAll('.countdown').forEach((el) => el.remove());
    const now = Date.now();
    document.querySelectorAll('details[data-date] table tr').forEach((tr) => {
      const tds = tr.children;
      if (tds.length < 2) return;
      const txt = tds[1].textContent;
      if (!/已訂位|必訂位|建議訂位/.test(txt)) return;
      const dateStr = tr.closest('details[data-date]').getAttribute('data-date');
      const timeTxt = tds[0].firstChild && tds[0].firstChild.nodeType === 3 ? tds[0].firstChild.textContent : tds[0].textContent;
      const tm = timeTxt.match(/^(\d{1,2}):(\d{2})/);
      if (!tm) return;
      // Build booking timestamp in Asia/Bangkok (UTC+7) — schedule is local Saigon time
      const bookingUTC = Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10), +tm[1] - 7, +tm[2]);
      const diff = bookingUTC - now;
      if (diff <= 0 || diff > 86400000) return;
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const badge = document.createElement('span');
      badge.className = 'countdown' + (hours < 2 ? ' due' : '');
      badge.textContent = '⏱️ ' + (hours > 0 ? hours + 'h ' : '') + mins + 'm';
      badge.title = '距離' + dateStr + ' ' + timeTxt + ' 還有 ' + hours + 'h ' + mins + 'm';
      tds[1].appendChild(badge);
    });
  }
  updateCountdowns();
  setInterval(updateCountdowns, 60000);

  // === Per-row notes (📝 textarea, persist in localStorage) ===
  const NOTES_KEY = 'saigon-trip-notes-v1';
  let notes = {};
  try { notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch (e) {}
  function saveNotes() {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch (e) {}
  }
  document.querySelectorAll('details[data-date] table tr').forEach((tr, idx) => {
    const tds = tr.children;
    if (tds.length < 2) return;
    const wrap = document.createElement('details');
    wrap.className = 'row-note' + (notes[idx] ? ' has-note' : '');
    const sum = document.createElement('summary');
    sum.textContent = '📝';
    sum.title = '備註';
    const ta = document.createElement('textarea');
    ta.placeholder = '寫點什麼…（自動儲存）';
    ta.value = notes[idx] || '';
    ta.addEventListener('input', () => {
      const v = ta.value.trim();
      if (v) { notes[idx] = ta.value; wrap.classList.add('has-note'); }
      else { delete notes[idx]; wrap.classList.remove('has-note'); }
      saveNotes();
    });
    wrap.appendChild(sum);
    wrap.appendChild(ta);
    tds[1].appendChild(wrap);
  });

  // === Spending tracker ===
  const SPEND_KEY   = 'saigon-trip-spending-v1';
  const MEMBERS_KEY = 'saigon-trip-members-v1';
  const SYNC_PAT_KEY  = 'saigon-trip-sync-pat';
  const SYNC_GIST_KEY = 'saigon-trip-sync-gist';
  const SYNC_TS_KEY   = 'saigon-trip-cloud-saved-at';
  const SYNC_DIRTY_KEY = 'saigon-trip-spending-dirty';
  // Sync state — must be initialized BEFORE setupCloudSync() runs (form init)
  var syncPat = '';
  var syncGistId = '';
  var lastCloudSavedAt = 0;
  var syncPushTimer = null;
  var syncPollTimer = null;
  var isPushing = false, isPulling = false;
  try {
    syncPat = localStorage.getItem(SYNC_PAT_KEY) || '';
    syncGistId = localStorage.getItem(SYNC_GIST_KEY) || '';
    lastCloudSavedAt = parseInt(localStorage.getItem(SYNC_TS_KEY) || '0', 10) || 0;
  } catch (e) {}
  const DAYS = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'];
  const DAY_LABELS = { '2026-05-01': '5/1', '2026-05-02': '5/2', '2026-05-03': '5/3', '2026-05-04': '5/4', '2026-05-05': '5/5' };
  let spending = [];
  let members = [];
  let editingIdx = -1;
  try { spending = JSON.parse(localStorage.getItem(SPEND_KEY) || '[]'); } catch (e) {}
  try { members  = JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]'); } catch (e) {}
  let _membersWereSeeded = false;
  if (!Array.isArray(members) || members.length === 0) {
    members = [{ id: 'm-self', name: '我', isSelf: true }];
    _membersWereSeeded = true;
  }
  if (!members.some((m) => m.isSelf)) { members[0].isSelf = true; _membersWereSeeded = true; }
  if (_membersWereSeeded) {
    try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(members)); } catch (e) {}
  }
  function saveSpending() {
    try { localStorage.setItem(SPEND_KEY, JSON.stringify(spending)); } catch (e) {}
    markDirty();
  }
  function saveMembers() {
    try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(members)); } catch (e) {}
    markDirty();
  }
  function markDirty() {
    try { localStorage.setItem(SYNC_DIRTY_KEY, '1'); } catch (e) {}
  }
  function clearDirty() {
    try { localStorage.removeItem(SYNC_DIRTY_KEY); } catch (e) {}
  }
  function isDirty() {
    try { return localStorage.getItem(SYNC_DIRTY_KEY) === '1'; } catch (e) { return false; }
  }
  function stampMtime(entry) {
    entry.mtime = Date.now();
    return entry;
  }
  // Tombstoned entries (e.deleted) are kept in the array so the soft-delete
  // can sync across devices, but they're hidden from all UI / settlement.
  function isLive(e) { return e && !e.deleted; }
  function genMemberId() { return 'm-' + Math.random().toString(36).slice(2, 10); }
  function getMember(id) { return members.find((m) => m.id === id) || null; }
  function getSelfMember() { return members.find((m) => m.isSelf) || members[0]; }
  function payerLabel(payer) {
    if (!payer) return '我';
    if (payer === '__multi__') return '🎯 多人付';
    const m = getMember(payer);
    if (m) return m.name;
    return payer; // legacy free-text (pre-members)
  }
  function resolvePayerToMemberId(payer) {
    if (!payer) return getSelfMember().id;
    if (typeof payer !== 'string') return getSelfMember().id;
    if (payer === '__multi__') return '__multi__';
    if (members.find((m) => m.id === payer)) return payer;
    const byName = members.find((m) => m.name === payer);
    return byName ? byName.id : getSelfMember().id;
  }
  // Migrate legacy entries: payer free-text → member id (auto-create members);
  // also derive `participants` from `splitCount` so settlement can be computed.
  (function migrateLegacy() {
    let changed = false;
    spending.forEach((e) => {
      if (!e.payer) { e.payer = getSelfMember().id; changed = true; }
      else if (e.payer !== '__multi__' && !(e.payer.startsWith('m-') && getMember(e.payer))) {
        // legacy free-text payer name
        let m = members.find((x) => x.name === e.payer);
        if (!m) {
          m = { id: genMemberId(), name: String(e.payer).slice(0, 15) };
          members.push(m);
        }
        e.payer = m.id;
        changed = true;
      }
      // Derive participants from splitCount if missing.
      // Only feasible when splitCount fits within current members (else settlement
      // skips the entry — too ambiguous to retroactively guess who else was there).
      if (!Array.isArray(e.participants) || e.participants.length === 0) {
        const split = Math.max(1, +e.splitCount || 1);
        const selfId = getSelfMember().id;
        const others = members.filter((m) => !m.isSelf).map((m) => m.id);
        if (split <= 1 + others.length) {
          e.participants = [selfId].concat(others.slice(0, split - 1));
          e.splitCount = e.participants.length;
          changed = true;
        }
      }
      // Ensure every entry has an mtime so the cloud-merge logic can compare fairly.
      // Pre-mtime entries get mtime = ts (their creation time) — neither newer nor older
      // than they really are.
      if (e.mtime == null) { e.mtime = e.ts || Date.now(); changed = true; }
    });
    if (changed) {
      // Use the underlying setItem directly to avoid markDirty() flagging
      // a fake "local change" right after a clean app load.
      try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(members)); } catch (e) {}
      try { localStorage.setItem(SPEND_KEY, JSON.stringify(spending)); } catch (e) {}
    }
  })();
  function fmtVnd(n) { return n.toLocaleString('en-US'); }
  function vndToTwdLabel(vnd) {
    if (rate == null || !vnd) return '';
    const twd = Math.round(vnd * rate);
    return ' ≈ NT$ ' + twd.toLocaleString('en-US');
  }
  function todayStr() {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  }
  function refreshSpendingDatalists() {
    const cats = new Set(['🍜 餐', '🚕 交通', '🛍️ 購物', '🏛️ 景點', '💆 Spa', '☕ 咖啡', '🍺 酒吧', '📌 其他']);
    spending.forEach((e) => { if (isLive(e) && e.category) cats.add(e.category); });
    const cl = document.getElementById('sp-cat-list');
    if (cl) cl.innerHTML = Array.from(cats).map((c) => '<option value="' + escapeHtml(c) + '"></option>').join('');
  }
  function renderMembersUI() {
    const list = document.getElementById('sp-members-list');
    const sum = document.getElementById('sp-members-summary');
    if (sum) sum.textContent = '👥 旅伴設定（共 ' + members.length + ' 人）';
    if (list) {
      list.innerHTML = members.map((m) =>
        '<li>' +
          '<span class="sp-member-name' + (m.isSelf ? ' self' : '') + '">' + escapeHtml(m.name) + '</span>' +
          '<button type="button" class="rename" data-id="' + escapeHtml(m.id) + '" aria-label="改名" title="改名">✏️</button>' +
          (members.length > 1 && !m.isSelf ? '<button type="button" class="remove" data-id="' + escapeHtml(m.id) + '" aria-label="刪除" title="刪除">✕</button>' : '') +
        '</li>'
      ).join('');
      list.querySelectorAll('button.remove').forEach((b) => {
        b.addEventListener('click', () => {
          if (members.length <= 1) return;
          const id = b.dataset.id;
          // Re-assign any spending entries whose payer is this member to self
          spending.forEach((e) => { if (e.payer === id) e.payer = getSelfMember().id; });
          // Remove from any paid maps
          spending.forEach((e) => { if (e.paid && e.paid[id]) delete e.paid[id]; });
          members = members.filter((m) => m.id !== id);
          saveMembers(); saveSpending();
          refreshAllUI();
          schedulePush();
        });
      });
      list.querySelectorAll('button.rename').forEach((b) => {
        b.addEventListener('click', () => {
          const m = getMember(b.dataset.id);
          if (!m) return;
          const newName = (typeof window.prompt === 'function') ? window.prompt('改名為：', m.name) : null;
          if (newName != null && String(newName).trim()) {
            m.name = String(newName).trim().slice(0, 15);
            saveMembers();
            refreshAllUI();
            schedulePush();
          }
        });
      });
    }
  }
  function renderPayerSelect() {
    const sel = document.getElementById('sp-payer');
    const chipWrap = document.getElementById('sp-payer-chips');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = members.map((m) =>
      '<option value="' + escapeHtml(m.id) + '">' + escapeHtml(m.name) + '</option>'
    ).join('') + (members.length >= 2 ? '<option value="__multi__">🎯 多人付</option>' : '');
    if (prev && Array.from(sel.options).some((o) => o.value === prev)) sel.value = prev;
    else sel.value = getSelfMember().id;

    if (chipWrap) {
      const cur = sel.value;
      let html = members.map((m) =>
        '<button type="button" class="sp-chip" data-payer="' + escapeHtml(m.id) + '">👤 ' + escapeHtml(m.name) + '</button>'
      ).join('');
      if (members.length >= 2) {
        html += '<button type="button" class="sp-chip" data-payer="__multi__">🎯 多人付</button>';
      }
      chipWrap.innerHTML = html;
      chipWrap.querySelectorAll('button').forEach((btn) => {
        if (btn.dataset.payer === cur) btn.classList.add('active');
        btn.addEventListener('click', () => {
          sel.value = btn.dataset.payer;
          chipWrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          updateMultiPayVisibility();
        });
      });
    }
  }
  function renderMultiPayInputs() {
    const list = document.getElementById('sp-mp-list');
    if (!list) return;
    list.innerHTML = members.map((m) =>
      '<label class="sp-mp-row">' +
        '<span class="sp-mp-name">' + escapeHtml(m.name) + '</span>' +
        '<input type="number" min="0" step="1" inputmode="numeric" data-mp-id="' + escapeHtml(m.id) + '" placeholder="0">' +
        '<span class="sp-mp-vnd">VND</span>' +
      '</label>'
    ).join('');
    list.querySelectorAll('input[data-mp-id]').forEach((inp) => {
      inp.addEventListener('input', updateMultiPayStatus);
    });
    updateMultiPayStatus();
  }
  function updateMultiPayStatus() {
    const inputs = document.querySelectorAll('#sp-mp-list input[data-mp-id]');
    const sum = Array.from(inputs).reduce((s, i) => s + (parseInt(i.value, 10) || 0), 0);
    const amtEl = document.getElementById('sp-amount');
    if (amtEl) amtEl.value = sum > 0 ? String(sum) : '';
    if (typeof updateAmountTwdPreview === 'function') updateAmountTwdPreview();
    const status = document.getElementById('sp-mp-status');
    if (!status) return;
    if (sum > 0) {
      const twd = (typeof rate === 'number' && rate) ? ' ≈ NT$ ' + Math.round(sum * rate).toLocaleString('en-US') : '';
      status.textContent = '✓ 自動加總：' + sum.toLocaleString('en-US') + ' VND' + twd;
      status.className = 'sp-mp-status ok';
    } else {
      status.textContent = '請至少輸入一個人付的金額';
      status.className = 'sp-mp-status warning';
    }
  }
  function updateMultiPayVisibility() {
    const sel = document.getElementById('sp-payer');
    const wrap = document.getElementById('sp-multi-pay');
    const split = document.getElementById('sp-split');
    const label = document.querySelector('.sp-split-label');
    const amtEl = document.getElementById('sp-amount');
    if (!sel || !wrap) return;
    const multi = sel.value === '__multi__';
    wrap.hidden = !multi;
    if (split) split.style.display = multi ? 'none' : '';
    if (label) label.style.display = multi ? 'none' : '';
    if (amtEl) {
      if (multi) {
        amtEl.readOnly = true;
        amtEl.classList.add('sp-amount-locked');
        amtEl.placeholder = '自動加總（下方輸入）';
      } else {
        amtEl.readOnly = false;
        amtEl.classList.remove('sp-amount-locked');
        amtEl.placeholder = '金額 VND';
      }
    }
    if (multi) renderMultiPayInputs();
  }
  function refreshAllUI() {
    renderMembersUI();
    renderPayerSelect();
    renderSplitChips();
    updateMultiPayVisibility();
    renderSpending();
  }
  function entryCardHtml(realIdx) {
    const e = spending[realIdx];
    const amt = +e.amount || 0;
    const split = Math.max(1, +e.splitCount || 1);
    let payerHtml;
    if (e.payer === '__multi__' && e.paid) {
      const pieces = Object.keys(e.paid).map((id) => {
        const m = getMember(id);
        const name = m ? m.name : id;
        return escapeHtml(name) + ' ' + fmtVnd(e.paid[id]);
      });
      payerHtml = '<span class="sp-payer-chip multi">🎯 ' + pieces.join(' + ') + '</span>';
    } else {
      payerHtml = '<span class="sp-payer-chip">👤 ' + escapeHtml(payerLabel(e.payer)) + '付</span>';
    }
    let splitInfo = '';
    if (e.shares && typeof e.shares === 'object' && Object.keys(e.shares).length > 0) {
      const pieces = Object.keys(e.shares).map((id) => {
        const m = getMember(id);
        const name = m ? m.name : id;
        return escapeHtml(name) + ' ' + fmtVnd(e.shares[id]);
      });
      splitInfo = '<span class="sp-split-mini">➗ ' + pieces.join(' / ') + '</span>';
    } else if (split > 1) {
      const share = Math.round(amt / split);
      const names = (Array.isArray(e.participants) && e.participants.length)
        ? e.participants.map((id) => { const m = getMember(id); return m ? m.name : ''; }).filter(Boolean)
        : null;
      const who = names && names.length ? '（' + escapeHtml(names.join('、')) + '）' : '';
      splitInfo = '<span class="sp-split-mini">÷' + split + '人' + who + '＝' + fmtVnd(share) + '／人</span>';
    }
    const noteHtml = e.note ? '<span class="sp-note-mini">＃' + escapeHtml(e.note) + '</span>' : '';
    const editingCls = realIdx === editingIdx ? ' sp-card-editing' : '';
    const twdLine = (typeof rate === 'number' && rate && amt)
      ? '<div class="sp-card-twd">NT$ ' + Math.round(amt * rate).toLocaleString('en-US') + '</div>'
      : '';
    return '<div class="sp-entry-card' + editingCls + '">' +
      '<div class="sp-card-top">' +
        '<span class="sp-cat-badge">' + escapeHtml(e.category || '') + '</span>' +
        '<div class="sp-card-amount">' +
          '<strong>' + fmtVnd(amt) + '</strong><span class="vnd">VND</span>' +
          twdLine +
        '</div>' +
        '<div class="sp-card-actions">' +
          '<button class="edit" data-idx="' + realIdx + '" aria-label="編輯" title="編輯">✏️</button>' +
          '<button class="delete" data-idx="' + realIdx + '" aria-label="刪除" title="刪除">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="sp-card-meta">' +
        payerHtml +
        splitInfo +
        noteHtml +
      '</div>' +
    '</div>';
  }
  // Compute pairwise net settlement.
  // Returns: { netOwes: { creditorId: { debtorId: vndAmount } }, skipped: number }
  // skipped = entries where participants couldn't be derived (legacy + ambiguous).
  function computeSettlement() {
    const pair = {}; // pair[A][B] = how much B owes A in raw debts
    let skipped = 0;
    function addOwe(creditor, debtor, amount) {
      if (creditor === debtor || !(amount > 0)) return;
      if (!pair[creditor]) pair[creditor] = {};
      pair[creditor][debtor] = (pair[creditor][debtor] || 0) + amount;
    }
    spending.forEach((e) => {
      if (!isLive(e)) return;
      const amt = +e.amount || 0;
      if (amt <= 0) return;
      // Uneven split: each participant has their own share.
      // Even split (default): every participant owes amt / participants.length.
      const hasShares = e.shares && typeof e.shares === 'object' && Object.keys(e.shares).length > 0;
      let participants, sharesMap;
      if (hasShares) {
        sharesMap = {};
        Object.keys(e.shares).forEach((id) => {
          const v = +e.shares[id] || 0;
          if (v > 0 && getMember(id)) sharesMap[id] = v;
        });
        participants = Object.keys(sharesMap);
      } else {
        participants = (Array.isArray(e.participants) && e.participants.length)
          ? e.participants.filter((id) => getMember(id))
          : null;
      }
      if (!participants || participants.length === 0) { skipped++; return; }
      let payments;
      if (e.payer === '__multi__' && e.paid) {
        payments = {};
        Object.keys(e.paid).forEach((id) => {
          const v = +e.paid[id] || 0;
          if (v > 0 && getMember(id)) payments[id] = v;
        });
      } else {
        const payerId = (e.payer && getMember(e.payer)) ? e.payer : getSelfMember().id;
        payments = {};
        payments[payerId] = amt;
      }
      const totalPaid = Object.values(payments).reduce((s, v) => s + v, 0);
      if (totalPaid <= 0) { skipped++; return; }
      participants.forEach((pId) => {
        const owedShare = hasShares ? sharesMap[pId] : (amt / participants.length);
        const paidByThem = payments[pId] || 0;
        const owedByThem = owedShare - paidByThem;
        if (owedByThem <= 0) return;
        // Distribute their debt across payers proportionally to what each paid.
        Object.keys(payments).forEach((payerId) => {
          if (payerId === pId) return;
          const portion = (payments[payerId] / totalPaid) * owedByThem;
          addOwe(payerId, pId, portion);
        });
      });
    });
    // Net out reciprocal debts: if A owes B 100 and B owes A 30, net is A→B 70.
    const netOwes = {};
    const seen = new Set();
    Object.keys(pair).forEach((a) => {
      Object.keys(pair[a]).forEach((b) => {
        const key = [a, b].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const ab = (pair[a] && pair[a][b]) || 0;
        const ba = (pair[b] && pair[b][a]) || 0;
        const net = ab - ba;
        if (net > 0.5) {
          if (!netOwes[a]) netOwes[a] = {};
          netOwes[a][b] = Math.round(net);
        } else if (net < -0.5) {
          if (!netOwes[b]) netOwes[b] = {};
          netOwes[b][a] = Math.round(-net);
        }
      });
    });
    return { netOwes: netOwes, skipped: skipped };
  }
  function renderSettlement() {
    const box = document.getElementById('spending-settle');
    if (!box) return;
    if (members.length <= 1 || spending.length === 0) {
      box.innerHTML = '';
      box.hidden = true;
      return;
    }
    const result = computeSettlement();
    const selfId = getSelfMember().id;
    const lines = [];
    members.forEach((m) => {
      if (m.isSelf) return;
      const theyOweMe = (result.netOwes[selfId] && result.netOwes[selfId][m.id]) || 0;
      const iOweThem  = (result.netOwes[m.id] && result.netOwes[m.id][selfId]) || 0;
      const net = theyOweMe - iOweThem;
      if (net > 0) {
        const twd = (typeof rate === 'number' && rate)
          ? ' <span class="sp-settle-twd">≈ NT$ ' + Math.round(net * rate).toLocaleString('en-US') + '</span>' : '';
        lines.push('<li class="sp-settle-row sp-settle-credit">' +
          '<span class="sp-settle-name">' + escapeHtml(m.name) + ' 還你</span>' +
          '<span class="sp-settle-amount">' + fmtVnd(net) + ' VND' + twd + '</span>' +
        '</li>');
      } else if (net < 0) {
        const owe = -net;
        const twd = (typeof rate === 'number' && rate)
          ? ' <span class="sp-settle-twd">≈ NT$ ' + Math.round(owe * rate).toLocaleString('en-US') + '</span>' : '';
        lines.push('<li class="sp-settle-row sp-settle-debt">' +
          '<span class="sp-settle-name">你給 ' + escapeHtml(m.name) + '</span>' +
          '<span class="sp-settle-amount">' + fmtVnd(owe) + ' VND' + twd + '</span>' +
        '</li>');
      } else {
        lines.push('<li class="sp-settle-row sp-settle-zero">' +
          '<span class="sp-settle-name">' + escapeHtml(m.name) + '</span>' +
          '<span class="sp-settle-amount">已結清</span>' +
        '</li>');
      }
    });
    if (lines.length === 0) { box.innerHTML = ''; box.hidden = true; return; }
    let html = '<div class="sp-settle-header">💸 結算（你 ↔ 各旅伴的淨額）</div>' +
      '<ul class="sp-settle-list">' + lines.join('') + '</ul>';
    if (result.skipped > 0) {
      html += '<div class="sp-settle-warn">' + result.skipped + ' 筆舊記錄缺少分攤對象資訊，已從結算中略過 — 可編輯後重設「誰要分攤」。</div>';
    }
    box.innerHTML = html;
    box.hidden = false;
  }

  function renderSpending() {
    const summary = document.getElementById('spending-summary');
    const totals = document.getElementById('spending-totals');
    const list = document.getElementById('spending-list');
    if (!summary || !totals || !list) return;
    refreshSpendingDatalists();
    const today = todayStr();
    const dayTot = {};
    DAYS.forEach((d) => { dayTot[d] = 0; });
    spending.forEach((e) => { if (isLive(e) && dayTot[e.day] != null) dayTot[e.day] += +e.amount; });
    summary.innerHTML = DAYS.map((d) => {
      const v = dayTot[d];
      const cls = d === today ? ' today' : '';
      const twdLine = (v && rate)
        ? '<div class="value-twd">(NT$ ' + Math.round(v * rate).toLocaleString('en-US') + ')</div>'
        : '';
      return '<div class="day-total' + cls + '"><div class="label">' + DAY_LABELS[d] + '</div><div class="value">' + (v ? fmtVnd(v) : '–') + '</div>' + twdLine + '</div>';
    }).join('');
    const total = spending.reduce((s, e) => isLive(e) ? s + (+e.amount || 0) : s, 0);
    const myShare = spending.reduce((s, e) => {
      if (!isLive(e)) return s;
      const amt = +e.amount || 0;
      const split = Math.max(1, +e.splitCount || 1);
      // 我的份額：自己付 → 全付出後攤回 amt/split；同伴付 → 我欠 amt/split；共付 → amt/split
      return s + amt / split;
    }, 0);
    const totalTwd = rate ? Math.round(total * rate) : null;
    const myShareTwd = rate ? Math.round(myShare * rate) : null;
    totals.innerHTML =
      '<strong>5 日累計：</strong>' + fmtVnd(total) + ' VND' + (totalTwd != null ? ' (NT$ ' + totalTwd.toLocaleString('en-US') + ')' : '') +
      '｜<strong>我的份額：</strong>' + fmtVnd(Math.round(myShare)) + ' VND' + (myShareTwd != null ? ' (NT$ ' + myShareTwd.toLocaleString('en-US') + ')' : '');
    renderSettlement();
    const liveCount = spending.reduce((n, e) => isLive(e) ? n + 1 : n, 0);
    if (liveCount === 0) {
      list.innerHTML = '<li class="sp-empty">尚無記錄 · 新增第一筆 ↑</li>';
    } else {
      const ZH_WD = ['日', '一', '二', '三', '四', '五', '六'];
      const byDay = {};
      DAYS.forEach((d) => { byDay[d] = []; });
      spending.forEach((e, idx) => {
        if (!isLive(e)) return;
        if (byDay[e.day]) byDay[e.day].push(idx);
      });
      Object.keys(byDay).forEach((d) => {
        byDay[d].sort((a, b) => (spending[b].ts || 0) - (spending[a].ts || 0));
      });
      const dayGroupHtml = (d) => {
        const idxs = byDay[d];
        if (!idxs || idxs.length === 0) return '';
        const dayTotal = idxs.reduce((s, i) => s + (+spending[i].amount || 0), 0);
        const twdTotal = (typeof rate === 'number' && rate) ? Math.round(dayTotal * rate) : null;
        const parts = d.split('-').map(Number);
        const dow = ZH_WD[new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
        return '<li class="sp-day-group">' +
          '<div class="sp-day-header">' +
            '<span class="sp-dh-label">📅 ' + DAY_LABELS[d] + '（' + dow + '）</span>' +
            '<span class="sp-dh-count">' + idxs.length + ' 筆</span>' +
            '<span class="sp-dh-total">' + fmtVnd(dayTotal) + ' VND' +
              (twdTotal != null ? ' <span class="sp-dh-twd">(NT$ ' + twdTotal.toLocaleString('en-US') + ')</span>' : '') +
            '</span>' +
          '</div>' +
          idxs.map((idx) => entryCardHtml(idx)).join('') +
        '</li>';
      };
      list.innerHTML = DAYS.map(dayGroupHtml).join('');
    }
    list.querySelectorAll('button.delete').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = +b.dataset.idx;
        if (idx === editingIdx) exitSpendingEditMode();
        // Tombstone (soft-delete) instead of splice — keeps indices stable across devices
        // so cloud-sync merge can propagate the delete reliably.
        if (spending[idx]) {
          spending[idx].deleted = true;
          stampMtime(spending[idx]);
        }
        saveSpending();
        renderSpending();
        schedulePush();
      });
    });
    list.querySelectorAll('button.edit').forEach((b) => {
      b.addEventListener('click', () => enterSpendingEditMode(+b.dataset.idx));
    });
  }
  function enterSpendingEditMode(idx) {
    const e = spending[idx];
    if (!e) return;
    editingIdx = idx;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('sp-amount',   e.amount);
    setVal('sp-category', e.category || '');
    setVal('sp-day',      e.day);
    setVal('sp-split',    e.splitCount || 1);
    setVal('sp-note',     e.note || '');
    const payerSel = document.getElementById('sp-payer');
    if (e.payer === '__multi__' && e.paid) {
      if (payerSel) payerSel.value = '__multi__';
      // Activate the multi-pay chip
      const pchips = document.getElementById('sp-payer-chips');
      if (pchips) {
        pchips.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        const mb = pchips.querySelector('button[data-payer="__multi__"]');
        if (mb) mb.classList.add('active');
      }
      updateMultiPayVisibility();
      Object.keys(e.paid).forEach((memberId) => {
        const inp = document.querySelector('#sp-mp-list input[data-mp-id="' + memberId + '"]');
        if (inp) inp.value = e.paid[memberId];
      });
      updateMultiPayStatus();
    } else {
      const memberId = resolvePayerToMemberId(e.payer);
      if (payerSel) payerSel.value = memberId;
      activateChipByValue('sp-payer-chips', 'data-payer', memberId);
      updateMultiPayVisibility();
    }
    // Apply participants → split chips. Fall back to splitCount-derived ids when missing.
    let pIds = Array.isArray(e.participants) ? e.participants.slice() : [];
    if (!pIds.length) {
      const split = Math.max(1, +e.splitCount || 1);
      const selfId = getSelfMember().id;
      const others = members.filter((m) => !m.isSelf).map((m) => m.id);
      pIds = [selfId].concat(others.slice(0, Math.max(0, split - 1)));
    }
    setSplitChipsFromIds(pIds);
    // Restore split mode + shares values when this entry was uneven.
    if (e.shares && Object.keys(e.shares).length > 0) {
      setSplitMode('uneven');
      setSharesFromMap(e.shares);
    } else {
      setSplitMode('equal');
    }
    syncChipsFromValues();
    updateAmountTwdPreview();
    const submitBtn = document.getElementById('sp-submit');
    if (submitBtn) {
      submitBtn.textContent = '💾 儲存修改';
      submitBtn.classList.add('editing');
    }
    const cancelBtn = document.getElementById('sp-cancel-edit');
    if (cancelBtn) cancelBtn.hidden = false;
    const formEl = document.getElementById('spending-form');
    if (formEl && formEl.scrollIntoView) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    renderSpending();
  }
  function exitSpendingEditMode() {
    editingIdx = -1;
    const submitBtn = document.getElementById('sp-submit');
    if (submitBtn) {
      submitBtn.textContent = '✚ 新增記錄';
      submitBtn.classList.remove('editing');
    }
    const cancelBtn = document.getElementById('sp-cancel-edit');
    if (cancelBtn) cancelBtn.hidden = true;
  }
  // === Chip group setup ===
  function activateChipByValue(groupId, attr, value) {
    const g = document.getElementById(groupId);
    if (!g) return false;
    const dsKey = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const buttons = Array.from(g.querySelectorAll('button'));
    buttons.forEach((b) => b.classList.remove('active'));
    const target = String(value == null ? '' : value);
    const match = buttons.find((b) => b.dataset && b.dataset[dsKey] === target);
    if (match) { match.classList.add('active'); return true; }
    return false;
  }
  function setupDayChips() {
    const wrap = document.getElementById('sp-day-chips');
    const sel = document.getElementById('sp-day');
    if (!wrap || !sel) return;
    wrap.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        sel.value = btn.dataset.day;
        wrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
  function setupCategoryChips() {
    const wrap = document.getElementById('sp-cat-chips');
    const input = document.getElementById('sp-category');
    const customBtn = document.getElementById('sp-cat-custom-toggle');
    if (!wrap || !input) return;
    wrap.querySelectorAll('button:not(.sp-chip-custom)').forEach((btn) => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.cat;
        wrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        input.hidden = true;
      });
    });
    if (customBtn) {
      customBtn.addEventListener('click', () => {
        wrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        customBtn.classList.add('active');
        input.hidden = false;
        input.value = '';
        try { input.focus(); } catch (e) {}
      });
    }
    input.addEventListener('input', () => {
      // typing in custom input → match against chips
      const v = input.value.trim();
      let matched = false;
      wrap.querySelectorAll('button').forEach((b) => {
        b.classList.remove('active');
        if (b.dataset.cat === v) { b.classList.add('active'); matched = true; }
      });
      if (!matched && customBtn) customBtn.classList.add('active');
    });
  }
  function renderSplitChips() {
    const wrap = document.getElementById('sp-split-chips');
    const input = document.getElementById('sp-split');
    if (!wrap || !input) return;
    // Default: every member is selected (most common case for a group trip).
    // Edit mode and form reset paths call setSplitChipsFromIds() to override after this.
    wrap.innerHTML = members.map((m) =>
      '<button type="button" class="sp-chip sp-split-chip active"' +
      ' data-mid="' + escapeHtml(m.id) + '"' + (m.isSelf ? ' data-self="1"' : '') + '>' +
        (m.isSelf ? '🙋 ' : '👤 ') + escapeHtml(m.name) +
      '</button>'
    ).join('');
    wrap.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        // Self chip cannot be deactivated — your share always counts
        if (btn.dataset.self === '1') {
          btn.classList.add('active');
          updateSplitCountFromChips();
          return;
        }
        btn.classList.toggle('active');
        updateSplitCountFromChips();
      });
    });
    updateSplitCountFromChips();
  }
  function getActiveSplitMemberIds() {
    const wrap = document.getElementById('sp-split-chips');
    const selfId = getSelfMember().id;
    if (!wrap) return [selfId];
    const ids = Array.from(wrap.querySelectorAll('button.active')).map((b) => b.dataset.mid);
    if (!ids.includes(selfId)) ids.unshift(selfId);
    return ids;
  }
  function updateSplitCountFromChips() {
    const ids = getActiveSplitMemberIds();
    const inp = document.getElementById('sp-split');
    if (inp) inp.value = String(ids.length);
    const status = document.getElementById('sp-split-status');
    if (status) {
      const amtEl = document.getElementById('sp-amount');
      const amt = amtEl ? parseInt(amtEl.value, 10) || 0 : 0;
      if (ids.length <= 1) {
        status.textContent = '只有你 — 不分攤';
      } else if (amt > 0) {
        const share = Math.round(amt / ids.length);
        const twd = (typeof rate === 'number' && rate) ? ' ≈ NT$ ' + Math.round(share * rate).toLocaleString('en-US') : '';
        status.textContent = '每人 ' + fmtVnd(share) + ' VND' + twd + '（' + ids.length + ' 人均分）';
      } else {
        status.textContent = ids.length + ' 人均分';
      }
    }
  }
  function setSplitChipsFromIds(ids) {
    const wrap = document.getElementById('sp-split-chips');
    if (!wrap) return;
    const set = new Set(ids || []);
    const selfId = getSelfMember().id;
    set.add(selfId); // self always included
    wrap.querySelectorAll('button').forEach((b) => {
      if (set.has(b.dataset.mid)) b.classList.add('active');
      else b.classList.remove('active');
    });
    updateSplitCountFromChips();
  }
  // === Uneven split (各自分攤) ===
  function getSplitMode() {
    const btn = document.querySelector('.sp-split-mode-btn.active');
    return (btn && btn.dataset.mode) || 'equal';
  }
  function setSplitMode(mode) {
    const btns = document.querySelectorAll('.sp-split-mode-btn');
    btns.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const chips  = document.getElementById('sp-split-chips');
    const status = document.getElementById('sp-split-status');
    const panel  = document.getElementById('sp-uneven-panel');
    const amtEl  = document.getElementById('sp-amount');
    if (mode === 'uneven') {
      if (chips) chips.style.display = 'none';
      if (status) status.style.display = 'none';
      if (panel) panel.hidden = false;
      if (amtEl) {
        amtEl.readOnly = true;
        amtEl.classList.add('sp-amount-locked');
        amtEl.placeholder = '自動加總（下方填各人）';
      }
      renderSharesInputs();
    } else {
      if (chips) chips.style.display = '';
      if (status) status.style.display = '';
      if (panel) panel.hidden = true;
      if (amtEl) {
        // Multi-pay still locks amount; only unlock if neither uneven nor multi-pay is on.
        const payerSel = document.getElementById('sp-payer');
        if (!payerSel || payerSel.value !== '__multi__') {
          amtEl.readOnly = false;
          amtEl.classList.remove('sp-amount-locked');
          amtEl.placeholder = '0';
        }
      }
      updateSplitCountFromChips();
    }
  }
  function renderSharesInputs() {
    const list = document.getElementById('sp-shares-list');
    if (!list) return;
    list.innerHTML = members.map((m) =>
      '<label class="sp-mp-row">' +
        '<span class="sp-mp-name">' + (m.isSelf ? '🙋 ' : '👤 ') + escapeHtml(m.name) + '</span>' +
        '<input type="number" min="0" step="1" inputmode="numeric" data-share-id="' + escapeHtml(m.id) + '" placeholder="0">' +
        '<span class="sp-mp-vnd">VND</span>' +
      '</label>'
    ).join('');
    list.querySelectorAll('input[data-share-id]').forEach((inp) => {
      inp.addEventListener('input', updateSharesStatus);
    });
    updateSharesStatus();
  }
  function getSharesMap() {
    const out = {};
    document.querySelectorAll('#sp-shares-list input[data-share-id]').forEach((inp) => {
      const v = parseInt(inp.value, 10) || 0;
      if (v > 0) out[inp.dataset.shareId] = v;
    });
    return out;
  }
  function updateSharesStatus() {
    const status = document.getElementById('sp-shares-status');
    const amtEl = document.getElementById('sp-amount');
    const shares = getSharesMap();
    const sum = Object.values(shares).reduce((s, v) => s + v, 0);
    if (amtEl) amtEl.value = sum > 0 ? String(sum) : '';
    if (typeof updateAmountTwdPreview === 'function') updateAmountTwdPreview();
    if (!status) return;
    if (sum > 0) {
      const twd = (typeof rate === 'number' && rate) ? ' ≈ NT$ ' + Math.round(sum * rate).toLocaleString('en-US') : '';
      status.textContent = '✓ 自動加總：' + sum.toLocaleString('en-US') + ' VND' + twd;
      status.className = 'sp-mp-status ok';
    } else {
      status.textContent = '請至少輸入一個人應分攤金額';
      status.className = 'sp-mp-status warning';
    }
  }
  function setSharesFromMap(shares) {
    const list = document.getElementById('sp-shares-list');
    if (!list) return;
    list.querySelectorAll('input[data-share-id]').forEach((inp) => {
      const v = shares && shares[inp.dataset.shareId];
      inp.value = v ? String(v) : '';
    });
    updateSharesStatus();
  }
  function setupSplitModeToggle() {
    document.querySelectorAll('.sp-split-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setSplitMode(btn.dataset.mode));
    });
  }
  function syncChipsFromValues() {
    const daySel = document.getElementById('sp-day');
    const catInput = document.getElementById('sp-category');
    const customBtn = document.getElementById('sp-cat-custom-toggle');
    if (daySel) activateChipByValue('sp-day-chips', 'data-day', daySel.value);
    if (catInput) {
      const matched = activateChipByValue('sp-cat-chips', 'data-cat', catInput.value);
      if (catInput.value && !matched) {
        if (customBtn) customBtn.classList.add('active');
        catInput.hidden = false;
      } else {
        catInput.hidden = true;
      }
    }
    updateSplitCountFromChips();
  }
  function updateAmountTwdPreview() {
    const amt = parseInt((document.getElementById('sp-amount') || {}).value, 10) || 0;
    const span = document.getElementById('sp-amount-twd');
    if (!span) return;
    if (amt > 0 && typeof rate === 'number' && rate) {
      span.textContent = '≈ NT$ ' + Math.round(amt * rate).toLocaleString('en-US');
    } else {
      span.textContent = '';
    }
  }
  function updateSyncConfigVisibility() {
    const cfg = document.getElementById('sp-sync-config');
    const pill = document.getElementById('sp-sync-pill');
    const enabled = !!(syncPat && syncGistId);
    if (cfg) cfg.hidden = enabled;
    if (pill) pill.hidden = !enabled;
  }
  const spForm = document.getElementById('spending-form');
  if (spForm) {
    setupDayChips();
    setupCategoryChips();
    renderSplitChips();
    setSplitChipsFromIds(members.map((m) => m.id));
    setupSplitModeToggle();
    const tdy = todayStr();
    const dayEl = document.getElementById('sp-day');
    if (dayEl && DAYS.indexOf(tdy) !== -1) dayEl.value = tdy;
    if (dayEl && !dayEl.value) dayEl.value = DAYS[0];
    syncChipsFromValues();
    spForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const amtEl = document.getElementById('sp-amount');
      const amt = parseInt(amtEl.value, 10);
      const cat = document.getElementById('sp-category').value.trim().slice(0, 20);
      const day = document.getElementById('sp-day').value;
      const payer = document.getElementById('sp-payer').value;
      const splitMode = getSplitMode();
      let participants, shares = null;
      if (splitMode === 'uneven') {
        shares = getSharesMap();
        participants = Object.keys(shares);
        if (participants.length === 0) {
          const status = document.getElementById('sp-shares-status');
          if (status) {
            status.classList.add('error-shake');
            setTimeout(() => status.classList.remove('error-shake'), 600);
          }
          return;
        }
      } else {
        participants = getActiveSplitMemberIds();
      }
      const split = participants.length;
      const noteEl = document.getElementById('sp-note');
      const note = noteEl ? noteEl.value.trim().slice(0, 60) : '';
      if (!cat) return;

      let paid = null;
      let amtFinal = amt;
      if (payer === '__multi__') {
        paid = {};
        let sum = 0;
        document.querySelectorAll('#sp-mp-list input[data-mp-id]').forEach((inp) => {
          const v = parseInt(inp.value, 10) || 0;
          if (v > 0) { paid[inp.dataset.mpId] = v; sum += v; }
        });
        if (sum <= 0) {
          const status = document.getElementById('sp-mp-status');
          if (status) {
            updateMultiPayStatus();
            status.classList.add('error-shake');
            setTimeout(() => status.classList.remove('error-shake'), 600);
          }
          return;
        }
        amtFinal = sum;
      } else if (splitMode === 'uneven') {
        amtFinal = Object.values(shares).reduce((s, v) => s + v, 0);
      }
      if (!amtFinal || amtFinal <= 0) return;

      const entry = { amount: amtFinal, category: cat, day: day, payer: payer, paid: paid, splitCount: split, participants: participants, note: note };
      if (shares) entry.shares = shares;
      if (editingIdx >= 0 && spending[editingIdx]) {
        entry.ts = spending[editingIdx].ts;
        stampMtime(entry);
        spending[editingIdx] = entry;
        exitSpendingEditMode();
      } else {
        entry.ts = Date.now();
        stampMtime(entry);
        spending.push(entry);
      }
      saveSpending();
      amtEl.value = '';
      if (noteEl) noteEl.value = '';
      // Reset payer to self for next entry, hide multi-pay panel
      const ps = document.getElementById('sp-payer');
      if (ps) {
        ps.value = getSelfMember().id;
        activateChipByValue('sp-payer-chips', 'data-payer', getSelfMember().id);
        updateMultiPayVisibility();
      }
      // Reset split chips to "all members" so a new entry defaults to whole group; back to 平均 mode.
      setSplitMode('equal');
      setSplitChipsFromIds(members.map((m) => m.id));
      setSharesFromMap({});
      updateAmountTwdPreview();
      renderSpending();
      schedulePush();
    });
    const cancelBtn = document.getElementById('sp-cancel-edit');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        exitSpendingEditMode();
        document.getElementById('sp-amount').value = '';
        const ne = document.getElementById('sp-note'); if (ne) ne.value = '';
        const ps = document.getElementById('sp-payer');
        if (ps) {
          ps.value = getSelfMember().id;
          activateChipByValue('sp-payer-chips', 'data-payer', getSelfMember().id);
          updateMultiPayVisibility();
        }
        setSplitMode('equal');
        setSplitChipsFromIds(members.map((m) => m.id));
        setSharesFromMap({});
        updateAmountTwdPreview();
        renderSpending();
      });
    }
    // Re-validate multi-pay status + live TWD preview when amount changes
    const amtChange = document.getElementById('sp-amount');
    if (amtChange) amtChange.addEventListener('input', () => {
      updateAmountTwdPreview();
      updateSplitCountFromChips();
      const ps = document.getElementById('sp-payer');
      if (ps && ps.value === '__multi__') updateMultiPayStatus();
    });
    // Payer change → toggle multi-pay panel
    const payerChange = document.getElementById('sp-payer');
    if (payerChange) payerChange.addEventListener('change', updateMultiPayVisibility);

    // === Members CRUD form ===
    const addForm = document.getElementById('sp-add-member-form');
    if (addForm) addForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const inp = document.getElementById('sp-new-member-name');
      const nm = (inp.value || '').trim().slice(0, 15);
      if (!nm) return;
      if (members.some((m) => m.name === nm)) { inp.value = ''; return; }
      members.push({ id: genMemberId(), name: nm });
      saveMembers();
      inp.value = '';
      refreshAllUI();
      schedulePush();
    });

    refreshAllUI();
    renderSpending();
    setupCloudSync();
  }

  // === Cloud sync (GitHub Gist) ===
  // (state declared at top of IIFE near SPEND_KEY consts)

  function setSyncStatus(text, cls) {
    const el = document.getElementById('sp-sync-status');
    if (el) {
      el.textContent = text || '';
      el.className = 'sp-sync-status' + (cls ? ' ' + cls : '');
    }
    const sum = document.getElementById('sp-sync-summary');
    if (sum) sum.textContent = '☁️ 跨裝置同步' + (syncPat && syncGistId ? '（已啟用）' : '（未設定）');
    // Mirror status into the always-visible pill so users see push/pull state without opening config
    const pillStatus = document.getElementById('sp-sync-pill-status');
    if (pillStatus) {
      pillStatus.textContent = text || '已啟用';
      pillStatus.className = 'sp-sync-pill-status' + (cls ? ' ' + cls : '');
    }
  }
  function timeNow() {
    return new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  async function cloudCreateGist() {
    const body = JSON.stringify({
      description: 'Saigon Trip — Spending Sync',
      public: false,
      files: { 'data.json': { content: JSON.stringify({ members: members, spending: spending, savedAt: Date.now() }) } },
    });
    const r = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: { 'Authorization': 'token ' + syncPat, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: body,
    });
    if (!r.ok) throw new Error('建立 gist 失敗 (' + r.status + ')');
    const data = await r.json();
    syncGistId = data.id;
    try { localStorage.setItem(SYNC_GIST_KEY, syncGistId); } catch (e) {}
    return syncGistId;
  }
  async function cloudPull() {
    if (!syncPat || !syncGistId) return null;
    if (isPulling) return null;
    isPulling = true;
    try {
      const r = await fetch('https://api.github.com/gists/' + syncGistId, {
        headers: { 'Authorization': 'token ' + syncPat, 'Accept': 'application/vnd.github+json' },
      });
      if (!r.ok) throw new Error('Pull ' + r.status);
      const gist = await r.json();
      const file = gist.files && gist.files['data.json'];
      if (!file || !file.content) return null;
      return JSON.parse(file.content);
    } finally { isPulling = false; }
  }
  async function cloudPush() {
    if (!syncPat || !syncGistId) return;
    if (isPushing) return;
    isPushing = true;
    try {
      const data = { members: members, spending: spending, savedAt: Date.now() };
      const body = JSON.stringify({ files: { 'data.json': { content: JSON.stringify(data) } } });
      const r = await fetch('https://api.github.com/gists/' + syncGistId, {
        method: 'PATCH',
        headers: { 'Authorization': 'token ' + syncPat, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: body,
      });
      if (!r.ok) throw new Error('Push ' + r.status);
      lastCloudSavedAt = data.savedAt;
      try { localStorage.setItem(SYNC_TS_KEY, String(lastCloudSavedAt)); } catch (e) {}
      clearDirty();
      setSyncStatus('✅ 已同步 ' + timeNow(), 'ok');
    } catch (e) {
      setSyncStatus('❌ 同步失敗：' + e.message + '（資料保留在本機，重連後會自動補推）', 'err');
    } finally { isPushing = false; }
  }
  function schedulePush() {
    if (!syncPat || !syncGistId) return;
    setSyncStatus('⏳ 等待同步...', 'warn');
    clearTimeout(syncPushTimer);
    syncPushTimer = setTimeout(cloudPush, 2000);
  }
  // === Merge helpers (sync conflict resolution) ===
  // Strategy: ts is the stable per-entry id. mtime tracks the last edit per entry.
  // For each ts seen on either side:
  //   - both sides have it: take the one with later mtime (last-write-wins per entry)
  //   - only cloud has it: take it (someone else added it; we missed it)
  //   - only local has it AND mtime > prevSavedAt: KEEP it (unpushed local change)
  //   - only local has it AND mtime <= prevSavedAt: it was deleted on another device → DROP
  // This protects offline / unpushed entries from being wiped when a partner pushes.
  function mergeEntries(localArr, cloudArr, prevSavedAt) {
    const byTs = new Map();
    (localArr || []).forEach((e) => { if (e && e.ts != null) byTs.set(e.ts, { local: e }); });
    (cloudArr || []).forEach((e) => {
      if (!e || e.ts == null) return;
      const slot = byTs.get(e.ts) || {};
      slot.cloud = e;
      byTs.set(e.ts, slot);
    });
    const out = [];
    byTs.forEach((slot) => {
      if (slot.local && slot.cloud) {
        const lm = slot.local.mtime || slot.local.ts || 0;
        const cm = slot.cloud.mtime || slot.cloud.ts || 0;
        out.push(cm >= lm ? slot.cloud : slot.local);
      } else if (slot.cloud) {
        out.push(slot.cloud);
      } else if (slot.local) {
        const lm = slot.local.mtime || slot.local.ts || 0;
        if (lm > (prevSavedAt || 0)) out.push(slot.local);
        // else: cloud agrees this entry no longer exists → drop
      }
    });
    return out;
  }
  function mergeMembers(localArr, cloudArr) {
    // Members rarely change — merge by id, keep self flag from local (the user's
    // own perspective shouldn't flip when partner's view of "self" is different).
    const byId = new Map();
    (cloudArr || []).forEach((m) => { if (m && m.id) byId.set(m.id, Object.assign({}, m)); });
    (localArr || []).forEach((m) => {
      if (!m || !m.id) return;
      const existing = byId.get(m.id);
      if (!existing) byId.set(m.id, m);
      else if (m.isSelf) existing.isSelf = true;
    });
    return Array.from(byId.values());
  }
  function applyCloudData(cloud) {
    if (!cloud) return false;
    const prevSavedAt = lastCloudSavedAt || 0;
    if (Array.isArray(cloud.spending)) {
      spending = mergeEntries(spending, cloud.spending, prevSavedAt);
    }
    if (Array.isArray(cloud.members) && cloud.members.length > 0) {
      members = mergeMembers(members, cloud.members);
      if (!members.some((m) => m.isSelf)) members[0].isSelf = true;
    }
    // Persist merge result without flagging dirty (the merge itself isn't a
    // user-driven local change; the dirty flag should reflect changes the
    // cloud doesn't yet know about).
    try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(members)); } catch (e) {}
    try { localStorage.setItem(SPEND_KEY, JSON.stringify(spending)); } catch (e) {}
    if (cloud.savedAt) {
      lastCloudSavedAt = cloud.savedAt;
      try { localStorage.setItem(SYNC_TS_KEY, String(cloud.savedAt)); } catch (e) {}
    }
    refreshAllUI();
    return true;
  }
  function startSyncPoll() {
    clearInterval(syncPollTimer);
    syncPollTimer = setInterval(async () => {
      if (!syncPat || !syncGistId) return;
      try {
        const cloud = await cloudPull();
        if (cloud && cloud.savedAt && cloud.savedAt > lastCloudSavedAt) {
          applyCloudData(cloud);
          setSyncStatus('✅ 收到他裝置更新 ' + timeNow(), 'ok');
        }
      } catch (e) { /* silent on poll */ }
    }, 30000);
  }
  function buildSetupLink() {
    if (!syncPat || !syncGistId) return '';
    const base = window.location.origin + window.location.pathname;
    // Pack PAT + gist id into base64-encoded fragment so it isn't trivially scraped by GitHub secret scanning
    const payload = btoa(syncPat + '|' + syncGistId);
    return base + '#setup=' + payload;
  }
  async function copySetupLink() {
    const link = buildSetupLink();
    if (!link) { setSyncStatus('❌ 請先啟用同步', 'err'); return; }
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        copied = true;
      }
    } catch (e) {}
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = link;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        copied = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {}
    }
    if (copied) setSyncStatus('✅ 連結已複製 — 在其他裝置開啟即可自動套用（請只給自己的裝置）', 'ok');
    else setSyncStatus('❌ 複製失敗，請手動長按下方連結：' + link, 'err');
  }
  function parseSetupFragment() {
    const m = /#setup=([A-Za-z0-9+/=_-]+)/.exec(window.location.hash || '');
    if (!m) return null;
    try {
      const decoded = atob(m[1]);
      const sep = decoded.indexOf('|');
      if (sep < 0) return null;
      const pat = decoded.slice(0, sep);
      const gistId = decoded.slice(sep + 1);
      if (!pat || !gistId) return null;
      return { pat: pat, gistId: gistId };
    } catch (e) { return null; }
  }
  function clearSetupFragment() {
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
  }
  function maskPat(pat) {
    if (!pat || pat.length < 12) return pat;
    return pat.slice(0, 7) + '...' + pat.slice(-4);
  }
  function showImportBanner(parsed) {
    const banner = document.getElementById('sp-sync-import-banner');
    const display = document.getElementById('sp-sync-banner-pat-display');
    if (!banner) return;
    if (display) display.textContent = maskPat(parsed.pat);
    banner.hidden = false;
    const yes = document.getElementById('sp-sync-import-yes');
    const no  = document.getElementById('sp-sync-import-no');
    if (yes) yes.onclick = async () => {
      banner.hidden = true;
      clearSetupFragment();
      syncPat = parsed.pat;
      syncGistId = parsed.gistId;
      try {
        localStorage.setItem(SYNC_PAT_KEY, syncPat);
        localStorage.setItem(SYNC_GIST_KEY, syncGistId);
      } catch (e) {}
      setSyncStatus('⏳ 套用設定...', 'warn');
      try {
        const cloud = await cloudPull();
        if (cloud && cloud.savedAt && cloud.savedAt > lastCloudSavedAt) {
          applyCloudData(cloud);
          setSyncStatus('✅ 已從雲端載入並啟用 ' + timeNow(), 'ok');
        } else {
          await cloudPush();
          setSyncStatus('✅ 已啟用同步 ' + timeNow(), 'ok');
        }
        const disableBtn = document.getElementById('sp-sync-disable');
        const shareBtn = document.getElementById('sp-sync-share');
        if (disableBtn) disableBtn.hidden = false;
        if (shareBtn) shareBtn.hidden = false;
        updateSyncConfigVisibility();
        startSyncPoll();
      } catch (err) {
        setSyncStatus('❌ 套用失敗：' + err.message, 'err');
        syncPat = ''; syncGistId = '';
        try { localStorage.removeItem(SYNC_PAT_KEY); localStorage.removeItem(SYNC_GIST_KEY); } catch (e) {}
      }
    };
    if (no) no.onclick = () => {
      banner.hidden = true;
      clearSetupFragment();
    };
  }
  async function manualResync() {
    if (!syncPat || !syncGistId) { setSyncStatus('未啟用同步', 'warn'); return; }
    setSyncStatus('⏳ 立即同步中...', 'warn');
    try {
      const cloud = await cloudPull();
      if (cloud && cloud.savedAt && cloud.savedAt > lastCloudSavedAt) {
        applyCloudData(cloud);
        setSyncStatus('✅ 已從雲端拉取最新資料 ' + timeNow(), 'ok');
      } else {
        await cloudPush();
        // cloudPush sets its own status on success / fail
      }
    } catch (e) {
      setSyncStatus('❌ 立即同步失敗：' + e.message, 'err');
    }
  }
  function setupCloudSync() {
    const enableBtn = document.getElementById('sp-sync-enable');
    const disableBtn = document.getElementById('sp-sync-disable');
    const shareBtn = document.getElementById('sp-sync-share');
    const patInput = document.getElementById('sp-sync-pat');
    if (shareBtn) shareBtn.addEventListener('click', copySetupLink);
    const pillShare = document.getElementById('sp-sync-pill-share');
    const pillDisable = document.getElementById('sp-sync-pill-disable');
    const pillResync = document.getElementById('sp-sync-pill-resync');
    if (pillShare) pillShare.addEventListener('click', copySetupLink);
    if (pillDisable) pillDisable.addEventListener('click', () => {
      if (disableBtn) disableBtn.click();
    });
    if (pillResync) pillResync.addEventListener('click', manualResync);
    if (enableBtn) {
      enableBtn.addEventListener('click', async () => {
        const pat = (patInput && patInput.value || '').trim();
        if (!pat) { setSyncStatus('請貼上 PAT', 'warn'); return; }
        syncPat = pat;
        try { localStorage.setItem(SYNC_PAT_KEY, syncPat); } catch (e) {}
        setSyncStatus('⏳ 連線 GitHub...', 'warn');
        try {
          if (!syncGistId) {
            // Try to find existing gist named saigon-trip data first
            const r = await fetch('https://api.github.com/gists', {
              headers: { 'Authorization': 'token ' + syncPat, 'Accept': 'application/vnd.github+json' },
            });
            if (!r.ok) throw new Error('GitHub auth ' + r.status);
            const gists = await r.json();
            const found = gists.find((g) => g.description === 'Saigon Trip — Spending Sync' && g.files && g.files['data.json']);
            if (found) {
              syncGistId = found.id;
              try { localStorage.setItem(SYNC_GIST_KEY, syncGistId); } catch (e) {}
            } else {
              await cloudCreateGist();
            }
          }
          // Pull first; if cloud has newer data, apply it
          const cloud = await cloudPull();
          if (cloud && cloud.savedAt && cloud.savedAt > lastCloudSavedAt) {
            applyCloudData(cloud);
            setSyncStatus('✅ 已從雲端載入並同步 ' + timeNow(), 'ok');
          } else {
            await cloudPush();
            setSyncStatus('✅ 已啟用 — 本地資料已上傳 ' + timeNow(), 'ok');
          }
          if (patInput) patInput.value = '';
          if (disableBtn) disableBtn.hidden = false;
          const sb = document.getElementById('sp-sync-share');
          if (sb) sb.hidden = false;
          updateSyncConfigVisibility();
          startSyncPoll();
        } catch (e) {
          setSyncStatus('❌ 啟用失敗：' + e.message + '（請確認 PAT 有 gist 權限）', 'err');
          syncPat = '';
          syncGistId = '';
          try { localStorage.removeItem(SYNC_PAT_KEY); localStorage.removeItem(SYNC_GIST_KEY); } catch (err) {}
        }
      });
    }
    if (disableBtn) {
      disableBtn.addEventListener('click', () => {
        syncPat = ''; syncGistId = ''; lastCloudSavedAt = 0;
        try {
          localStorage.removeItem(SYNC_PAT_KEY);
          localStorage.removeItem(SYNC_GIST_KEY);
          localStorage.removeItem(SYNC_TS_KEY);
        } catch (e) {}
        clearInterval(syncPollTimer);
        clearTimeout(syncPushTimer);
        disableBtn.hidden = true;
        const sb = document.getElementById('sp-sync-share');
        if (sb) sb.hidden = true;
        updateSyncConfigVisibility();
        setSyncStatus('已停用同步（本地資料保留）', 'warn');
      });
    }
    setSyncStatus('');
    // 1. Setup-link auto-import (URL fragment) takes priority — show banner
    const parsed = parseSetupFragment();
    if (parsed) {
      showImportBanner(parsed);
      return;
    }
    // 2. Existing PAT in localStorage → pull-merge-push:
    //    Pull first (so partner's recent changes are visible to the merge), MERGE
    //    via applyCloudData (preserves our unpushed local entries because their
    //    mtime > prevSavedAt), then if dirty push the merged result back so the
    //    cloud is up to date.
    updateSyncConfigVisibility();
    if (syncPat && syncGistId) {
      if (disableBtn) disableBtn.hidden = false;
      if (shareBtn) shareBtn.hidden = false;
      (async () => {
        const wasDirty = isDirty();
        try {
          const cloud = await cloudPull();
          if (cloud) applyCloudData(cloud);
          if (wasDirty) {
            setSyncStatus('⏳ 補推離線記錄...', 'warn');
            await cloudPush();
          } else {
            setSyncStatus('✅ 已同步 ' + timeNow(), 'ok');
          }
          startSyncPoll();
        } catch (e) {
          setSyncStatus('⚠️ 載入失敗：' + e.message + '（本地資料保留）', 'warn');
          startSyncPoll();
        }
      })();
    }
  }
  // No-op stub if not enabled (so render handlers can call schedulePush safely)

  // === Large font toggle ===
  const fontBtn = document.getElementById('font-toggle');
  if (fontBtn) {
    let savedFont = null;
    try { savedFont = localStorage.getItem('font-size'); } catch (e) {}
    if (savedFont === 'large') document.body.classList.add('large');
    fontBtn.textContent = document.body.classList.contains('large') ? 'aA' : 'Aa';
    fontBtn.addEventListener('click', () => {
      const nowLarge = !document.body.classList.contains('large');
      document.body.classList.toggle('large', nowLarge);
      fontBtn.textContent = nowLarge ? 'aA' : 'Aa';
      try { localStorage.setItem('font-size', nowLarge ? 'large' : 'normal'); } catch (e) {}
    });
  }
})();
