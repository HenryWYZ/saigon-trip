# Rules for working on this repo

Hard rules learned from prior mistakes. Break them and you'll re-introduce a bug we already paid for.

## 1. Self-verify before saying "done"

Don't ship JS changes unverified. Write a `/tmp/` Node script (optionally JSDOM) that exercises the changed code against real data, and show its output in the response. "Code looks right" is not verification — the IG link URLs, the travel-badge placement, and the Chinese-name hashtag fallback all shipped broken because I skipped this step.

If the tool is unfamiliar (`Nominatim` blocked cloud IPs, `WebFetch` times out on Instagram), say so explicitly instead of pretending you verified.

## 2. Service worker cache MUST be bumped on every asset change

`sw.js` serves from cache first. If you edit `index.html`, `app.js`, `manifest.json`, or `favicon.svg` without also bumping `CACHE = 'saigon-trip-vN'`, users keep seeing stale files. Bump it in the same commit as the asset change.

## 3. UTF-8 without BOM — always

Windows PowerShell 5.1's default `Out-File -Encoding utf8` writes **with a BOM**. Use the .NET API to avoid it:

```powershell
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8)
```

Files with a BOM will silently break a future `String.Replace` match-by-literal call.

## 4. `TRAVEL[day-N]` length === day-N `<tr>` count

Every time you add/remove a row in a day's table, update the matching `TRAVEL` array in `app.js`. Verify with the `/check-travel` skill. Drift silently drops badges from later rows.

## 5. Always wrap `localStorage` in try/catch

Opaque origins (jsdom without an explicit URL, some sandboxed contexts, Safari private mode) throw on `localStorage.getItem`. An uncaught throw at script load halts the entire IIFE — progress bar, theme toggle, travel badges, IG icons, weather — everything downstream silently dies.

```js
let saved = null;
try { saved = localStorage.getItem(KEY); } catch (e) {}
```

## 6. Instagram URLs: profile > hashtag > query-derived hashtag

Never use `instagram.com/explore/search/keyword/?q=…` — it redirects to login and shows nothing.

Priority order in `igUrlFor(name, href)`:
1. `IG_LINKS[name]` (manually curated profile / reel URL) — wins
2. `toHashtag(name)` — strip diacritics and non-ASCII, join; if non-empty, `instagram.com/explore/tags/<tag>/`
3. `tagFromQuery(href)` — when name is all-Chinese and strips to empty, extract first 3 alpha tokens from the Google Maps `?query=` parameter (which is always ASCII) and use that
4. Last resort: `instagram.com/` home

## 7. Dark-mode color overrides are exhaustive, not sampled

Every element with a hardcoded light-mode color needs a `body.dark` override. The `.weather-header { color: #001858 }` on `#1e2a4a` background was completely invisible because we overrode only the card, not its children. Sweep all `color:` declarations after adding a dark theme, don't trust visual check alone.

## 8. Don't use `--amend`, `--no-verify`, or force-push

New commits only. Hook failures need to be fixed at the source, not bypassed. Force push to `main` destroys the GitHub Pages history.

## 9. When moving an item between days

- Move the `<tr>` row to the new day's table
- Update the `<summary>` header text on both days
- Update the `必訂位` info-box if the venue required a booking
- Update BOTH days' map-btn routes to reflect new waypoint order
- Update `TRAVEL[]` arrays on both days
- Consider whether the time should shift to match the new day's flow

Missing any one of these leaves a broken link between UI and data.

## 10. Before claiming a route is accurate

Don't make up street numbers. If you don't have a verified address from Michelin / official IG / Tripadvisor, say "address not verified" and add the district + neighborhood context to the query instead. Wrong addresses that *look* specific are worse than vague ones because users trust them.
