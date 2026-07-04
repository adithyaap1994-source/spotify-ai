import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

loadDotEnv();

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const apiDir = path.join(__dirname, "api");
const publicDir = path.join(__dirname, "public");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"]
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function invokeApi(req, res, pathname) {
  const name = pathname.replace("/api/", "");
  const filePath = path.join(apiDir, `${name}.js`);
  if (!existsSync(filePath)) return false;

  const mod = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
  const payload = await readBody(req);
  const response = await mod.default({
    method: req.method,
    headers: req.headers,
    body: payload
  });

  send(res, response.status || 200, JSON.stringify(response.body), {
    "content-type": "application/json; charset=utf-8",
    ...response.headers
  });
  return true;
}

async function serveStatic(res, pathname) {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, normalized));
  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden");
    return;
  }

  const candidate = existsSync(filePath) ? filePath : path.join(publicDir, "index.html");
  const ext = path.extname(candidate);
  const body = await readFile(candidate);
  send(res, 200, body, {
    "content-type": mimeTypes.get(ext) || "application/octet-stream",
    "cache-control": "no-store"
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await invokeApi(req, res, url.pathname);
      if (!handled) send(res, 404, JSON.stringify({ error: "Not found" }), { "content-type": "application/json" });
      return;
    }

    await serveStatic(res, url.pathname);
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }), { "content-type": "application/json" });
  }
});

server.listen(port, host, () => {
  console.log(`spotify-ai running at http://${host}:${port}`);
});
