import https from "node:https";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { createApiHandler } from "../lib/api-adapter.js";

const API_ROOT = "https://musicbrainz.org/ws/2";
const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ||
  "spotify-ai/0.1 (local-prototype@example.com)";

const cache = new Map();
let lastRequestAt = 0;
const execFileAsync = promisify(execFile);

function json(status, body) {
  return { status, headers: { "cache-control": "no-store" }, body };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        family: 4,
        timeout: 12000,
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
            reject(
              new Error(
                `MusicBrainz returned ${res.statusCode}: ${body.slice(0, 200)}`
              )
            );
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Failed to parse MusicBrainz JSON: ${error.message}`));
          }
        });
      }
    );

    req.on("socket", (socket) => {
      socket.on("secureConnect", () => {
        console.log(
          "MusicBrainz TLS connected:",
          socket.getProtocol(),
          socket.getCipher()?.name
        );
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("MusicBrainz request timed out"));
    });

    req.on("error", reject);
  });
}

async function getJsonWithCurl(url) {
  if (!existsSync("/usr/bin/curl")) throw new Error("curl is unavailable in this runtime");
  const { stdout } = await execFileAsync("/usr/bin/curl", [
    "-sS",
    "--fail",
    "--http1.1",
    "-4",
    "--max-time",
    "15",
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

      if (attempt < attempts - 1) {
        await sleep(600 + attempt * 900);
      }
    }
  }

  try {
    return await getJsonWithCurl(url);
  } catch (curlError) {
    throw new Error(
      `${lastError?.message || "MusicBrainz request failed"}; curl fallback failed: ${
        curlError.message
      }`
    );
  }
}

async function musicBrainzRequest(path, params = {}) {
  const elapsed = Date.now() - lastRequestAt;

  if (elapsed < 1200) {
    await sleep(1200 - elapsed);
  }

  lastRequestAt = Date.now();

  const url = new URL(`${API_ROOT}${path}`);

  Object.entries({ ...params, fmt: "json" }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return getJsonWithRetry(url);
}

function artistCreditName(artistCredit = []) {
  return artistCredit
    .map((credit) => credit.name || credit.artist?.name)
    .filter(Boolean)
    .join(", ");
}

function pickRelease(recording) {
  const releases = recording.releases || [];
  return releases.find((release) => release.date) || releases[0] || null;
}

function normalizeRecording(recording) {
  const release = pickRelease(recording);

  return {
    mbid: recording.id || null,
    score: recording.score || null,
    title: recording.title || "",
    artist: artistCreditName(recording["artist-credit"]),
    lengthMs: recording.length || null,
    firstReleaseDate: recording["first-release-date"] || release?.date || null,
    release: release
      ? {
          id: release.id,
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

function buildRecordingQuery(track) {
  const title = String(track.title || "").trim();
  const artist = String(track.artist || "").trim();

  const parts = [];

  if (title) parts.push(`recording:"${title.replaceAll('"', "")}"`);
  if (artist) parts.push(`artist:"${artist.replaceAll('"', "")}"`);

  return parts.join(" AND ");
}

async function enrichTrack(track) {
  const key = `${track.title || ""}::${track.artist || ""}`.toLowerCase();

  if (cache.has(key)) return cache.get(key);

  const query = buildRecordingQuery(track);

  if (!query) {
    cache.set(key, null);
    return null;
  }

  // Step 1: Search recording. Do NOT use inc here.
  const searchResult = await musicBrainzRequest("/recording", {
    query,
    limit: 1
  });

  const recording = searchResult.recordings?.[0];

  if (!recording?.id) {
    cache.set(key, null);
    return null;
  }

  // Step 2: Lookup recording details by MBID with includes.
  const detailedRecording = await musicBrainzRequest(`/recording/${recording.id}`, {
    inc: "artists+releases+tags+genres"
  });

  const enriched = normalizeRecording({
    ...recording,
    ...detailedRecording,
    score: recording.score
  });

  cache.set(key, enriched);
  return enriched;
}

async function appHandler(req) {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const tracks = Array.isArray(req.body?.tracks)
    ? req.body.tracks.slice(0, 8)
    : [];

  if (tracks.length === 0) {
    return json(400, { error: "Provide at least one track" });
  }

  const enriched = [];
  const errors = [];

  for (const track of tracks) {
    try {
      enriched.push({
        id: track.id,
        title: track.title,
        artist: track.artist,
        musicbrainz: await enrichTrack(track)
      });
    } catch (error) {
      errors.push({
        id: track.id,
        title: track.title,
        artist: track.artist,
        message: error.message
      });

      enriched.push({
        id: track.id,
        title: track.title,
        artist: track.artist,
        musicbrainz: null
      });
    }
  }

  return json(200, {
    source: "MusicBrainz",
    userAgent: USER_AGENT,
    enriched,
    errors
  });
}

export default createApiHandler(appHandler);
