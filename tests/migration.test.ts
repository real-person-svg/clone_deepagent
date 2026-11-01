import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { initializeAgents } from '../packages/research/agents';
import { Subscriptions } from '../packages/research/subscriptions';
import { Store } from '../packages/storage/index';
import { addSource } from './support';

it('旧库迁移只清理明确标记的演示数据，保留真实来源和混合会话中的真实研究，且可重复打开', () => {
  const directory = mkdtempSync(join(tmpdir(), 'migration-'));
  const path = join(directory, 'workspace.sqlite');
  let store = new Store(path);
  try {
    initializeAgents(store);
    const service = new Subscriptions(store, () => true);
    addSource(store, { id: 'real_source', kind: 'web', url: 'https://public.example/pricing' });
    addSource(store, { id: 'retired_source' });
    store.exec("UPDATE evidence SET kind='fixture' WHERE id='retired_source'");
    const retired = store.createRun({ prompt: '旧演示', mode: 'single', provider: 'live' });
    store.finish(retired.id, 'completed', '旧演示回答');
    store.exec("UPDATE runs SET provider='demo' WHERE id=?", retired.id);
    const mixed = store.createRun({ prompt: '旧混合会话演示', mode: 'single', provider: 'live' });
    store.finish(mixed.id, 'completed', '旧演示回答');
    store.exec("UPDATE runs SET provider='demo' WHERE id=?", mixed.id);
    const real = store.createRun({
      conversationId: mixed.conversationId,
      prompt: '真实研究',
      mode: 'single',
      provider: 'live',
    });
    store.putReport(real, '真实研究原文', ['real_source']);
    store.finish(real.id, 'completed', '真实研究原文');
    const sub = service.create({
      name: '旧演示订阅',
      prompt: '旧巡检',
      intervalMinutes: 1440,
      sourceIds: ['real_source'],
    });
    store.exec("UPDATE subscriptions SET baselineDataset='baseline' WHERE id=?", sub.id);
    store.exec(
      'INSERT INTO tool_calls VALUES(?,?,?,?,?,?,?,?,?)',
      'read_original',
      real.id,
      'root',
      'query_evidence',
      '{}',
      JSON.stringify({ ok: true, data: { sources: [{ id: 'real_source' }] } }),
      'completed',
      real.createdAt,
      real.createdAt
    );
    store.exec('DELETE FROM schema_migrations WHERE version IN (3,4)');
    store.close();
    store = new Store(path);
    expect(store.evidence().map((e) => e.id)).toEqual(['real_source']);
    expect(store.all("SELECT * FROM evidence WHERE kind='fixture'")).toHaveLength(0);
    expect(store.all("SELECT * FROM evidence_fts WHERE id='retired_source'")).toHaveLength(0);
    expect(() => store.detail(retired.conversationId)).toThrow('会话不存在');
    expect(store.detail(mixed.conversationId).runs.map((r) => r.id)).toEqual([real.id]);
    expect(store.detail(mixed.conversationId).messages).toHaveLength(2);
    expect(store.reports()[0].content).toBe('真实研究原文');
    expect(store.all('SELECT evidenceId FROM run_evidence WHERE runId=?', real.id)).toEqual([
      { evidenceId: 'real_source' },
    ]);
    expect(store.subscriptions()).toHaveLength(0);
    store.close();
    store = new Store(path);
    expect(store.run(real.id).status).toBe('completed');
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
