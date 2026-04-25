# Terminal MCP

A lightweight [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes a remote bash terminal over HTTP. Connect it to Claude (or any MCP client) to run commands on your server.

## Features

- **Remote terminal** — execute bash commands via MCP tool call
- **Dual transport** — Streamable HTTP (`/mcp`) + SSE (`/sse`) for compatibility
- **File serving** — upload/download files through `/files` endpoint
- **QR page** — optional QR code display page (useful for app login flows)
- **Systemd ready** — one-command service installation

## Quick Start

```bash
git clone https://github.com/Astra-97/terminal-mcp.git
cd terminal-mcp
./setup.sh
```

The setup script will:
1. Check / install Node.js (via nvm)
2. Install npm dependencies
3. Create `.env` from template
4. Optionally install a systemd service

## Manual Setup

```bash
npm install
cp .env.example .env   # edit as needed
node server.js
```

## Configuration

All config via environment variables (or `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DEFAULT_CWD` | `$HOME` | Default working directory for commands |
| `QR_DIR` | `~/Downloads` | Directory for QR code images |
| `FILES_DIR` | `./files` | Directory for file serving |
| `TIMEOUT_MS` | `60000` | Command execution timeout (ms) |
| `MAX_BUFFER` | `10485760` | Max stdout/stderr buffer (bytes) |

## MCP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | Streamable HTTP transport (recommended) |
| `/sse` | GET | SSE transport (legacy) |
| `/messages` | POST | SSE message handler |
| `/health` | GET | Health check |
| `/files` | GET | List served files |
| `/files/:name` | GET | Download a file |
| `/qr` | GET | QR code display page |

## Connect to Claude

In Claude.ai MCP settings, add:

```
URL: https://your-server.example.com/mcp
```

You'll likely want to put this behind a reverse proxy (Cloudflare Tunnel, nginx, Caddy) with HTTPS.

## Exposing via Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3001
```

Or set up a persistent tunnel:

```bash
cloudflared tunnel create terminal
cloudflared tunnel route dns terminal terminal.yourdomain.com
cloudflared tunnel run terminal
```

## Security Notice

⚠️ This server executes arbitrary bash commands. **Do not expose it to the public internet without authentication.** Use a Cloudflare Tunnel with access policies, or restrict access at the network level.

## License

MIT
