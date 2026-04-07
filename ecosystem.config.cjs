module.exports = {
  apps: [
    {
      name: 'trading-app',
      cwd: __dirname,
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
