import { compactPart1Insights } from "./part1-insights.js";
import { createApiHandler } from "../lib/api-adapter.js";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

function json(status, body) {
  return {
    status,
    headers: { "cache-control": "no-store" },
    body
  };
}

function normalizePayload(body = {}) {
  return {
    context: body.context || {},
    recentTracks: Array.isArray(body.recentTracks) ? body.recentTracks : [],
    candidates: Array.isArray(body.candidates) ? body.candidates : [],
    comfortScore: Number.isFinite(body.comfortScore) ? body.comfortScore : 62
  };
}

function scoreCandidate(candidate, context, recentTracks, comfortScore) {
  const recentArtists = new Set(recentTracks.map((track) => track.artist));
  const hour = Number(context.hour ?? new Date().getHours());
  const evening = hour >= 17 && hour <= 23;
  const tempoTarget = evening ? 0.62 : 0.74;
  const tempoFit = 1 - Math.abs((candidate.energy ?? 0.65) - tempoTarget);
  const novelty = recentArtists.has(candidate.artist) ? -0.35 : 0.25;
  const comfortFit = comfortScore >= 70 ? 0.18 : comfortScore >= 45 ? 0.08 : -0.12;
  const moodFit = candidate.moods?.includes(context.mood) ? 0.16 : 0;
  return tempoFit + novelty + comfortFit + moodFit;
}

function fallbackDecision(payload) {
  const { context, recentTracks, candidates, comfortScore } = payload;
  const queuePosition = Number(context.queuePosition ?? 0);
  const progress = Number(context.progress ?? 0);
  const nearTransition = progress > 0.72 || queuePosition >= 2;
  const recentlyInserted = recentTracks.slice(0, 3).some((track) => track.discovery);
  const allowed = nearTransition && !recentlyInserted && comfortScore >= 38;

  if (!allowed || candidates.length === 0) {
    return {
      insert: false,
      reason: "Hold steady — the session is not ready for discovery yet"
    };
  }

  const chosen = [...candidates].sort(
    (a, b) => scoreCandidate(b, context, recentTracks, comfortScore) - scoreCandidate(a, context, recentTracks, comfortScore)
  )[0];

  const hour = Number(context.hour ?? new Date().getHours());
  const daypart = hour >= 17 ? "evening" : hour < 12 ? "morning" : "afternoon";
  return {
    insert: true,
    track: chosen,
    reason: `New sound — matches your ${daypart} plays`
  };
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Gemini did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function geminiDecision(payload) {
  const prompt = [
    "You are spotify-ai, an AI music queue curator.",
    "Decide whether to insert exactly one new-artist candidate now.",
    "Prefer subtle, contextually smart insertions at transition moments.",
    "Use Part 1 research insights: preserve familiar comfort, avoid repetition, prefer adjacent novelty, match mood/activity, and keep discovery low effort.",
    "Return only JSON with keys: insert boolean, trackId string or null, reason string.",
    "The reason must be one line and under 58 characters.",
    "",
    JSON.stringify({ ...payload, part1Insights: compactPart1Insights() }, null, 2)
  ].join("\n");

  const { data } = await geminiInteraction(prompt, {
    temperature: 0.2,
    max_output_tokens: 500,
    thinking_level: "low"
  });

  const decision = extractJson(extractGeminiText(data));
  const track = payload.candidates.find((candidate) => candidate.id === decision.trackId) || null;

  return {
    insert: Boolean(decision.insert && track),
    track,
    reason: decision.reason || "New sound — fits this moment"
  };
}

async function appHandler(req) {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const payload = normalizePayload(req.body);
  if (payload.candidates.length === 0) return json(400, { error: "At least one candidate track is required" });

  if (!process.env.GEMINI_API_KEY) return json(200, fallbackDecision(payload));

  try {
    return json(200, await geminiDecision(payload));
  } catch (error) {
    return json(200, {
      ...fallbackDecision(payload),
      fallback: true,
      fallbackReason: error.message
    });
  }
}

export default createApiHandler(appHandler);
