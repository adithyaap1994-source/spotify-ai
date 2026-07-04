async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
    return req.body || {};
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function createApiHandler(appHandler) {
  return async function handler(req, res) {
    const request = res
      ? {
          method: req.method,
          headers: req.headers || {},
          body: await readBody(req)
        }
      : req;

    const response = await appHandler(request);
    if (!res) return response;

    const status = response.status || 200;
    const headers = response.headers || {};
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    res.status(status).json(response.body);
    return undefined;
  };
}
