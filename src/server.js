import { env } from './config/env.js';
import { createApp } from './app.js';

const app = await createApp();

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
