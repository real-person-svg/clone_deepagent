import 'dotenv/config';
import { createApp } from './app';

const { app } = await createApp({
  databasePath: process.env.DATABASE_PATH,
  logger: true,
  live:
    process.env.MODEL_BASE_URL && process.env.MODEL_NAME
      ? {
          baseUrl: process.env.MODEL_BASE_URL,
          model: process.env.MODEL_NAME,
          apiKey: process.env.MODEL_API_KEY || '',
          timeoutMs: Number(process.env.MODEL_TIMEOUT_MS || 120000),
        }
      : undefined,
});
await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 4317) });
console.log('Agent Studio API: http://127.0.0.1:' + (process.env.PORT || 4317));
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    await app.close();
    process.exit(0);
  });
