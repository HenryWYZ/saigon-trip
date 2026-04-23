# Saigon Trip — 胡志明五日行程手冊

Personal PWA itinerary for a 2026/5/1–5/5 Ho Chi Minh City trip. Hosted on GitHub Pages, designed for phone use during the trip (works offline once installed).

## Live / repo
- **Site**: https://henrywyz.github.io/saigon-trip/
- **Repo**: https://github.com/HenryWYZ/saigon-trip
- **Branch**: `main` (GitHub Pages auto-deploys on push)

## Stack
Vanilla HTML / CSS / JS. No framework, no build step, no bundler. Everything is plain static files that GitHub Pages serves as-is.

```
index.html       main page (inline <style>, loads app.js deferred)
app.js           all runtime logic (IIFE, DOM-driven, no modules)
sw.js            service worker (cache-first, precache all assets)
manifest.json    PWA manifest with Day 1-5 shortcuts
favicon.svg      app icon (🇻🇳 on navy background)
.gitignore       ignores .claude/, .vs/, editor files
```

## Runtime features (inside app.js)
| Feature | How it works |
|---|---|
| Checkbox persistence | localStorage key `saigon-trip-checks-v1` |
| Sticky progress bar | Counts checked / total, updates on change |
| Day 1–5 quick jump nav | Click opens target `<details>` and scrolls |
| "Now" indicator | Every 60s, highlights the row whose time matches device clock on a matching `data-date` day |
| FX converter | `open.er-api.com/v6/latest/VND` — bidirectional VND ↔ TWD with live rate + localStorage cache |
| Weather forecast | `api.open-meteo.com/v1/forecast` for 5/1–5/5 Saigon, emoji + hi/lo/rain% |
| Dark mode | `<button>🌙` top right, respects `prefers-color-scheme`, persists in localStorage |
| IG icons | Auto-injected next to every `<a class="place">`. Pre-set `IG_LINKS` map wins; otherwise ASCII hashtag from name; falls back to first 3 alpha tokens of the Google Maps `?query=` param for pure-Chinese names |
| Travel badges | `TRAVEL[dayId]` array in app.js provides walk/drive minutes between consecutive rows; badge renders under the time cell |
| Print styles | `beforeprint` opens all `<details>`; CSS flattens colors and hides interactive chrome |

## Key conventions

### Commits
Write detailed, "why"-forward commit messages. Always include:
```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
Use HEREDOC so multi-line bodies format correctly. Don't use `--amend` — always create a new commit.

### Service worker cache version
**Bump `CACHE` in sw.js on every asset change** (index.html, app.js, manifest.json, favicon.svg). Otherwise clients serve stale files from the SW cache. Current pattern: `saigon-trip-v<N>`, increment N.

### UTF-8 encoding
All files are UTF-8 **without BOM**. On Windows PowerShell 5.1, default `Out-File -Encoding utf8` adds a BOM — use the .NET API instead:
```powershell
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8)
```

### Multi-line regex in PowerShell
`.*?` with `(?s)` inline flag for lazy cross-line matches:
```powershell
[regex]::Replace($c, '(?s)<tr>.*?</tr>\r?\n', '')
```
The `\r?\n` handles CRLF/LF variance from mixed-origin edits.

### Place links
Every venue is wrapped in:
```html
<a class="place" target="_blank" rel="noopener"
   href="https://www.google.com/maps/search/?api=1&query=STREET+ADDRESS+DISTRICT">NAME</a>
```
Queries use `+` as separator and ASCII transliteration (no Vietnamese diacritics). Address-specific queries beat generic name queries — "Phở Việt Nam 14 Pham Hong Thai Quan 1" beats "Pho Viet Nam Ho Chi Minh".

### TRAVEL array alignment
`TRAVEL[dayId]` length **must** equal the number of `<tr>` in that day's `<table>`. When adding/removing rows, update the array. Verify with:
```bash
node -e "... match(/<tr[^>]*>/g) ..."
```

### HTML → UI rows
Each row is `<tr class="highlight"?><td>TIME</td><td><input class="checkbox">...</td></tr>`. The checkbox has **no label** in HTML; app.js auto-derives `aria-label` from `td.textContent`.

## Learned constraints (don't repeat these mistakes)

1. **Instagram web search URLs (`/explore/search/keyword/?q=…`) redirect to login**, they do NOT show results. Use profile URLs (`/<username>/`) or hashtag URLs (`/explore/tags/<tag>/`) — those at least open the IG app on mobile.
2. **Pure Chinese place names hashtag to empty string** after `normalize('NFD').replace(/[^\x00-\x7f]/g, '')`. Fallback must derive a tag from the Google Maps `?query=` parameter since that's already ASCII.
3. **Nominatim's public API blocks cloud / Claude Code IPs** with 403. Photon (`photon.komoot.io`) is usable but often returns the wrong POI for keyword-style queries. Neither is reliable for live routing — prefer manual geography-based estimates with notes for outliers (Thảo Điền, Chợ Lớn, airport).
4. **JSDOM with default URL gives "opaque origin"** and `localStorage` throws. Pass `url: 'https://…'` in JSDOM config; in production always wrap `localStorage.getItem` in try/catch anyway.
5. **Dark-mode color overrides must cover every element with hardcoded light colors.** `.weather-header { color: #001858 }` on `.weather-box { background: #1e2a4a }` = invisible. Audit every color declaration, not just the cards.
6. **`details` summary lines must be updated when the day's content changes** (e.g., when Forest Spa moved from Day 3 to Day 2, both summaries needed edits, plus the 必訂位 list).

## Deployment flow
```bash
# Make changes, bump sw.js CACHE
git add -A
git commit -m "..."
git push
# GitHub Pages rebuilds in ~60–90s
```
No CI, no preview, no staging. Every push is prod.

## Test / verify
- **JS logic**: Node 24 is installed; use JSDOM for DOM-touching code
- **Place names → hashtag mapping**: `/tmp/test-ig.mjs` pattern — evaluate `toHashtag()` + `tagFromQuery()` against a representative sample
- **Travel array alignment**: count `<tr>` per day and compare to `TRAVEL[day-N].length`
- **No Lighthouse from here** — ask the user to run PageSpeed Insights after deploy
