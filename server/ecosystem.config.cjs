module.exports = {
  apps: [
    {
      name: "agar-app",
      script: "app.js",
      cwd: "/root/client",
      interpreter: "node",
      autorestart: true,
      max_restarts: 20,
      env: {
        NODE_ENV: "production",
        PORT: "443",
        SSL_KEY: "/etc/letsencrypt/live/api.agar.su/privkey.pem",
        SSL_CERT: "/etc/letsencrypt/live/api.agar.su/fullchain.pem",
      },
    },
  ],
};
