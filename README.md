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
browser window. A static server (not a `file://` double-click) is required
because the song database now loads via `fetch('data/songs.json')`.

## Structure

- `index.html` — all views (Home / My Songs / Recommendations / Voice
  Profile / Add Song) and the "log a sung song" modal.
- `css/style.css` — mobile-first styling (large buttons/text, bottom nav).
- `data/songs.json` — the song database (see below).
- `js/notes.js` — pure music-theory helpers: note name ⇔ semitone
  conversion, transposition, and range-level derivation. No DOM, no
  storage — just math, so it's easy to unit test or reuse.
- `js/pitch.js` — microphone pitch detection (Web Audio API
  autocorrelation). No DOM either — it just calls an `onPitch(freq)`
  callback with a detected frequency in Hz, or `null` for silence/noise.
- `js/db.js` — data access: fetches the song database, and reads/writes
  `localStorage` for custom songs, sing history, and the measured vocal
  range.
- `js/analysis.js` — voice profile and recommendation calculations.
- `js/app.js` — rendering and event wiring (async, since the song
  database now loads asynchronously).

## Song data model

Each song (`data/songs.json`, or one you add via the "曲を追加" tab) has:

```json
{
  "id": "s1",
  "title": "Lemon",
  "artist": "米津玄師",
  "gender": "male",
  "genre": "pop",
  "era": "recent",
  "lowestNote": "A3",
  "highestNote": "A4",
  "difficulty": "medium",
  "originalKey": "Em",
  "joysound": null
}
```

`lowestNote`/`highestNote` are the actual notes of the original recording
(scientific pitch notation, e.g. `A3`, `C#4`). Everything the app needs —
the vocal-range label shown on cards, the recommended key, the
after-transposition range — is *derived* from these two notes at render
time (`js/notes.js`), rather than also being hand-authored as a separate
field that could drift out of sync.

`joysound` is `true`/`false`/`null` (unknown). The bundled sample data
sets it to `null` for every song — I have no live way to verify real
JOYSOUND catalog availability from here, so it's left honestly unknown
rather than guessed. The field and its UI badge are ready for the day
a real JOYSOUND lookup is wired in (see below).

**On the sample data:** the 43 bundled songs are real, well-known
Japanese karaoke titles, but their `lowestNote`/`highestNote`/`difficulty`
values are editorial estimates for demonstrating the engine — not pulled
from a verified chart source. Treat them as reasonable placeholders, not
ground truth, until a real data source is connected.

## How recommendations work

1. `computeVoiceProfile(history, songDB, measuredRange)` establishes your
   **comfortable vocal envelope** (a `[low, high]` semitone range), in
   priority order:
   - **Mic measurement**, if you've done one (Voice Profile tab → "マイク
     で測定する"): sing freely for ~20 seconds, `js/pitch.js` detects your
     pitch in real time via autocorrelation, and the app keeps the 5th–95th
     percentile of everything it detected (trimming outlier frames from
     noise/mic pops) as your low/high notes. This works even with zero
     sing history — the whole point is you can sing once and get matched
     songs immediately.
   - Otherwise, **sing history**: for entries that reference a database
     song, it transposes that song's original notes by the key you sang
     it at, and averages those into the envelope — "the range you've
     actually proven you can sing," not a self-reported label.
   - Otherwise, a **generic default** range, clearly labeled as such.
   - Separately (and only from history, since these aren't range-related),
     it also tracks your most comfortable key adjustment, average score,
     easy/hard tendency, and the gender/genre you tend to do best with.
2. `computeRecommendations(songDB, history, measuredRange)` then, for each
   candidate song, tries every key adjustment from -5 to +5, transposes
   that song's `[lowestNote, highestNote]` by each one, and picks the key
   whose transposed range best fits inside your comfortable envelope
   (going above your comfortable ceiling is penalized more than going
   below the floor, since hitting high notes is usually the harder
   problem in karaoke). Difficulty-vs-your-history and gender/genre
   affinity add smaller bonuses on top (skipped gracefully if you have no
   history yet). The reason text names a specific past song with a
   similar transposed range when one exists, otherwise it describes the
   envelope comparison directly and says which source (mic/history/
   default) the envelope came from.

This is still rule-based (no ML), but it's now grounded in actual note
math instead of a coarse low/medium/high label, which is what makes it
meaningful to scale to a much larger song database.

## Designed to expand later

- **Thousands of songs**: `js/db.js`'s `SongSource.getBuiltInSongs()`
  already fetches the database asynchronously from a JSON file rather
  than holding it as an inline JS array. Swapping `data/songs.json` for a
  much larger file (or pointing the fetch at a real backend/API) requires
  no change to `analysis.js` or `app.js` — they only depend on the
  resolved array of song objects.
- **JOYSOUND song search**: `SongSource.searchJoysound(query)` in
  `js/db.js` is an explicit, currently-empty stub marking where a real
  (legally/technically available) JOYSOUND lookup would plug in, feeding
  the existing `joysound` field and badge.
- **Microphone vocal range detection**: implemented (`js/pitch.js` +
  the Voice Profile tab's measurement flow). It's intentionally a simple
  autocorrelation pitch tracker, not studio-grade — good enough for "am I
  roughly in this range," which is all the recommender needs.
- **AI-based recommendations**: would replace the scoring logic inside
  `computeRecommendations`, but can keep its input (song array + history
  array) and output (`{song, recommendedKey, matchPercent,
  transposedLow, transposedHigh, reason}` array) shape, so `app.js`
  wouldn't need to change.
