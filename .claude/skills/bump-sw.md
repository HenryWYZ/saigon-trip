---
name: bump-sw
description: Increment the service worker CACHE version in sw.js by 1. Use whenever index.html, app.js, manifest.json, or favicon.svg has been changed and you're about to deploy.
---

Read `C:/Users/saigon-trip/sw.js`, find the line:

```js
const CACHE = 'saigon-trip-v<N>';
```

Increment `<N>` by 1 (e.g., `v9` → `v10`). No other change.

If you skip this step after asset edits, every client with a prior service worker registration will keep serving the *old* cached assets until their cache TTL expires or they clear site data. The deploy looks fine from `curl` but users don't see the change.

After bumping, include the bump in the same commit as the asset changes.
