#!/bin/bash
set -e

echo "🔧 Terminal MCP — Quick Setup"
echo "=============================="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Installing via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install --lts
fi

echo "✅ Node.js $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create files directory
mkdir -p files

# Copy .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  # Auto-fill DEFAULT_CWD with current user's home
  sed -i "s|DEFAULT_CWD=.*|DEFAULT_CWD=$HOME|" .env
  echo "📝 Created .env (edit if needed)"
fi

# Setup systemd service
read -p "🔄 Install systemd service? [y/N] " install_service
if [[ "$install_service" =~ ^[Yy]$ ]]; then
  SERVICE_FILE=/etc/systemd/system/terminal-mcp.service
  WORK_DIR=$(pwd)
  NODE_PATH=$(which node)
  
  sudo tee "$SERVICE_FILE" > /dev/null << SVCEOF
[Unit]
Description=Terminal MCP Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$WORK_DIR
ExecStart=$NODE_PATH $WORK_DIR/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=$WORK_DIR/.env

[Install]
WantedBy=multi-user.target
SVCEOF

  sudo systemctl daemon-reload
  sudo systemctl enable terminal-mcp
  sudo systemctl start terminal-mcp
  echo "✅ Service installed and started"
else
  echo "ℹ️  Run manually: node server.js"
fi

echo ""
echo "🎉 Done! Server will run on port ${PORT:-3001}"
echo "   MCP endpoint: http://localhost:${PORT:-3001}/mcp"
echo "   Health check: http://localhost:${PORT:-3001}/health"
