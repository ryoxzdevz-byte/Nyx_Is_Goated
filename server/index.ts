import http from "node:http";
import { Readable } from "node:stream";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAdjustedTimestamp,
  getServerTimeOffset,
  signCoverUrl,
  signMonitorRequest,
  signRawPayload,
  signRequest,
  syncServerTime,
} from "../electron/crypto.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";
const API_ORIGIN = (
  process.env.LINER_API_ORIGIN ?? "https://api.tryliner.fun"
).replace(/\/+$/, "");
const API_TOKEN = process.env.NYX_API_TOKEN?.trim() ?? "";
const DIST_DIR = path.resolve(
  fileURLToPath(new URL("../dist", import.meta.url)),
);
const MAX_BODY = 16 * 1024 * 1024;

type Incoming = http.IncomingMessage;
type Outgoing = http.ServerResponse;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
};

function applyCors(res: Outgoing): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, authorization, x-nyx-token, x-request-id, x-client-version, x-platform, x-user-id, x-user-name, x-session-id, x-liner-signature, x-liner-timestamp, x-liner-nonce",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Access-Control-Expose-Headers", "*");
}

function sendJson(res: Outgoing, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

async function readBody(req: Incoming): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    size += buf.length;
    if (size > MAX_BODY) throw new Error("Request body too large");
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(raw: string): Record<string, any> {
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object");
  }
  return value as Record<string, any>;
}

function authorized(req: Incoming): boolean {
  if (!API_TOKEN) return true;
  return req.headers["x-nyx-token"] === API_TOKEN;
}

function syncClock(headers: Headers): void {
  const date = headers.get("date");
  if (date) syncServerTime(date);
}

function upstreamHeaders(
  req: Incoming,
  signed: { signature: string; timestamp: number; nonce: string },
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: req.headers.accept ?? "*/*",
    "Content-Type":
      typeof req.headers["content-type"] === "string"
        ? req.headers["content-type"]
        : "application/json",
    "x-liner-signature": signed.signature,
    "x-liner-timestamp": String(signed.timestamp),
    "x-liner-nonce": signed.nonce,
    "x-platform": "ios",
  };
  for (const key of [
    "authorization",
    "x-request-id",
    "x-client-version",
    "x-user-id",
    "x-user-name",
    "x-session-id",
  ]) {
    const value = req.headers[key];
    if (typeof value === "string") headers[key] = value;
  }
  return headers;
}

async function proxyLiner(
  req: Incoming,
  res: Outgoing,
  raw: string,
): Promise<void> {
  const suffix = (req.url ?? "").slice("/api/liner".length) || "/";
  const target = `${API_ORIGIN}${suffix}`;
  const signed = signRequest({
    method: req.method ?? "GET",
    path: suffix,
    body: raw || undefined,
  });

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method ?? "GET",
      headers: upstreamHeaders(req, signed),
      body: ["GET", "HEAD"].includes(req.method ?? "GET")
        ? undefined
        : raw || undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    sendJson(res, 502, {
      error: "Upstream request failed",
      detail: String(error),
    });
    return;
  }

  syncClock(upstream.headers);
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (
      key === "content-encoding" ||
      key === "content-length" ||
      key === "transfer-encoding" ||
      key === "connection"
    )
      return;
    if (key.startsWith("access-control-")) return;
    res.setHeader(key, value);
  });
  applyCors(res);

  if (!upstream.body) {
    res.end();
    return;
  }
  Readable.fromWeb(
    upstream.body as import("node:stream/web").ReadableStream,
  ).pipe(res);
}

async function refreshSession(
  res: Outgoing,
  body: Record<string, any>,
): Promise<void> {
  const refreshToken =
    typeof body.refreshToken === "string" ? body.refreshToken : "";
  if (!refreshToken) {
    sendJson(res, 400, { error: "refreshToken is required" });
    return;
  }
  const payload = JSON.stringify({ refreshToken });
  const signed = signRequest({
    method: "POST",
    path: "/v1/auth/refresh",
    body: payload,
  });
  let upstream: Response;
  try {
    upstream = await fetch(`${API_ORIGIN}/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-liner-signature": signed.signature,
        "x-liner-timestamp": String(signed.timestamp),
        "x-liner-nonce": signed.nonce,
        "x-platform": "ios",
      },
      body: payload,
    });
  } catch (error) {
    sendJson(res, 502, {
      error: "Refresh request failed",
      detail: String(error),
    });
    return;
  }
  syncClock(upstream.headers);
  const text = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
  );
  applyCors(res);
  res.end(text);
}

function signHeaders(input: Record<string, any>, monitor: boolean) {
  const signed = monitor
    ? signMonitorRequest({
        method: String(input.method ?? "GET"),
        path: String(input.path ?? "/"),
        body: input.body == null ? undefined : String(input.body),
        timestamp:
          typeof input.timestamp === "number" ? input.timestamp : undefined,
      })
    : signRequest({
        method: String(input.method ?? "GET"),
        path: String(input.path ?? "/"),
        body: input.body == null ? undefined : String(input.body),
        timestamp:
          typeof input.timestamp === "number" ? input.timestamp : undefined,
      });
  return {
    signature: signed.signature,
    timestamp: signed.timestamp,
    nonce: signed.nonce,
  };
}

async function serveStatic(req: Incoming, res: Outgoing): Promise<void> {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  let filePath = path.resolve(DIST_DIR, relative);
  if (!filePath.startsWith(DIST_DIR + path.sep) && filePath !== DIST_DIR) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    if (!path.extname(relative)) filePath = path.join(DIST_DIR, "index.html");
  }
  try {
    const data = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    );
    res.setHeader("Content-Length", data.length);
    if (path.extname(filePath) === ".html")
      res.setHeader("Cache-Control", "no-cache");
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = req.url ?? "/";
  try {
    if (url === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        version: "1",
        apiOrigin: API_ORIGIN,
        adjustedTimestamp: getAdjustedTimestamp(),
      });
      return;
    }
    if (!authorized(req)) {
      sendJson(res, 401, { error: "Invalid API token" });
      return;
    }

    const raw = ["GET", "HEAD"].includes(req.method ?? "GET")
      ? ""
      : await readBody(req);

    if (url.startsWith("/api/bridge/")) {
      const endpoint = url.split("?")[0];
      const body = parseJson(raw);
      switch (endpoint) {
        case "/api/bridge/sign":
          sendJson(res, 200, signHeaders(body, false));
          return;
        case "/api/bridge/sign-monitor":
          sendJson(res, 200, signHeaders(body, true));
          return;
        case "/api/bridge/sign-raw": {
          const payload =
            typeof body.payload === "string"
              ? Buffer.from(body.payload, "base64")
              : Buffer.alloc(0);
          sendJson(res, 200, { signature: signRawPayload(payload) });
          return;
        }
        case "/api/bridge/sign-cover": {
          const payload = typeof body.payload === "string" ? body.payload : "";
          sendJson(res, 200, { token: signCoverUrl(payload) });
          return;
        }
        case "/api/bridge/time": {
          if (typeof body.date === "string" || typeof body.date === "number")
            syncServerTime(body.date);
          sendJson(res, 200, {
            offsetMs: getServerTimeOffset(),
            serverTimeMs: Date.now() + getServerTimeOffset(),
            timestamp: getAdjustedTimestamp(),
          });
          return;
        }
        case "/api/bridge/auth/refresh":
          await refreshSession(res, body);
          return;
        default:
          sendJson(res, 404, { error: "Unknown bridge endpoint" });
          return;
      }
    }

    if (url.startsWith("/api/liner/")) {
      await proxyLiner(req, res, raw);
      return;
    }
    if (url.startsWith("/api/")) {
      sendJson(res, 404, { error: "Unknown API endpoint" });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Nyx API + web server listening on http://${HOST}:${PORT}`);
  console.log(`Liner upstream: ${API_ORIGIN}`);
  console.log(`Static web root: ${DIST_DIR}`);
  if (API_TOKEN) console.log("API token protection: enabled");
});
