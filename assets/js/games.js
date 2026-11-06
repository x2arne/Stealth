/* Stealth X — Supported Games.
 * The catalog comes from the Stealth X backend worker. Banners are served from its
 * asset endpoint, and each card opens the matching Roblox experience.
 */
'use strict';

const API_BASE = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? '/api' : 'https://adorable-sallyanne-fgdfgdfgd-b2d051be.koyeb.app';
const els = {
  grid: document.getElementById('games-grid'),
  count: document.getElementById('games-count'),
  search: document.getElementById('game-search'),
  empty: document.getElementById('empty-state'),
  error: document.getElementById('error-banner'),
};
const ALL_SUPPORTED_GAMES = [
  { name: 'Steal an Egg', place_id: 107778070777162, universe_id: 10563114921 },
  { name: 'Jump for Pets!', place_id: 126870639873289, universe_id: 10690360998 },
  { name: 'Dungeon Lootr', place_id: 106484206883664, universe_id: 9656201728 },
  { name: 'Da Hood', place_id: 2788229376, universe_id: 1008451066 },
  { name: 'Murder Mystery 2', place_id: 142823291, universe_id: 66654135 },
  { name: 'Grow a Chicken Fighter', place_id: 94640181989498, universe_id: 10338952197 },
  { name: 'Graben und reinigen', place_id: 83038462357724, universe_id: 10475794799 },
  { name: 'Gakuran', place_id: 128736949265057, universe_id: 9199655655 },
  { name: 'Search For The Needle', place_id: 108628039999641, universe_id: 10756011174 },
  { name: 'Leaf Simulator', place_id: 100068273119174, universe_id: 10539411000 },
  { name: 'RIVALS', place_id: 17625359962, universe_id: 6035872082 },
  { name: 'Ride A Pet', place_id: 124216119978534, universe_id: 10035204815 },
  { name: 'Universal', place_id: 0, universe_id: 0 }
];

// Every game here is one the hub actually supports. Nothing is discovered at runtime.
let games = ALL_SUPPORTED_GAMES.map((g) => ({ ...g }));

const GAME_BANNERS = {
  'Steal an Egg': 'https://tr.rbxcdn.com/180DAY-875b2a6dc156ce6dd64eb637e73238ce/768/432/Image/Png/noFilter',
  'Jump for Pets!': 'https://tr.rbxcdn.com/180DAY-d5f1b59493b60f0bc4ff9b25cac71038/768/432/Image/Png/noFilter',
  'Dungeon Lootr': 'https://tr.rbxcdn.com/180DAY-74e3238344382f02297e172c0366b7a5/768/432/Image/Png/noFilter',
  'Da Hood': 'https://tr.rbxcdn.com/180DAY-655a8b7fc990b48f595db9bcfd7ea70b/768/432/Image/Png/noFilter',
  'Murder Mystery 2': 'https://tr.rbxcdn.com/180DAY-fe7335c3ad752e84323cd81ae38de69a/768/432/Image/Png/noFilter',
  'Grow a Chicken Fighter': 'https://tr.rbxcdn.com/180DAY-8403e52cfc77a0fb4df895e64943deab/768/432/Image/Png/noFilter',
  'Graben und reinigen': 'https://tr.rbxcdn.com/180DAY-1912ba1aee413f812eeb5cc59ba88416/768/432/Image/Png/noFilter',
  'Gakuran': 'https://tr.rbxcdn.com/180DAY-f88dff1c6297298d0f8553ac1e61cb98/768/432/Image/Png/noFilter',
  'Search For The Needle': 'https://tr.rbxcdn.com/180DAY-19a201f37929cac782ac0b884693b6d7/768/432/Image/Png/noFilter',
  'Leaf Simulator': 'https://tr.rbxcdn.com/180DAY-824636b18a8e11f045109235f8a0335d/768/432/Image/Png/noFilter',
  'RIVALS': 'https://tr.rbxcdn.com/180DAY-fb02f48458ff689309df8d52bf516d04/768/432/Image/Png/noFilter',
  'Ride A Pet': 'https://tr.rbxcdn.com/180DAY-3ffbd41c5b51c95ae19350431588608e/768/432/Image/Png/noFilter',
  'Universal': '/assets/Arc.png'
};

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
