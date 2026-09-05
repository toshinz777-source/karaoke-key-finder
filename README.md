# カラオケキー診断 (Karaoke Key Finder)

Mobile-first web app that helps you find karaoke songs that suit your voice
and recommends the best key adjustment for each song. This is an MVP that
runs entirely in the browser using `localStorage` — no backend, no login.

## Running it

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` on your phone or in a mobile-sized
browser window.

## Structure

- `index.html` — all views (Home / My Songs / Recommendations / Voice
  Profile / Add Song) and the "log a sung song" modal.
- `css/style.css` — mobile-first styling (large buttons/text, bottom nav).
- `js/db.js` — the sample song database plus `localStorage` read/write
  helpers for custom songs and sing history.
- `js/analysis.js` — voice profile and recommendation calculations.
- `js/app.js` — rendering and event wiring.

## How recommendations work (MVP heuristic)

1. From your sing history, `computeVoiceProfile` finds your most
   comfortable key adjustment (average key of songs you rated 4-5 for
   ease), your average score, and whether you trend toward lower or
   higher keys.
2. `computeRecommendations` adjusts that comfortable key by each song's
   vocal range level (high range → recommend lower, low range →
   recommend higher), and scores the match based on how well the song's
   difficulty and singer type fit your history.

This is intentionally simple rule-based logic, not machine learning.

## Designed to expand later

The data layer (`js/db.js`) and analysis layer (`js/analysis.js`) are
kept separate from rendering (`js/app.js`) so each of these can be added
without a rewrite:

- Microphone-based vocal range detection (would feed into
  `computeVoiceProfile` alongside/in place of manual history).
- Karaoke service song search / an automatically updated song database
  (would replace or supplement `DEFAULT_SONGS` in `js/db.js`).
- AI-based recommendations (would replace `computeRecommendations`'s
  scoring logic).
- JOYSOUND song availability checking (an additional field/badge on
  song cards).
