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

## 11. When swapping two strings that both appear multiple times, placeholder first

`String.Replace(old, new)` is global — every occurrence of `old` becomes `new`. If you naively do `c.Replace(A, B); c.Replace(B, A)` to swap A and B, the second call also hits the A's you just created, so everything ends up as A.

Even with a placeholder, order matters when each side of the swap appears in multiple places (e.g. once in a row body, once in a map-btn waypoint, once in a booking list). A clean sequence that handles N sites per value:

1. Replace every occurrence of A with `__PH_A__`.
2. Replace every occurrence of B with `__PH_B__`.
3. Replace `__PH_A__` with B.
4. Replace `__PH_B__` with A.

Critical: **after a replacement, the newly-placed content may collide with the next replacement target**. For example, after swapping row *labels*, the labels' `href` query strings are still the old ones — a second global swap over those query strings will also rewrite the queries you just placed into map-btn hrefs, causing label/URL mismatch in the rows. Mitigations:

- Do the whole swap (all related strings) with a single placeholder pass, including the query strings inside the row bodies, **not** in separate passes.
- Or, after the swap, explicitly re-align paired fields with context-specific edits (`query=<X>">LABEL_OF_X`).
- Or, use unique-context anchors that can't be ambiguous (`:::ROW_A_MARKER:::` + actual content) so each replacement only targets one site.

Always verify after with a grep that `label` and `href` in each `<a class="place">` still point to the same venue.

## 12. After mass edits, verify HTML AND CSS AND JS — counting `<tr>` is not enough

A row-count match is a necessary but not sufficient check. The site shipped twice with `<tr>/TRAVEL` aligned but the page **completely unstyled** because every newline in the `<style>` block had been replaced with a literal `+` character — turning the entire stylesheet into one giant line of unparseable nonsense, which the browser silently dropped, leaving naked HTML.

Source of the corruption: a PowerShell function call where unparenthesized concatenation was treated as multiple positional arguments —

```powershell
Rep $NL + '  <tr>...'  ''  'label'        # WRONG — 4 args, $NL gets replaced with '+'
Rep ($NL + '  <tr>...') ''  'label'       # CORRECT — 3 args
```

The first form silently replaces every CRLF in the file with a `+` character. The follow-up regex repair (`\+(\s+<)` → `\n…`) only fixes HTML tag boundaries; CSS uses `}`, `;`, `*/`, `{`, `,` as line-end markers, which the HTML-only fix leaves untouched.

### Mandatory post-edit verification — three layers

After any non-trivial PowerShell or batch edit, run all three:

```bash
# 1. HTML structural balance + tag-boundary corruption
grep -c '<tr'      file.html      # match </tr> count
grep -c '<details' file.html      # match </details> count
grep -c '>+<'      file.html      # MUST be 0

# 2. CSS integrity — the lesson from this incident
awk '/<style>/,/<\/style>/' file.html | grep -cE '}\+|;\+|\*/\+|\{\+'   # MUST be 0
awk '/<style>/,/<\/style>/' file.html | wc -l                            # ≥ ~100 for our stylesheet

# 3. JS — executable in jsdom (or at least standalone Node with stubs)
node /tmp/lite-eval.mjs   # see /.claude/skills/verify-js.md
```

### How to recover when corruption already shipped

The `+` corruption is reversible with regex passes that target every line-ending context:
- HTML: `\+( +<)` → `\n…` and `>(\++)<` → `>\n<`
- CSS: `<style>+` → `<style>\n`, `([};{,])\+(\s)` → `…\n`, `(\*/)\+(\s)` → `*/\n…`

**Do not** apply a blanket `+` → `\n` replace — `+` is legitimate in URL queries (`Pho+Viet+Nam`), in CSS adjacent sibling selectors (`.a + .b`), and in HTML attribute values (` title="2 + 3"`). Each replacement must check the surrounding context.
