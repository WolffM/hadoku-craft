/**
 * PM2 Ecosystem Configuration for hadoku-craft
 *
 * Manages the local Craft server with ImageMagick processing.
 * The Cloudflare Tunnel is managed separately by hadoku_site.
 *
 * Usage:
 *   pnpm local:start   # Start the server
 *   pnpm local:stop    # Stop the server
 *   pnpm local:restart # Restart the server
 *   pnpm local:logs    # View logs
 *   pnpm local:status  # Check status
 *
 * First-time setup:
 *   npm install -g pm2
 *   cd server && npm install
 */

const path = require('path');

const serverDir = path.join(__dirname, 'server');

module.exports = {
	apps: [
		{
			name: 'craft-server',
			cwd: serverDir,
			script: 'src/index.ts',
			interpreter: 'node',
			interpreter_args: '--import tsx',
			watch: ['src'],
			ignore_watch: ['node_modules'],
			autorestart: true,
			max_restarts: 5,
			env: {
				PORT: 8787,
			},
		},
	],
};
