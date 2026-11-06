/* Stealth X — Supported Games.
 * The catalog comes from the Stealth X backend worker. Banners are served from its
 * asset endpoint, and each card opens the matching Roblox experience.
 */
'use strict';

const API_BASE = '/api';
const els = {
  grid: document.getElementById('games-grid'),
  count: document.getElementById('games-count'),
  search: document.getElementById('game-search'),
  empty: document.getElementById('empty-state'),
  error: document.getElementById('error-banner'),
};
const ALL_SUPPORTED_GAMES = [];

// Every game here is one the hub actually supports. Nothing is discovered at runtime.
let games = ALL_SUPPORTED_GAMES.map((g) => ({ ...g }));

const GAME_BANNERS = {};

const icon = (name) => `<svg class="ui-icon" aria-hidden="true"><use href="/assets/icons.svg#icon-${name}"></use></svg>`;

function renderSkeletons(count = 8) {
  els.grid.replaceChildren(...Array.from({ length: count }, () => {
    const card = document.createElement('div');
    card.className = 'skel glass';
    card.innerHTML = '<div class="skel-banner"></div><div class="skel-name"></div>';
    return card;
  }));
}

function card(game) {
  const a = document.createElement('a');
  a.className = 'game-card glass';
  a.href = game.place_id ? `https://www.roblox.com/games/${encodeURIComponent(game.place_id)}` : '/script/';
  a.target = game.place_id ? '_blank' : '_self';
  if (game.place_id) a.rel = 'noopener noreferrer';
  a.setAttribute('aria-label', `Open ${game.name} on Roblox`);

  const banner = document.createElement('div');
  banner.className = 'game-card-banner';
  const img = document.createElement('img');
  img.alt = game.name;
  img.loading = 'lazy';
  img.src = GAME_BANNERS[game.name] || `${API_BASE}/banner/${encodeURIComponent(game.name)}.webp`;
  img.addEventListener('error', () => {
    if (img.src !== '/assets/Arc.png') {
      img.src = '/assets/Arc.png';
    }
  });
  banner.appendChild(img);

  const footer = document.createElement('div');
  footer.className = 'game-card-footer';
  const name = document.createElement('div');
  name.className = 'game-card-name';
  name.textContent = game.name;
  const open = document.createElement('span');
  open.className = 'game-card-open';
  open.innerHTML = game.place_id ? `Open ${icon('external-link')}` : `Get script ${icon('arrow-right')}`;
  footer.append(name, open);
  a.append(banner, footer);
  return a;
}

function render() {
  const query = els.search.value.trim().toLowerCase();
  const hit = (game) => !query || game.name.toLowerCase().includes(query);
  const shown = games.filter(hit);

  els.grid.replaceChildren(...shown.map(card));
  els.empty.hidden = shown.length > 0;

  if (els.count) {
    const label = els.count.querySelector('span');
    if (label) label.textContent = query ? `${shown.length} matches` : `${shown.length} supported games`;
  }
}

render();
els.search.addEventListener('input', render);

fetch(`${API_BASE}/games`)
  .then((response) => { if (!response.ok) throw new Error(`API error ${response.status}`); return response.json(); })
  .then((data) => {
    const remote = data.games || [];
    const map = new Map();
    remote.forEach(g => map.set(g.name, { ...g }));
    // Built-in entries carry the artwork/universe ids, so they win on a name collision.
    ALL_SUPPORTED_GAMES.forEach(g => map.set(g.name, { ...(map.get(g.name) || {}), ...g }));
    games = Array.from(map.values());
    render();
  })
  .catch(() => {
    games = ALL_SUPPORTED_GAMES.map((g) => ({ ...g }));
    render();
  });
