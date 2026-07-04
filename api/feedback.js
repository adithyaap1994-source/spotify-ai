import { randomUUID } from "node:crypto";
import { createApiHandler } from "../lib/api-adapter.js";

const eventLog = [];

const scoreDelta = {
  skip_early: -8,
  full_listen: 6,
  replay: 8,
  saved: 10,
  kept: 4
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function json(status, body) {
  return {
    status,
    headers: { "cache-control": "no-store" },
    body
  };
}

async function appHandler(req) {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const event = req.body || {};
  const type = event.type;
  if (!Object.prototype.hasOwnProperty.call(scoreDelta, type)) {
    return json(400, { error: "Unknown feedback event" });
  }

  const previousScore = Number.isFinite(event.comfortScore) ? event.comfortScore : 62;
  const comfortScore = clamp(previousScore + scoreDelta[type], 0, 100);
  const entry = {
    id: randomUUID(),
    type,
    track: event.track || null,
    comfortScore,
    createdAt: new Date().toISOString()
  };

  eventLog.unshift(entry);
  eventLog.splice(25);

  return json(200, {
    comfortScore,
    event: entry,
    recentEvents: eventLog.slice(0, 10)
  });
}

export default createApiHandler(appHandler);
