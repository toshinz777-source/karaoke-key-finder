# Tooth Check

A mobile-first web app that helps someone decide **how urgently** they should see a dentist,
based on their symptoms. It never makes a diagnosis — it only offers general triage-style
guidance and always encourages professional dental care.

Plain HTML/CSS/JS, no build step, no backend, no login, no external API. All history is
stored locally in the browser via `localStorage`.

## Files

- `index.html` — app shell and screens (Home, Check, Result, History, Dentist Summary)
- `style.css` — mobile-first styling
- `script.js` — question flow, triage logic, localStorage history, trend detection, summary generator

## Run locally

No build step needed — just serve the folder:

```bash
cd tooth-check
python3 -m http.server 8000
# open http://localhost:8000
```

Or simply open `index.html` directly in a browser.

## Deploy to GitHub Pages

**Option A — serve the whole repo (simplest, no extra steps):**
If GitHub Pages is enabled for this repository with the source set to the default branch
(root), this app is automatically available at:

```
https://<your-username>.github.io/<repo-name>/tooth-check/
```

To enable this: repo **Settings → Pages → Source → Deploy from a branch**, choose the
default branch and `/ (root)`, then save.

**Option B — make Tooth Check the site's homepage:**
If you'd rather have it at the root of the Pages URL, copy the contents of this folder
(`index.html`, `style.css`, `script.js`) into a `/docs` folder at the repo root (or into a
dedicated repository), then set **Settings → Pages → Source** to that folder. No code
changes are required — the app uses only relative paths.

## Notes

- All symptom data stays on the user's device (`localStorage`); nothing is sent anywhere.
- The app does not diagnose dental conditions and always shows a disclaimer directing users
  to a dentist or doctor for anything beyond general guidance.
