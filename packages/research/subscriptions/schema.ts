import { Store, now } from '../../storage/index';
import { agentSnapshot } from './agent-snapshot';
export function migrateSubscriptions(store: Store) {
  store.db.exec(
    'CREATE TABLE IF NOT EXISTS subscription_processing(runId TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,processedAt TEXT NOT NULL)'
  );
  store.db.exec(
    'CREATE TABLE IF NOT EXISTS source_checks(runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,sourceId TEXT NOT NULL REFERENCES evidence(id),previousId TEXT NOT NULL REFERENCES evidence(id),currentId TEXT NOT NULL REFERENCES evidence(id),checkedAt TEXT NOT NULL,PRIMARY KEY(runId,sourceId))'
  );
  store.tx(() => {
    store.db.exec(
      'CREATE TABLE IF NOT EXISTS task_templates(id TEXT PRIMARY KEY,name TEXT NOT NULL,prompt TEXT NOT NULL,draftPrompt TEXT NOT NULL,draftRevision INTEGER NOT NULL,publishedVersion INTEGER NOT NULL,updatedAt TEXT NOT NULL); CREATE TABLE IF NOT EXISTS task_template_versions(templateId TEXT NOT NULL REFERENCES task_templates(id),version INTEGER NOT NULL,prompt TEXT NOT NULL,agentSnapshot TEXT NOT NULL,createdAt TEXT NOT NULL,PRIMARY KEY(templateId,version))'
    );
    const columns = store
      .all<{ name: string }>('PRAGMA table_info(subscriptions)')
      .map((r) => r.name);
    for (const [name, type] of [
      ['templateId', 'TEXT'],
      ['templateVersion', 'INTEGER'],
      ['agentSnapshot', 'TEXT'],
      ['sourceIds', "TEXT NOT NULL DEFAULT '[]'"],
    ])
      if (!columns.includes(name))
        store.db.exec(`ALTER TABLE subscriptions ADD COLUMN ${name} ${type}`);
    const original = store.get<{ prompt: string }>(
      "SELECT prompt FROM task_templates WHERE id='tpl_commercial'"
    );
    if (
      original?.prompt === '对比 Alpha、Beta、Gamma 的价格、套餐权益和商用授权变化，提供前后证据。'
    ) {
      store.exec("DELETE FROM task_template_versions WHERE templateId='tpl_commercial'");
      store.exec("DELETE FROM task_templates WHERE id='tpl_commercial'");
    }
    if (!store.get("SELECT id FROM task_templates WHERE id='tpl_commercial'")) {
      const prompt =
        '刷新选定的官方来源，比较前后资料中的价格、套餐权益和商用授权。逐项引用前后原文，区分内容更新与已经核实的商业化变化，缺失信息标为未知。';
      store.exec(
        'INSERT INTO task_templates VALUES(?,?,?,?,?,?,?)',
        'tpl_commercial',
        'AI 竞品商业化巡检',
        prompt,
        prompt,
        1,
        1,
        now()
      );
      store.exec(
        'INSERT INTO task_template_versions VALUES(?,?,?,?,?)',
        'tpl_commercial',
        1,
        prompt,
        JSON.stringify(agentSnapshot(store)),
        now()
      );
    }
    store.exec(
      "UPDATE subscriptions SET templateId='tpl_commercial',templateVersion=1,agentSnapshot=(SELECT agentSnapshot FROM task_template_versions WHERE templateId='tpl_commercial' AND version=1) WHERE templateId IS NULL"
    );
    store.exec('INSERT OR IGNORE INTO schema_migrations VALUES(2,?)', now());
  });
}
