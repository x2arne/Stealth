# Stealth X

Website + key system + statistik, satu server Node tanpa dependency.

    node server.js          # http://localhost:3000
    # set env: PORT, BASE_URL, ADMIN_TOKEN (lihat .env.example)

## Halaman
`/` landing · `/script` loader · `/script/games` katalog · `/script/statistics` stats + live · `/get-key` · `/pricing` · `/docs` (referensi fungsi executor) · `/terms` `/privacy` `/about`

## Yang wajib kamu ganti
- `BASE_URL` (env) = domain kamu. `sdk.lua` dan `loader.lua` otomatis ikut.
- Teks `stealth-x.com` di `site/script.html` (string loadstring) dan link Discord `discord.gg/XXXXXXXXXX` (cari-ganti di folder `site/`).
- Logo placeholder: `site/assets/Arc.png`, `site/arc-logo-white.png`, `site/_next/static/media/arc-logo-white.9e6912d9.png`, `site/arc-banner.png`.
- `data/games.json` = game yang didukung (name, place_id, script). Isi `scripts/<id>.lua` untuk tiap script. `--@premium` di baris pertama = khusus Premium. place_id 0 = fallback "Universal".
- Isi `site/terms`, `site/privacy`, `site/about` masih teks template asli; baca dan sesuaikan.

## API
- `POST /api/key` key gratis 24 jam/IP
- `GET /api/validate?key=&hwid=` -> `{ok, code, tier, expires}`
- `GET /api/script?place=&key=&hwid=` -> source Lua (server pilih script dari games.json)
- `GET /api/track` dipanggil SDK (launch + heartbeat online)
- `GET /api/stats|game|online|games|health` untuk halaman statistik
- `POST /api/admin` (Bearer ADMIN_TOKEN): `create` (tier, days, count), `reset_hwid`, `blacklist`, `unblacklist`, `delete`

      curl -X POST $URL/api/admin -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d '{"action":"create","tier":"premium","days":30,"count":5}'

## Catatan
- DB = `data/db.json` (ditulis tiap 5 detik). Cocok untuk VPS/Railway dengan disk persisten, bukan hosting serverless.
- Script yang sudah jalan di client tetap bisa di-dump; obfuscate isi `scripts/`.
