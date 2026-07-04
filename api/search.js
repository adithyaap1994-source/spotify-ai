import https from "node:https";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { compactPart1Insights } from "./part1-insights.js";
import { createApiHandler } from "../lib/api-adapter.js";

const API_ROOT = "https://musicbrainz.org/ws/2";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT || "spotify-ai/0.1 (local-prototype@example.com)";
const SEARCH_SUGGESTION_LIMIT = 10;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
let lastRequestAt = 0;
const execFileAsync = promisify(execFile);
const searchResponseCache = new Map();

function json(status, body) {
  return { status, headers: { "cache-control": "no-store" }, body };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKeyFor(body = {}) {
  return JSON.stringify({
    query: String(body.query || "").trim().toLowerCase(),
    mood: body.context?.mood,
    activity: body.context?.activity,
    appetite: body.context?.appetite,
    comfortScore: body.comfortScore,
    lastFeedback: body.feedbackSignals?.lastFeedback
  });
}

function cachedSearchResponse(cacheKey) {
  const cached = searchResponseCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > SEARCH_CACHE_TTL_MS) {
    searchResponseCache.delete(cacheKey);
    return null;
  }
  return {
    ...cached.body,
    source: `${cached.body.source} cached`,
    cached: true
  };
}

function storeSearchResponse(cacheKey, body) {
  searchResponseCache.set(cacheKey, { createdAt: Date.now(), body });
}

function geminiModelCandidates() {
  const configured = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set([...configured, ...DEFAULT_GEMINI_MODELS])];
}

async function responseErrorMessage(response, model) {
  let details = "";
  try {
    const body = await response.text();
    details = body ? `: ${body.slice(0, 240)}` : "";
  } catch (error) {
    details = "";
  }

  if (response.status === 429) return `${model} rate-limited this key${details}`;
  if (response.status === 404) return `${model} is unavailable for this key or API version${details}`;
  return `${model} request failed with ${response.status}${details}`;
}

async function geminiInteraction(input, generationConfig) {
  const errors = [];

  for (const model of geminiModelCandidates()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          model,
          input,
          generation_config: generationConfig
        })
      });

      if (response.ok) return { model, data: await response.json() };

      const message = await responseErrorMessage(response, model);
      errors.push(message);
      if (response.status !== 429 || attempt === 1) break;
      await sleep(1200 + attempt * 1800);
    }
  }

  throw new Error(`Gemini models unavailable: ${errors.join(" | ")}`);
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        family: 4,
        headers: {
          accept: "application/json",
          "user-agent": USER_AGENT
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`MusicBrainz returned ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("MusicBrainz request timed out")));
  });
}

async function getJsonWithCurl(url) {
  if (!existsSync("/usr/bin/curl")) throw new Error("curl is unavailable in this runtime");
  const { stdout } = await execFileAsync("/usr/bin/curl", [
    "-sS",
    "--fail",
    "-4",
    "--max-time",
    "12",
    "-H",
    "accept: application/json",
    "-H",
    `user-agent: ${USER_AGENT}`,
    String(url)
  ]);
  return JSON.parse(stdout);
}

async function getJsonWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await getJson(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(450 + attempt * 650);
    }
  }
  try {
    return await getJsonWithCurl(url);
  } catch (curlError) {
    throw new Error(`${lastError.message}; curl fallback failed: ${curlError.message}`);
  }
}

async function musicBrainzSearch(query, limit = 18) {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1100) await sleep(1100 - elapsed);
  lastRequestAt = Date.now();

  const url = new URL(`${API_ROOT}/recording`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("inc", "artist-credits+releases+tags+genres");
  url.searchParams.set("fmt", "json");
  return getJsonWithRetry(url);
}

async function appleSearch(query) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "18");
  url.searchParams.set("country", "US");
  return getJson(url);
}

function artistCreditName(artistCredit = []) {
  return artistCredit.map((credit) => credit.name).filter(Boolean).join(", ");
}

function normalizeRecording(recording) {
  const release = recording.releases?.[0] || null;
  return {
    id: `mb-${recording.id}`,
    mbid: recording.id,
    title: recording.title,
    artist: artistCreditName(recording["artist-credit"]) || "Unknown artist",
    duration: Math.max(120, Math.round((recording.length || 210000) / 1000)),
    score: recording.score || 0,
    firstReleaseDate: recording["first-release-date"] || release?.date || null,
    release: release
      ? {
          title: release.title,
          date: release.date || null,
          country: release.country || null,
          status: release.status || null
        }
      : null,
    tags: (recording.tags || []).slice(0, 5).map((tag) => tag.name),
    genres: (recording.genres || []).slice(0, 5).map((genre) => genre.name)
  };
}

function normalizeAppleTrack(track) {
  return {
    id: `apple-${track.trackId}`,
    provider: "Apple Search",
    title: track.trackName,
    artist: track.artistName,
    duration: Math.max(120, Math.round((track.trackTimeMillis || 210000) / 1000)),
    score: 80,
    firstReleaseDate: track.releaseDate ? track.releaseDate.slice(0, 10) : null,
    release: {
      title: track.collectionName || null,
      date: track.releaseDate ? track.releaseDate.slice(0, 10) : null,
      country: track.country || null,
      status: "Catalog"
    },
    tags: track.primaryGenreName ? [track.primaryGenreName] : [],
    genres: track.primaryGenreName ? [track.primaryGenreName] : []
  };
}

function normalizedText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value) {
  return normalizedText(value).split(/\s+/).filter(Boolean);
}

function overlapScore(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function extractJson(text) {
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) return JSON.parse(text.slice(arrayStart, arrayEnd + 1));

  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) throw new Error("LLM did not return JSON");
  const parsed = JSON.parse(text.slice(objectStart, objectEnd + 1));
  return Array.isArray(parsed.suggestions) ? parsed.suggestions : parsed;
}

function extractGeminiText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  if (typeof data.outputText === "string") return data.outputText;
  if (typeof data.text === "string") return data.text;

  const stepText = (data.steps || [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  if (stepText) return stepText;

  const chunks = [];
  const visit = (value, key = "") => {
    if (!value) return;
    if (typeof value === "string" && (key === "text" || key === "output_text" || key === "outputText")) {
      chunks.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
    }
  };
  visit(data);
  return chunks.join("");
}

function normalizeLlmSuggestion(item, index) {
  const title = String(item?.title || item?.song || "").trim();
  const artist = String(item?.artist || "").trim();
  if (!title || !artist) return null;
  return {
    id: `llm-${index + 1}`,
    title,
    artist,
    reason: String(item.reason || item.why || "LLM match for this search").trim().slice(0, 120)
  };
}

function fallbackLlmSuggestions(query) {
  const lower = normalizedText(query);
  const themeTokens = ["travel", "road", "drive", "night", "chill", "focus", "study", "dance", "party", "workout", "rain", "evening"];
  const artistSeeds = [
    {
      match: ["dua", "lipa"],
      suggestions: [
        ["Levitating", "Dua Lipa", "Bright pop with a familiar Dua Lipa lift"],
        ["Physical", "Dua Lipa", "High-energy pop that fits a dance-forward search"],
        ["Houdini", "Dua Lipa", "Sleek synth-pop with newer-release energy"],
        ["Don't Start Now", "Dua Lipa", "Disco-pop groove with broad catalog fit"],
        ["Training Season", "Dua Lipa", "Polished pop with confident tempo"],
        ["New Rules", "Dua Lipa", "Recognizable hook with clean mainstream fit"]
      ]
    },
    {
      match: ["arijit", "singh"],
      suggestions: [
        ["Tum Hi Ho", "Arijit Singh", "Emotional vocal match for Arijit Singh intent"],
        ["Channa Mereya", "Arijit Singh", "Melodic ballad with strong artist relevance"],
        ["Kesariya", "Arijit Singh", "Warm modern Bollywood fit"],
        ["Raabta", "Arijit Singh", "Romantic texture with familiar vocal style"],
        ["Agar Tum Saath Ho", "Alka Yagnik, Arijit Singh", "Slow emotional duet match"],
        ["Ae Dil Hai Mushkil", "Arijit Singh", "Big cinematic vocal moment"]
      ]
    }
  ];

  const artistSeed = artistSeeds.find((seed) => seed.match.every((token) => lower.includes(token)));
  if (artistSeed) {
    return artistSeed.suggestions
      .map(([title, artist, reason], index) => normalizeLlmSuggestion({ title, artist, reason }, index))
      .slice(0, SEARCH_SUGGESTION_LIMIT);
  }

  if (!themeTokens.some((token) => lower.includes(token)) || /\b(from|movie|film|album|soundtrack|ost)\b/.test(lower)) {
    return [];
  }

  const themeSuggestions = [
    ["Sweet Disposition", "The Temper Trap", "Expansive travel-ready indie lift"],
    ["Midnight City", "M83", "Night-drive synth energy for a journey mood"],
    ["Walking on a Dream", "Empire of the Sun", "Dreamy pop with movement and color"],
    ["Home", "Edward Sharpe & The Magnetic Zeros", "Warm communal feel for comfort"],
    ["Send Me On My Way", "Rusted Root", "Sunny motion with road-trip familiarity"],
    ["Intro", "The xx", "Minimal pulse for focused transitions"],
    ["1901", "Phoenix", "Bright indie-pop motion for open-road energy"],
    ["Dog Days Are Over", "Florence + The Machine", "Big cathartic lift with momentum"],
    ["Young Folks", "Peter Bjorn and John", "Whistled indie groove with easy movement"],
    ["Electric Feel", "MGMT", "Colorful psych-pop with nighttime shimmer"],
    ["Rill Rill", "Sleigh Bells", "Playful sample-pop with relaxed bounce"],
    ["Lisztomania", "Phoenix", "Quick melodic spark for upbeat discovery"],
    ["Kids", "MGMT", "Familiar synth-pop glow with nostalgic pull"],
    ["Take a Walk", "Passion Pit", "Driving pop pulse for movement"],
    ["Sleepyhead", "Passion Pit", "Glassy electronic pop with lift"],
    ["Such Great Heights", "The Postal Service", "Soft electronic optimism"],
    ["The Less I Know the Better", "Tame Impala", "Groovy psych-pop with wide appeal"],
    ["Wide Open", "The Chemical Brothers", "Expansive electronic travel feel"],
    ["A-Punk", "Vampire Weekend", "Compact upbeat indie burst"],
    ["Two Weeks", "Grizzly Bear", "Warm harmonic indie texture"]
  ];

  return themeSuggestions.map(([title, artist, reason], index) =>
    normalizeLlmSuggestion(
      {
        title,
        artist,
        reason: lower ? `${reason}; inferred from "${query}"` : reason
      },
      index
    )
  ).slice(0, SEARCH_SUGGESTION_LIMIT);
}

async function llmSuggestions(query, recommendationContext = {}) {
  if (!process.env.GEMINI_API_KEY) {
    const suggestions = fallbackLlmSuggestions(query);
    return {
      source: "LLM fallback",
      suggestions,
      warning: suggestions.length > 0 ? "Gemini API key is not configured; using limited local fallback." : "Gemini API key is not configured."
    };
  }

  const prompt = [
    "You are spotify-ai, an AI music discovery copilot.",
    "A user typed a song, artist, pattern, or theme into search.",
    "Use the supplied Spotify-like catalog, current user context, and Part 1 research insights to choose songs.",
    `Suggest ${SEARCH_SUGGESTION_LIMIT} real, likely MusicBrainz-indexed songs that satisfy the intent.`,
    "If the query asks for songs from a movie, album, soundtrack, show, or source title, return songs from that exact source only.",
    "If you cannot identify real songs for that source, return an empty JSON array.",
    "Prefer specific recording titles and primary artists. Avoid invented songs.",
    "Do not reinterpret unknown source titles as a generic mood or theme.",
    "Apply Part 1 insight rules: controlled novelty, low effort, current mood/activity fit, avoid repetition, and escape taste bubbles gently.",
    "Return only JSON array items with: title, artist, reason.",
    "Each reason must be one short sentence under 90 characters and reference one context or insight signal.",
    "",
    JSON.stringify(
      {
        userSearch: query,
        spotifyCatalog: recommendationContext.spotifyCatalog || [],
        userContext: recommendationContext.context || {},
        recentTracks: recommendationContext.recentTracks || [],
        comfortScore: recommendationContext.comfortScore,
        feedbackSignals: recommendationContext.feedbackSignals || {},
        part1Insights: compactPart1Insights()
      },
      null,
      2
    )
  ].join("\n");

  const { model, data } = await geminiInteraction(prompt, {
    temperature: 0.35,
    max_output_tokens: 1400,
    thinking_level: "low"
  });
  const parsed = extractJson(extractGeminiText(data));
  const suggestions = (Array.isArray(parsed) ? parsed : [])
    .map(normalizeLlmSuggestion)
    .filter(Boolean)
    .slice(0, SEARCH_SUGGESTION_LIMIT);

  if (suggestions.length === 0) throw new Error("Gemini returned no usable song suggestions");
  return { source: `Gemini ${model} + MusicBrainz`, suggestions };
}

function buildLlmMusicBrainzQuery(suggestion) {
  const cleanTitle = suggestion.title.replaceAll('"', "");
  const cleanArtist = suggestion.artist.replaceAll('"', "");
  return `recording:"${cleanTitle}" AND artist:"${cleanArtist}"`;
}

function pickBestMusicBrainzMatch(suggestion, recordings = []) {
  const ranked = recordings.map(normalizeRecording).map((track) => {
    const titleFit = overlapScore(track.title, suggestion.title);
    const artistFit = overlapScore(track.artist, suggestion.artist);
    const normalizedTrackTitle = normalizedText(track.title);
    const normalizedSuggestionTitle = normalizedText(suggestion.title);
    const exactTitle = normalizedTrackTitle === normalizedSuggestionTitle ? 0.35 : 0;
    const titleContains = normalizedTrackTitle.includes(normalizedSuggestionTitle) || normalizedSuggestionTitle.includes(normalizedTrackTitle);
    const exactArtist = normalizedText(track.artist).includes(normalizedText(suggestion.artist)) ? 0.25 : 0;
    return {
      track,
      titleFit,
      titleContains,
      exactTitle,
      matchScore: titleFit * 0.52 + artistFit * 0.36 + exactTitle + exactArtist + (track.score || 0) / 1000
    };
  });

  const best = ranked.sort((a, b) => b.matchScore - a.matchScore)[0];
  const titleMatched = best?.exactTitle > 0 || best?.titleContains || best?.titleFit >= 0.5;
  if (!best || best.matchScore < 0.42 || !titleMatched) return null;
  return {
    ...best.track,
    provider: "LLM + MusicBrainz",
    llmReason: suggestion.reason,
    llmSuggestion: {
      title: suggestion.title,
      artist: suggestion.artist
    }
  };
}

async function musicBrainzMatchesForSuggestions(suggestions) {
  const matches = [];
  const errors = [];

  for (const suggestion of suggestions.slice(0, SEARCH_SUGGESTION_LIMIT)) {
    try {
      const exactResult = await musicBrainzSearch(buildLlmMusicBrainzQuery(suggestion), 4);
      let match = pickBestMusicBrainzMatch(suggestion, exactResult.recordings || []);

      if (!match) {
        const broadResult = await musicBrainzSearch(`${suggestion.title} ${suggestion.artist}`, 4);
        match = pickBestMusicBrainzMatch(suggestion, broadResult.recordings || []);
      }

      if (match && !matches.some((track) => track.mbid === match.mbid)) matches.push(match);
    } catch (error) {
      errors.push(`${suggestion.title} — ${error.message}`);
    }
  }

  return { matches, errors };
}

async function appleFallbackResponse(query, warning) {
  const appleResult = await appleSearch(query);
  const appleTracks = (appleResult.results || []).map(normalizeAppleTrack);
  if (appleTracks.length === 0) return null;
  return {
    source: "Apple Search fallback",
    query,
    results: appleTracks,
    warning
  };
}

const cachedMusicBrainzResults = [
  {
    id: "mb-ad494726-fddb-43ad-9ba7-4dc14d591573",
    mbid: "ad494726-fddb-43ad-9ba7-4dc14d591573",
    title: "TRAVEL TRAVEL",
    artist: "Taja",
    duration: 210,
    score: 100,
    firstReleaseDate: "2006",
    release: { title: "Love Today", date: "2006", country: "JP", status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-a08641a3-4a8d-42c9-a1a6-1aa016f60794",
    mbid: "a08641a3-4a8d-42c9-a1a6-1aa016f60794",
    title: "Travel Travel",
    artist: "Fuck It",
    duration: 222,
    score: 100,
    firstReleaseDate: "2020-02-28",
    release: { title: "Dancing With Sharks", date: "2020-02-28", country: "XW", status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-a1e67ff4-3837-43ee-8d60-c91781cec70c",
    mbid: "a1e67ff4-3837-43ee-8d60-c91781cec70c",
    title: "Travel, Travel On",
    artist: "Dry Branch Fire Squad",
    duration: 122,
    score: 91,
    firstReleaseDate: "1981",
    release: { title: "Antiques and Inventions", date: "1981", country: "US", status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-5ad4ebef-5aad-4536-a3a4-0180e79b697d",
    mbid: "5ad4ebef-5aad-4536-a3a4-0180e79b697d",
    title: "Travel, Travel On",
    artist: "Lorraine Jordan, Carolina Road",
    duration: 136,
    score: 91,
    firstReleaseDate: "2021",
    release: { title: "I Can Go to Them", date: "2021", country: "US", status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-06e0e166-1466-45ac-b7c0-d98f14e22eac",
    mbid: "06e0e166-1466-45ac-b7c0-d98f14e22eac",
    title: "Travel Time Travel",
    artist: "Noise Haircut",
    duration: 120,
    score: 91,
    firstReleaseDate: "2011",
    release: { title: "3 Way Split", date: "2011", country: "US", status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-cae00904-8496-417e-89a1-eb861b9bba43",
    mbid: "cae00904-8496-417e-89a1-eb861b9bba43",
    title: "Travel",
    artist: "La Famille Bou",
    duration: 224,
    score: 90,
    firstReleaseDate: "2008-03-31",
    release: { title: "Come What May", date: "2008-03-31", country: "FR", status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-724fb3bb-9c5d-47a5-9483-631db21fe4a8",
    mbid: "724fb3bb-9c5d-47a5-9483-631db21fe4a8",
    title: "Arijit Singh Mashup",
    artist: "Arijit Singh",
    duration: 245,
    score: 100,
    firstReleaseDate: "2015-04-20",
    release: { title: "Arijit Singh Mashup", date: "2015-04-20", country: "XW", status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-3f316954-eec0-42a2-96e1-bdcb9d22f4aa",
    mbid: "3f316954-eec0-42a2-96e1-bdcb9d22f4aa",
    title: "Arijit Singh (Mashup)",
    artist: "Various Artists",
    duration: 249,
    score: 100,
    firstReleaseDate: "2015",
    release: { title: "Mashups - (Remixes 2015)", date: null, country: null, status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-b207b385-a7f6-4967-95e3-fe7f98f80a46",
    mbid: "b207b385-a7f6-4967-95e3-fe7f98f80a46",
    title: "Atak Gaya (Arijit Singh)",
    artist: "Arijit Singh, Rupali Moghe",
    duration: 199,
    score: 89,
    firstReleaseDate: "2022-02-01",
    release: { title: "Badhaai Do", date: "2022-02-01", country: "XW", status: "Official" },
    tags: [],
    genres: []
  },
  {
    id: "mb-4834c898-af32-42af-aad7-694e7f194ba5",
    mbid: "4834c898-af32-42af-aad7-694e7f194ba5",
    title: "The Arijit Singh Classic Mashup",
    artist: "Arijit Singh",
    duration: 290,
    score: 80,
    firstReleaseDate: "2016-08-29",
    release: { title: "The Arijit Singh Classic Mashup", date: "2016-08-29", country: "XW", status: "Official" },
    tags: [],
    genres: []
  }
];

function cachedResultsFor(query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return cachedMusicBrainzResults.filter((track) => {
    const haystack = `${track.title} ${track.artist} ${track.release?.title || ""}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });
}

async function appHandler(req) {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const query = String(req.body?.query || "").trim();
  if (!query) return json(400, { error: "Search query is required" });

  const cacheKey = cacheKeyFor(req.body);
  const cachedResponse = cachedSearchResponse(cacheKey);
  if (cachedResponse) return json(200, cachedResponse);

  let llmResult;
  try {
    llmResult = await llmSuggestions(query, {
      context: req.body?.context || {},
      recentTracks: Array.isArray(req.body?.recentTracks) ? req.body.recentTracks.slice(0, 8) : [],
      comfortScore: Number.isFinite(req.body?.comfortScore) ? req.body.comfortScore : undefined,
      feedbackSignals: req.body?.feedbackSignals || {},
      spotifyCatalog: Array.isArray(req.body?.spotifyCatalog) ? req.body.spotifyCatalog.slice(0, 40) : []
    });
  } catch (error) {
    llmResult = {
      source: "LLM fallback",
      suggestions: fallbackLlmSuggestions(query),
      warning: error.message
    };
  }

  if (llmResult.suggestions.length === 0) {
    const body = {
      source: llmResult.source,
      query,
      results: [],
      llmSuggestions: [],
      error: llmResult.warning || "Gemini did not return usable song suggestions for this query."
    };
    storeSearchResponse(cacheKey, body);
    return json(200, body);
  }

  try {
    const { matches, errors } = await musicBrainzMatchesForSuggestions(llmResult.suggestions);
    if (matches.length > 0) {
      const body = {
        source: llmResult.source.includes("MusicBrainz") ? llmResult.source : `${llmResult.source} + MusicBrainz`,
        query,
        results: matches,
        llmSuggestions: llmResult.suggestions,
        warning: [llmResult.warning, errors.length ? `${errors.length} LLM suggestions had no MusicBrainz match.` : ""].filter(Boolean).join(" ")
      };
      storeSearchResponse(cacheKey, body);
      return json(200, body);
    }

    const body = {
      source: llmResult.source.includes("MusicBrainz") ? llmResult.source : `${llmResult.source} + MusicBrainz`,
      query,
      results: [],
      llmSuggestions: llmResult.suggestions,
      error: errors.length
        ? "Gemini suggested songs, but MusicBrainz did not confirm any of them."
        : "Gemini suggested songs, but no MusicBrainz recordings matched."
    };
    storeSearchResponse(cacheKey, body);
    return json(200, body);
  } catch (error) {
    const body = {
      source: llmResult.source.includes("MusicBrainz") ? llmResult.source : `${llmResult.source} + MusicBrainz`,
      query,
      results: [],
      llmSuggestions: llmResult.suggestions,
      error: `Gemini suggested songs, but MusicBrainz lookup failed: ${error.message}`
    };
    storeSearchResponse(cacheKey, body);
    return json(200, body);
  }
}

export default createApiHandler(appHandler);
