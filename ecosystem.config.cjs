/**
 * PM2 configuration for A2A Registry
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 stop a2a-registry
 *   pm2 restart a2a-registry
 *   pm2 logs a2a-registry
 */

module.exports = {
  apps: [{
    name: 'a2a-registry',
    script: './dist/index.js',
    args: '--store=sqlite --file=./a2a-registry.db --port=3000',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10
  }]
};
