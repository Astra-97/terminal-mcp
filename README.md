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

## Exposing via Cloudflare Tunnel

The server listens on localhost only. Use a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose it over HTTPS without opening any ports.

### 1. Install cloudflared

```bash
# Debian / Ubuntu
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update && sudo apt install cloudflared -y
```

### 2. Authenticate & create tunnel

```bash
cloudflared tunnel login          # opens browser, authorize your domain
cloudflared tunnel create mytunnel
```

This generates a credentials JSON at `~/.cloudflared/<TUNNEL_ID>.json`.

### 3. Configure the tunnel

Create or edit `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_ID>.json

ingress:
  # Terminal MCP
  - hostname: terminal.yourdomain.com
    service: http://localhost:3001

  # You can add more services on different subdomains:
  # - hostname: other-service.yourdomain.com
  #   service: http://localhost:XXXX

  # Catch-all (required)
  - service: http_status:404
```

### 4. Add DNS record

```bash
cloudflared tunnel route dns mytunnel terminal.yourdomain.com
```

### 5. Run as systemd service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Or run manually: `cloudflared tunnel run mytunnel`

### 6. Verify

```bash
curl https://terminal.yourdomain.com/health
# → {"status":"ok","version":"1.1.0"}
```

## Connect to Claude

In Claude.ai → Settings → MCP, add your server:

```
URL: https://terminal.yourdomain.com/mcp
```

The tool `run_command` will appear in Claude's available tools.

## Security Notice

⚠️ This server executes arbitrary bash commands. **Do not expose it to the public internet without authentication.** Use [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) policies to restrict who can reach the endpoint, or keep it behind a private network.

## License

MIT
