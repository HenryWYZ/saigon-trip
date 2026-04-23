---
name: deploy
description: Deploy pending changes to GitHub Pages — stages, commits with a descriptive message, bumps the service worker cache version if assets changed, and pushes. Use when the user says "deploy" / "push" / "ship this".
---

Run through this checklist in order, skipping steps whose preconditions are already met:

1. **`git status`** to see what's staged / modified / untracked. If nothing is pending, stop — nothing to deploy.
2. **If any of `index.html`, `app.js`, `manifest.json`, `favicon.svg` changed**, bump the `CACHE` constant in `sw.js` by 1 (e.g. `saigon-trip-v9` → `saigon-trip-v10`). Without this bump, clients keep serving the old cached assets from the service worker and the deploy looks broken.
3. **Stage:** `git add -A`.
4. **Commit:** use a HEREDOC so the body formats correctly, follow the "why not what" style visible in prior commits (`git log --oneline -5`), and end the message with:
   ```
   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```
5. **Push:** `git push`. Report the new commit hash and the Pages URL (https://henrywyz.github.io/saigon-trip/). Note that Pages typically takes 60–90 seconds to rebuild.
6. **Tell the user to hard-reload** (Ctrl+Shift+R on desktop, or clear site data on mobile) because the service worker can serve stale content for one pageview after a cache-version bump.

Never use `--amend`. Never `--no-verify`. Never force push.
