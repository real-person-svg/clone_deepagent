import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/server/app';
import { defaultAgents } from '../packages/research/agents';
import { evidenceAdapter } from './support';

// External model protocol stub for browser regression only. No user key or workspace is read.
const model = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const input = JSON.parse(body);
  if (JSON.stringify(input.messages).includes('慢速协议任务'))
    await new Promise((resolve) => setTimeout(resolve, 1500));
  const result = await evidenceAdapter.complete({
    ...input,
    agent: defaultAgents[0],
    signal: new AbortController().signal,
    onText: () => {},
  });
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  res.end(
    `data: ${JSON.stringify({ choices: [{ delta: { content: result.content, tool_calls: result.toolCalls.map((c, index) => ({ index, ...c })) } }] })}\n\ndata: [DONE]\n\n`
  );
});
await new Promise<void>((resolve) => model.listen(0, '127.0.0.1', resolve));
const address = model.address();
if (!address || typeof address === 'string') throw new Error('Missing test server');
const directory = mkdtempSync(join(tmpdir(), 'agent-workspace-ui-'));
const { app } = await createApp({
  databasePath: join(directory, 'workspace.sqlite'),
  live: { baseUrl: `http://127.0.0.1:${address.port}/v1`, model: 'protocol-test', apiKey: '' },
});
await app.listen({ host: '127.0.0.1', port: 14317 });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  model.close();
  rmSync(directory, { recursive: true, force: true });
  process.exit(0);
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
