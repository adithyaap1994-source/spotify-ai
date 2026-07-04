# spotify-ai

A zero-setup music discovery prototype that simulates a Spotify now-playing screen with an AI layer. The agent inserts one new-artist track into the queue at contextually smart moments, plays it automatically, and keeps a lightweight feedback trail.

## Run Locally

```sh
npm run dev
```

Open `http://localhost:5173`.

No setup is required. Without credentials, the app uses simulated playback and the `/api/decide` function falls back to a deterministic local heuristic.

## Deploy To Vercel

The project is Vercel-ready as a static `public/` app plus Node serverless functions in `api/`.

1. Import the repo in Vercel.
2. Set optional environment variables from `.env.example`, especially `GEMINI_API_KEY` and `MUSICBRAINZ_USER_AGENT`.
3. Deploy. `vercel.json` rewrites non-API routes to `public/index.html` while preserving `/api/*`.

The same API files work in local dev through `dev-server.mjs` and on Vercel through the Node `req, res` handler adapter.

## Optional Integrations

- `GEMINI_API_KEY`: enables Gemini-backed decisions in `/api/decide` and LLM-backed search recommendations in `/api/search` on runtimes with native `fetch` such as Node 18+ or Vercel.
- `GEMINI_MODEL`: optional single-model override. Defaults to `gemini-3.5-flash`.
- `GEMINI_MODELS`: optional comma-separated fallback chain. If omitted, the app tries `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-flash`, then `gemini-2.5-flash-lite`.
- `VITE_SPOTIFY_CLIENT_ID`: placeholder for Spotify Web Playback SDK auth work. The UI loads the SDK and exposes the adapter boundary, but the default prototype remains simulated so it works immediately.
- `MUSICBRAINZ_USER_AGENT`: identifies the prototype to MusicBrainz. Set this to an app name, version, and contact URL/email before sharing.

## API

- `POST /api/decide`: accepts current context, recent tracks, comfort score, and Spotify candidate tracks. Returns `{ insert, track, reason }`.
- `POST /api/feedback`: accepts playback events such as `skip_early`, `full_listen`, `replay`, `saved`, and `kept`. Returns an updated comfort score and recent events.
- `POST /api/musicbrainz`: enriches up to 8 track objects with MusicBrainz recording, release, tag, genre, and date metadata. Requests are proxied server-side and paced to respect MusicBrainz rate limits.
- `POST /api/search`: asks Gemini for real song recommendations from a user query, validates those song/artist pairs against MusicBrainz recordings, and returns matched tracks for the Copilot suggestions screen. Without `GEMINI_API_KEY`, it uses a deterministic local LLM fallback before the MusicBrainz validation step.
  Searches request up to 10 Gemini suggestions, cache identical requests briefly, retry rate limits once per model, and fall through the configured Gemini model chain before using the local fallback.

## Product Notes

- Discovery tracks play automatically when inserted.
- The reason appears as a subtle badge on the track card, not a modal.
- The Discovery tab shows the last 10 inserted tracks, their result, and a 0-100 comfort score.
