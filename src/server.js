import { env } from './config/env.js';
import { createApp } from './app.js';

const app = await createApp();

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
  console.log(`Swagger UI: http://localhost:${env.port}/api-docs`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${env.port} is already in use. Stop the other process:\n` +
        `  lsof -i :${env.port} -sTCP:LISTEN -t | xargs kill\n` +
        `Or change PORT in .env`,
    );
    process.exit(1);
  }
  throw err;
});
