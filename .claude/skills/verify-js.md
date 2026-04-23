---
name: verify-js
description: Run app.js against index.html in JSDOM to catch DOM errors, bad ARIA wiring, missing elements, or stale TRAVEL arrays before pushing. Use after any non-trivial edit to app.js or to the itinerary HTML.
---

Before claiming a JS change works, actually run it. Write a throwaway Node script under `/tmp/` that:

1. Loads `C:/Users/saigon-trip/index.html` and `C:/Users/saigon-trip/app.js` via `fs.readFileSync`.
2. Instantiates a JSDOM with a **real URL** (not the default opaque origin, or `localStorage` will throw):
   ```js
   new JSDOM(html, { url: 'https://henrywyz.github.io/saigon-trip/',
                     pretendToBeVisual: true,
                     runScripts: 'outside-only' });
   ```
3. Stubs browser-only globals jsdom lacks:
   ```js
   window.fetch = () => Promise.reject(new Error('stub'));
   window.navigator.serviceWorker = { register: () => Promise.resolve() };
   Object.defineProperty(window, 'matchMedia', {
     value: () => ({ matches: false, addListener(){}, removeListener(){},
                     addEventListener(){}, removeEventListener(){} })
   });
   ```
4. Runs the script with `window.eval(js)` wrapped in try/catch (print the error — silent failures are how real bugs shipped in this repo before).
5. Waits ~200ms for microtasks, then queries the DOM and asserts whatever you're verifying — e.g. travel-badge placement, IG icon count, checkbox aria-labels, ARIA live regions populated.

Install jsdom on demand: `cd /tmp && npm install jsdom --silent`.

## Known jsdom gotchas in this repo

- Opaque origin → localStorage throws → wrap every `localStorage.getItem` in try/catch in production code.
- Default stylesheet lookups are empty; `getComputedStyle` may not reflect `<style>`-block rules.
- Service worker registration is stubbed; the real SW is never exercised — test that separately in a browser.

If the test surfaces a failure, fix it in the source file, re-run the same test, commit only when green. Do not ship "looks right to me."
