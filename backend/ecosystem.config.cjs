module.exports = {
  apps: [
    {
      name: 'appcontagem-dev',
      script: 'node_modules/.bin/tsx',
      args: 'watch src/server.ts',
      watch: false,
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'appcontagem-prod',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
      },
    },
    // Backup diário foi movido pro cron interno em jobs.ts (roda às 02h).
    // Mantém comentado aqui caso queira usar PM2 ao invés do interno:
    // {
    //   name: 'appcontagem-backup',
    //   script: 'node_modules/.bin/tsx',
    //   args: 'prisma/backup.ts',
    //   autorestart: false,
    //   cron_restart: '0 2 * * *',
    //   watch: false,
    //   env_production: { NODE_ENV: 'production' },
    // },
  ],
}
