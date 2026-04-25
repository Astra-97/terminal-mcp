import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { exec } from "child_process";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Config ───────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT       = parseInt(process.env.PORT || "3001");
const DEFAULT_CWD = process.env.DEFAULT_CWD || process.env.HOME || "/home/ubuntu";
const QR_DIR     = process.env.QR_DIR || path.join(DEFAULT_CWD, "Downloads");
const FILES_DIR  = process.env.FILES_DIR || path.join(__dirname, "files");
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "60000");
const MAX_BUFFER = parseInt(process.env.MAX_BUFFER || String(10 * 1024 * 1024));

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

// ─── MCP Server ───────────────────────────────────────
const server = new McpServer({
  name: "terminal-mcp",
  version: "1.1.0",
});

server.tool(
  "run_command",
  "Execute a bash command on the server",
  {
    command: z.string().describe("Bash command to execute"),
    cwd: z.string().default(DEFAULT_CWD).describe("Working directory"),
  },
  async ({ command, cwd }) => {
    return new Promise((resolve) => {
      exec(command, {
        cwd: cwd || DEFAULT_CWD,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
      }, (error, stdout, stderr) => {
        let output = "";
        if (stdout) output += stdout;
        if (stderr) output += (output ? "\n" : "") + stderr;
        if (!output) output = "(no output)";
        resolve({ content: [{ type: "text", text: output }] });
      });
    });
  }
);

// ─── Express App ──────────────────────────────────────
const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", version: "1.1.0" }));

// ─── QR Code Page (optional, for XHS login etc.) ─────
app.get("/qr", (_req, res) => {
  const files = fs.existsSync(QR_DIR)
    ? fs.readdirSync(QR_DIR).filter(f => f.startsWith("xhs_qrcode") && f.endsWith(".png")).sort().reverse()
    : [];
  const latestQR = files[0];
  const qrPath = latestQR ? path.join(QR_DIR, latestQR) : null;
  const exists = qrPath && fs.existsSync(qrPath);
  const stat = exists ? fs.statSync(qrPath) : null;
  const age = stat ? Math.floor((Date.now() - stat.mtimeMs) / 1000) : null;

  res.send(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="30"><title>QR Login</title>
  <style>
    body{font-family:-apple-system,sans-serif;text-align:center;padding:20px;background:#f5f5f5}
    .box{max-width:400px;margin:0 auto;background:#fff;padding:30px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.1)}
    h1{font-size:24px;color:#ff2442} img{max-width:300px;border-radius:8px;margin:20px 0}
    .s{padding:12px;border-radius:8px;margin:10px 0}
    .ok{background:#e8f5e9;color:#2e7d32} .warn{background:#fff3e0;color:#e65100} .err{background:#ffebee;color:#c62828}
    .age{color:#666;font-size:14px}
  </style>
</head><body><div class="box">
  <h1>📱 QR Login</h1>
  ${exists
    ? `<img src="/qr/image?t=${Date.now()}" alt="QR"><p class="age">Generated ${age}s ago</p>
       <p class="s ${age > 60 ? "warn" : "ok"}">${age > 60 ? "⚠️ May be expired" : "✅ Scan with app"}</p>`
    : '<p class="s err">❌ No QR code available</p>'}
  <p style="color:#999;font-size:12px">Auto-refreshes every 30s</p>
</div></body></html>`);
});

app.get("/qr/image", (_req, res) => {
  if (!fs.existsSync(QR_DIR)) return res.status(404).send("QR dir not found");
  const files = fs.readdirSync(QR_DIR).filter(f => f.startsWith("xhs_qrcode") && f.endsWith(".png")).sort().reverse();
  if (!files[0]) return res.status(404).send("No QR code");
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-cache");
  res.send(fs.readFileSync(path.join(QR_DIR, files[0])));
});

// ─── File Serving ─────────────────────────────────────
app.get("/files", (_req, res) => {
  if (!fs.existsSync(FILES_DIR)) return res.json([]);
  res.json(fs.readdirSync(FILES_DIR));
});

app.get("/files/:filename", (req, res) => {
  const filepath = path.join(FILES_DIR, req.params.filename);
  if (fs.existsSync(filepath)) res.download(filepath);
  else res.status(404).send("File not found");
});

// ─── MCP Transports ──────────────────────────────────
// Streamable HTTP (recommended)
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// SSE (legacy fallback)
const sseConnections = new Map();
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  sseConnections.set(transport.sessionId, transport);
  res.on("close", () => { sseConnections.delete(transport.sessionId); transport.close(); });
  await server.connect(transport);
});
app.post("/messages", async (req, res) => {
  const transport = sseConnections.get(req.query.sessionId);
  if (transport) await transport.handlePostMessage(req, res);
  else res.status(400).json({ error: "Unknown session" });
});

// ─── Start ────────────────────────────────────────────
app.listen(PORT, () => console.log(`Terminal MCP v1.1.0 running on port ${PORT}`));
