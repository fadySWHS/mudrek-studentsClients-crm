module.exports = {
  apps: [
    {
      name: 'mudrek-backend',
      cwd: '/var/www/mudrek/backend',
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '/var/www/mudrek/logs/backend-error.log',
      out_file: '/var/www/mudrek/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'mudrek-frontend',
      cwd: '/var/www/mudrek/frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/www/mudrek/logs/frontend-error.log',
      out_file: '/var/www/mudrek/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
