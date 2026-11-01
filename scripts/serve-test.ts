import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/server/app';

// Browser checks use a disposable workspace, independent of the user's database and model.
const directory = mkdtempSync(join(tmpdir(), 'agent-workspace-ui-'));
const { app } = await createApp({ databasePath: join(directory, 'workspace.sqlite') });
await app.listen({ host: '127.0.0.1', port: 14317 });

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  rmSync(directory, { recursive: true, force: true });
  process.exit(0);
}

process.on('SIGTERM', close);
process.on('SIGINT', close);
