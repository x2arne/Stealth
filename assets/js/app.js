/* Stealth X — statistics page.
 *
 * The Stealth X frontend is static; live data comes from the Stealth X presence backend.
 * Local dev hits /api which server.js proxies to the same backend.
 */
'use strict';

const API_BASE = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? '/api' : 'https://adorable-sallyanne-fgdfgdfgd-b2d051be.koyeb.app';
const EXEC_REFRESH_MS = 30_000;  // Executions — раз в 30с
const LIVE_REFRESH_MS = 5_000;   // Live — раз в 5с (когда появится эндпоинт)

const GAME_ICONS = {
  'Steal an Egg': 'https://tr.rbxcdn.com/180DAY-b66a86d442d9311de8df77c49893aa04/512/512/Image/Png/noFilter',
  'Jump for Pets!': 'https://tr.rbxcdn.com/180DAY-c9220df34ffca9629b8ce653bb28a346/512/512/Image/Png/noFilter',
  'Dungeon Lootr': 'https://t6.rbxcdn.com/180DAY-007dc222a830b5992e1a04073454e980',
  'Da Hood': 'https://tr.rbxcdn.com/180DAY-ae6cda2dcf44b42ebf33fd1f24578e42/512/512/Image/Png/noFilter',
  'Murder Mystery 2': 'https://tr.rbxcdn.com/180DAY-3ac5af325970a745b0156a5358174169/512/512/Image/Png/noFilter',
  'Grow a Chicken Fighter': 'https://tr.rbxcdn.com/180DAY-c59fd5b664ab396043aab3fc9e05d65a/512/512/Image/Png/noFilter',
  'Graben und reinigen': 'https://tr.rbxcdn.com/180DAY-b1dc85405e39f0a1f4ee22477c220d4c/512/512/Image/Png/noFilter',
  'Gakuran': 'https://tr.rbxcdn.com/180DAY-2d6c6f014b54b95a669a63291b548912/512/512/Image/Png/noFilter',
  'Leaf Simulator': 'https://tr.rbxcdn.com/180DAY-71ab0dbb49e54809aea4bbcb3f3420c7/512/512/Image/Png/noFilter',
  'RIVALS': 'https://tr.rbxcdn.com/180DAY-fb02f48458ff689309df8d52bf516d04/512/512/Image/Png/noFilter',
  'Search For The Needle': 'https://tr.rbxcdn.com/180DAY-19a201f37929cac782ac0b884693b6d7/512/512/Image/Png/noFilter',
  'Ride A Pet': 'https://tr.rbxcdn.com/180DAY-7482a4560f36aa89ecc8c5b7746106e6/512/512/Image/Png/noFilter',
  'Universal': '/assets/Arc.png'
};

const state = {
  tab: 'executions',  // 'executions' | 'live'
  period: 'daily',
  game: null,   // имя открытой игры (null = модалка закрыта)
  days: 30,
};

// ── DOM ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const els = {
  viewTabs: $('view-tabs'),
  panelExecutions: $('panel-executions'),
  panelLive: $('panel-live'),
  liveOnline: $('live-online'),
  liveGames: $('live-games'),
  liveGamesEmpty: $('live-games-empty'),
  liveExecutors: $('live-executors'),
  liveExecutorsEmpty: $('live-executors-empty'),
  liveError: $('live-error'),
  periodSwitch: $('period-switch'),
  rangeLabel: $('range-label'),
  errorBanner: $('error-banner'),
  tiles: $('tiles'),
  tileTotal: $('tile-total'),
  tileGames: $('tile-games'),
  gamesCard: $('games-card'),
  gamesCount: $('games-count'),
  gameList: $('game-list'),
  emptyState: $('empty-state'),
  updatedAt: $('updated-at'),
  modal: $('modal'),
  modalTitle: $('modal-title'),
  modalSub: $('modal-sub'),
  modalTotal: $('modal-total'),
  modalPlay: $('modal-play'),
  modalIcon: $('modal-icon'),
  modalClose: $('modal-close'),
  modalError: $('modal-error'),
  daysSwitch: $('days-switch'),
  tableBody: $('data-table-body'),
  chartCanvas: $('chart'),
};

// ── Форматирование ───────────────────────────────────────────────
const numFmt = new Intl.NumberFormat('en-US');
const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fullDayFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const utcDate = (iso) => new Date(iso + 'T00:00:00Z');

function rangeText(data) {
  if (data.period === 'total') return 'All time';
  if (data.period === 'daily') return dateFmt.format(utcDate(data.end_date));
  return `${dayFmt.format(utcDate(data.start_date))} – ${dateFmt.format(utcDate(data.end_date))}`;
}

// ── Цвета из CSS-токенов (тема правится только в style.css) ──────
const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();
const COLORS = {
  bar: token('--accent-data'),
  barHover: token('--accent'),
  grid: token('--grid'),
  baseline: token('--baseline'),
  muted: token('--muted'),
  text: token('--text'),
  text2: token('--text-2'),
  panel: token('--panel-solid'),
  border: token('--border'),
  font: token('--font') || 'system-ui, sans-serif',
};
if (window.Chart) {
  Chart.defaults.font.family = COLORS.font;
}

// ── Загрузка статистики за период ────────────────────────────────
let statsAbort = null;

async function loadStats() {
  els.tiles.classList.add('loading');
  els.gamesCard.classList.add('loading');
  if (statsAbort) statsAbort.abort();
  const controller = new AbortController();
  statsAbort = controller;
  try {
    let res = await fetch(`${API_BASE}/stats?period=${state.period}`, { signal: controller.signal });
    if (!res.ok) {
      res = await fetch(`https://adorable-sallyanne-fgdfgdfgd-b2d051be.koyeb.app/stats?period=${state.period}`, { signal: controller.signal });
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    renderStats(await res.json());
    showError(null);
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError('Failed to load statistics. Retrying automatically…');
  } finally {
    // не снимаем индикацию, если этот запрос уже вытеснен более новым
    if (statsAbort === controller) {
      els.tiles.classList.remove('loading');
      els.gamesCard.classList.remove('loading');
    }
  }
}

function showError(message) {
  els.errorBanner.hidden = !message;
  if (message) els.errorBanner.textContent = message;
}

// Общий таймстамп «Updated … UTC» — обновляется и Executions (30с), и Live (5с).
function stampUpdated() {
  els.updatedAt.textContent = `Updated ${new Date().toISOString().slice(11, 19)} UTC`;
}

function renderStats(data) {
  els.rangeLabel.textContent = rangeText(data);
  els.tileTotal.textContent = numFmt.format(data.total);
  els.tileGames.textContent = numFmt.format(data.games.length);

  const max = Math.max(1, ...data.games.map((g) => g.launches));
  els.gameList.replaceChildren(
    ...data.games.map((g, i) => gameRow(i + 1, g.name, g.launches, max)),
  );
  els.gamesCount.textContent = data.games.length
    ? `${data.games.length} games · click a game for daily breakdown`
    : '';
  els.emptyState.hidden = data.total > 0;

  stampUpdated();
}

/* Строки списка собираются через DOM API + textContent:
   имена игр приходят из внешнего JSON и не должны попадать в innerHTML. */
function gameRow(rank, name, launches, max) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'game-row';
  btn.addEventListener('click', () => openGame(name));

  const rankEl = document.createElement('span');
  rankEl.className = 'rank';
  rankEl.textContent = rank === null ? '—' : String(rank);

  // иконка: буква-плейсхолдер, поверх — картинка из дискового кэша бэкенда
  const iconEl = document.createElement('span');
  iconEl.className = 'row-icon';
  iconEl.textContent = (Array.from(name)[0] || '?').toUpperCase();
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.addEventListener('error', () => {
    if (img.src !== '/assets/Arc.png') img.src = '/assets/Arc.png';
    else img.remove();
  });
  img.src = GAME_ICONS[name] || `${API_BASE}/icon/${encodeURIComponent(name)}.png`;
  iconEl.appendChild(img);

  const main = document.createElement('span');
  main.className = 'game-main';
  const nameEl = document.createElement('span');
  nameEl.className = 'game-name';
  nameEl.textContent = name;
  const track = document.createElement('span');
  track.className = 'bar-track';
  const fill = document.createElement('span');
  fill.className = 'bar-fill';
  fill.style.width = `${Math.max(0.5, (launches / max) * 100)}%`;
  track.appendChild(fill);
  main.append(nameEl, track);

  const value = document.createElement('span');
  value.className = 'game-value';
  value.textContent = numFmt.format(launches);

  btn.append(rankEl, iconEl, main, value);
  li.appendChild(btn);
  return li;
}

// ── Модалка: график по дням для одной игры ───────────────────────
let chart = null;
let gameAbort = null;
let lastFocused = null;
// inert на всё вне модалки (и контент, и навбар), чтобы Tab не уходил за бэкдроп
const inertTargets = [document.querySelector('.wrap'), document.querySelector('.topnav')]
  .filter(Boolean);
const setBackgroundInert = (value) => inertTargets.forEach((el) => { el.inert = value; });

function openGame(name) {
  state.game = name;
  lastFocused = document.activeElement;
  els.modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setBackgroundInert(true); // фон неинтерактивен, Tab не уводит фокус из диалога
  // вычищаем контент предыдущей игры, чтобы при ошибке не показать чужие данные
  if (chart) { chart.destroy(); chart = null; }
  els.tableBody.replaceChildren();
  els.modalError.hidden = true;
  els.modalTitle.textContent = name;
  els.modalSub.textContent = '';
  els.modalTotal.textContent = '';
  els.modalPlay.hidden = true;
  // иконка ставится сразу — бэкенд отдаёт её с дискового кэша мгновенно
  els.modalIcon.hidden = false;
  els.modalIcon.src = GAME_ICONS[name] || `${API_BASE}/icon/${encodeURIComponent(name)}.png`;
  els.modalClose.focus();
  syncHash();
  loadGame();
}

function closeModal() {
  state.game = null;
  if (gameAbort) { gameAbort.abort(); gameAbort = null; }
  els.modal.hidden = true;
  document.body.style.overflow = '';
  setBackgroundInert(false);
  if (chart) { chart.destroy(); chart = null; }
  els.tableBody.replaceChildren();
  els.modalError.hidden = true;
  if (lastFocused && lastFocused.focus) lastFocused.focus();
  syncHash();
}

async function loadGame() {
  if (!state.game) return;
  els.modal.querySelector('.chart-box').classList.add('loading');
  if (gameAbort) gameAbort.abort();
  const controller = new AbortController();
  gameAbort = controller;
  try {
    let url = `${API_BASE}/game?name=${encodeURIComponent(state.game)}&days=${state.days}`;
    let res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      url = `https://adorable-sallyanne-fgdfgdfgd-b2d051be.koyeb.app/game?name=${encodeURIComponent(state.game)}&days=${state.days}`;
      res = await fetch(url, { signal: controller.signal });
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    renderGame(await res.json());
    els.modalError.hidden = true;
  } catch (err) {
    if (err.name === 'AbortError') return;
    els.modalError.hidden = false;
    els.modalError.textContent = 'Failed to load game data.';
  } finally {
    if (gameAbort === controller) {
      els.modal.querySelector('.chart-box').classList.remove('loading');
    }
  }
}

function renderGame(data) {
  // защита от устаревшего ответа (модалку успели закрыть/переключить игру)
  if (data.name !== state.game) return;
  els.modalTitle.textContent = data.name;
  els.modalSub.textContent =
    `${dayFmt.format(utcDate(data.start_date))} – ${dateFmt.format(utcDate(data.end_date))} · last ${data.days} days`;
  els.modalTotal.innerHTML = '';
  const b = document.createElement('b');
  b.textContent = numFmt.format(data.total);
  els.modalTotal.append(b, ` executions in ${data.days} days`);
  // Кнопка Play: только если у игры есть placeId (вытащен из link в JSON)
  if (data.place_id && Number.isInteger(data.place_id)) {
    els.modalPlay.href = `https://www.roblox.com/games/${data.place_id}`;
    els.modalPlay.hidden = false;
  } else {
    els.modalPlay.hidden = true;
  }

  const labels = data.series.map((p) => dayFmt.format(utcDate(p.date)));
  const values = data.series.map((p) => p.launches);
  const color = COLORS.bar;
  const hover = COLORS.barHover;

  if (chart) { chart.destroy(); chart = null; }
  chart = new Chart(els.chartCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: color,
        hoverBackgroundColor: hover,
        // 4px скругление на конце данных, у базовой линии — прямые углы
        borderRadius: 4,
        borderSkipped: 'bottom',
        maxBarThickness: 24,
        categoryPercentage: 0.86,
        barPercentage: 0.94,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 },
      layout: { padding: { top: 6 } },
      scales: {
        x: {
          grid: { display: false },
          border: { color: COLORS.baseline },
          ticks: { color: COLORS.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.grid },
          border: { display: false },
          ticks: {
            color: COLORS.muted,
            maxTicksLimit: 5,
            precision: 0,
            callback: (v) => compactFmt.format(v),
          },
        },
      },
      plugins: {
        legend: { display: false }, // одна серия — легенда не нужна
        tooltip: {
          backgroundColor: COLORS.panel,
          borderColor: COLORS.border,
          borderWidth: 1,
          titleColor: COLORS.text,
          bodyColor: COLORS.text2,
          displayColors: false,
          padding: 10,
          callbacks: {
            title: (items) => fullDayFmt.format(utcDate(data.series[items[0].dataIndex].date)),
            label: (item) => `${numFmt.format(item.parsed.y)} executions`,
          },
        },
      },
    },
  });

  // Табличный вид (доступная альтернатива графику), свежие дни сверху.
  els.tableBody.replaceChildren(
    ...[...data.series].reverse().map((p) => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = p.date;
      const td2 = document.createElement('td');
      td2.textContent = numFmt.format(p.launches);
      tr.append(td1, td2);
      return tr;
    }),
  );
}

els.modalIcon.addEventListener('error', () => { els.modalIcon.hidden = true; });

// ── Вкладки Executions / Live ────────────────────────────────────
function setTab(tab, { reload = true } = {}) {
  state.tab = tab;
  for (const btn of els.viewTabs.querySelectorAll('button')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === tab));
  }
  els.panelExecutions.hidden = tab !== 'executions';
  els.panelLive.hidden = tab !== 'live';
  syncHash();
  if (tab === 'live') {
    startLive();
  } else {
    stopLive();
    if (reload) loadStats();
  }
}

els.viewTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (btn) setTab(btn.dataset.tab);
});

// ── Live-онлайн (реальные данные, автообновление 5с) ─────────────
let liveTimer = null;
let liveAbort = null;

function startLive() {
  refreshLive();
  if (liveTimer === null) liveTimer = setInterval(refreshLive, LIVE_REFRESH_MS);
}

function stopLive() {
  if (liveTimer !== null) { clearInterval(liveTimer); liveTimer = null; }
  if (liveAbort) { liveAbort.abort(); liveAbort = null; }
}

async function refreshLive() {
  if (document.hidden) return;
  if (liveAbort) liveAbort.abort();
  const controller = new AbortController();
  liveAbort = controller;
  try {
    let res = await fetch(`${API_BASE}/online`, { signal: controller.signal });
    if (!res.ok) {
      res = await fetch('https://adorable-sallyanne-fgdfgdfgd-b2d051be.koyeb.app/online', { signal: controller.signal });
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    renderLive(await res.json());
    els.liveError.hidden = true;
  } catch (err) {
    if (err.name === 'AbortError') return;
    try {
      const fallback = await fetch('https://adorable-sallyanne-fgdfgdfgd-b2d051be.koyeb.app/online');
      if (fallback.ok) {
        renderLive(await fallback.json());
        els.liveError.hidden = true;
        return;
      }
    } catch (_) {}
    els.liveError.hidden = false;
    els.liveError.textContent = 'Failed to load live data.';
  }
}

function renderLive(data) {
  els.liveOnline.textContent = numFmt.format(data.total);
  updateLiveList(els.liveGames, data.games, 'name', true);
  els.liveGamesEmpty.hidden = data.games.length > 0;
  updateLiveList(els.liveExecutors, data.executors, 'executor', false);
  els.liveExecutorsEmpty.hidden = data.executors.length > 0;
  stampUpdated();
}

// Обновление на месте: переиспользуем строки по ключу (имя/executor), меняем
// только число и порядок. Иконки уже загруженных строк не пересоздаются —
// поэтому список не мигает при опросе каждые 5с.
function updateLiveList(container, items, keyField, withIcon) {
  const existing = new Map();
  for (const el of container.children) existing.set(el.dataset.key, el);
  const used = new Set();
  for (const item of items) {
    const key = item[keyField];
    used.add(key);
    let el = existing.get(key);
    if (el) {
      el.querySelector('.live-count').textContent = numFmt.format(item.online);
    } else {
      el = liveRow(item, keyField, withIcon);
      el.dataset.key = key;
    }
    container.appendChild(el); // повторный appendChild перемещает узел в нужный порядок
  }
  for (const [key, el] of existing) {
    if (!used.has(key)) el.remove();
  }
}

function liveRow(item, keyField, withIcon) {
  const label = item[keyField];
  // строка игры кликабельна, если известен placeId — ведёт на Roblox (нов. вкладка)
  const href = withIcon && item.place_id ? `https://www.roblox.com/games/${item.place_id}` : null;
  const row = document.createElement(href ? 'a' : 'div');
  row.className = 'live-row';
  if (href) {
    row.href = href;
    row.target = '_blank';
    row.rel = 'noopener noreferrer';
  }
  if (withIcon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'row-icon';
    iconEl.textContent = (Array.from(label)[0] || '?').toUpperCase();
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      if (img.src !== '/assets/Arc.png') img.src = '/assets/Arc.png';
      else img.remove();
    });
    img.src = GAME_ICONS[label] || `${API_BASE}/icon/${encodeURIComponent(label)}.png`;
    iconEl.appendChild(img);
    row.appendChild(iconEl);
  }
  const nameEl = document.createElement('span');
  nameEl.className = 'game-name';
  nameEl.textContent = label;
  const countEl = document.createElement('span');
  countEl.className = 'live-count';
  countEl.textContent = numFmt.format(item.online);
  row.append(nameEl, countEl);
  return row;
}

// уходим со вкладки/страницы — глушим опрос; вернулись на Live — снова запускаем
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLive();
  else if (state.tab === 'live') startLive();
});

// ── Переключатели ────────────────────────────────────────────────
function setPeriod(period, { reload = true } = {}) {
  state.period = period;
  for (const btn of els.periodSwitch.querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.period === period));
  }
  syncHash();
  if (reload) loadStats();
}

function setDays(days, { reload = true } = {}) {
  state.days = days;
  for (const btn of els.daysSwitch.querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.days) === days));
  }
  syncHash();
  if (reload) loadGame();
}

els.periodSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-period]');
  if (btn) setPeriod(btn.dataset.period);
});
els.daysSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-days]');
  if (btn) setDays(Number(btn.dataset.days));
});
els.modalClose.addEventListener('click', closeModal);
// Закрываем по клику на бэкдроп, только если и нажатие, и отпускание были
// на нём — иначе выделение текста в модалке с уводом курсора закрывает её.
let pressOnBackdrop = false;
els.modal.addEventListener('mousedown', (e) => {
  pressOnBackdrop = e.target === els.modal;
});
els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal && pressOnBackdrop) closeModal();
  pressOnBackdrop = false;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.game !== null) closeModal();
});

// ── Состояние в URL (#p=weekly&g=UTD&d=30) ───────────────────────
let applyingHash = false;

function syncHash() {
  if (applyingHash) return;
  const parts = [];
  if (state.tab === 'live') parts.push('t=live');
  parts.push(`p=${state.period}`);
  if (state.game !== null) {
    parts.push(`g=${encodeURIComponent(state.game)}`, `d=${state.days}`);
  }
  history.replaceState(null, '', '#' + parts.join('&'));
}

function applyHash() {
  // не location.hash: Firefox возвращает его уже раскодированным,
  // и имя игры с '&'/'%' ломает парсинг — берём сырой фрагмент из href
  const i = location.href.indexOf('#');
  const raw = i === -1 ? '' : location.href.slice(i + 1);
  const params = new URLSearchParams(raw);
  applyingHash = true;
  const p = params.get('p');
  if (['daily', 'weekly', 'monthly', 'total'].includes(p)) setPeriod(p, { reload: false });
  const d = Number(params.get('d'));
  if ([7, 14, 30, 90].includes(d)) setDays(d, { reload: false });
  setTab(params.get('t') === 'live' ? 'live' : 'executions', { reload: false });
  applyingHash = false;
  const g = params.get('g');
  if (g) openGame(g);
}

// ── Автообновление (тихое, без перезагрузки) ─────────────────────
setInterval(() => {
  if (document.hidden || state.tab !== 'executions') return;
  // пока модалка открыта — обновляем только её, не перестраиваем список под
  // ней (иначе replaceChildren уронил бы фокус на строке-источнике)
  if (state.game !== null) { loadGame(); return; }
  loadStats();
}, EXEC_REFRESH_MS);
// Live-опрос запускается/останавливается в startLive()/stopLive() по вкладке.

// ── Старт ────────────────────────────────────────────────────────
applyHash();
loadStats();
