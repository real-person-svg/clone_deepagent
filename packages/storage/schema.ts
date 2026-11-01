import type { DatabaseSync } from 'node:sqlite';
export function migrate(db: DatabaseSync) {
  db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,title TEXT NOT NULL,mode TEXT NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,conversationId TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,prompt TEXT NOT NULL,mode TEXT NOT NULL,provider TEXT NOT NULL,dataset TEXT NOT NULL,status TEXT NOT NULL,answer TEXT NOT NULL DEFAULT '',error TEXT,cancelRequested INTEGER NOT NULL DEFAULT 0,snapshot TEXT NOT NULL,subscriptionId TEXT,owner TEXT,leaseUntil TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,finishedAt TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_run ON runs(conversationId) WHERE status IN ('queued','running','waiting_children');
      CREATE INDEX IF NOT EXISTS runs_queue ON runs(status,createdAt);
      CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversationId TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,role TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL,createdAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS messages_history ON messages(conversationId,createdAt,id);
      CREATE TABLE IF NOT EXISTS run_events(runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,seq INTEGER NOT NULL,type TEXT NOT NULL,agent TEXT NOT NULL,data TEXT NOT NULL,createdAt TEXT NOT NULL,PRIMARY KEY(runId,seq));
      CREATE TABLE IF NOT EXISTS checkpoints(runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,taskKey TEXT NOT NULL,state TEXT NOT NULL,updatedAt TEXT NOT NULL,PRIMARY KEY(runId,taskKey));
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,taskKey TEXT NOT NULL,agent TEXT NOT NULL,status TEXT NOT NULL,result TEXT,error TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,UNIQUE(runId,taskKey));
      CREATE TABLE IF NOT EXISTS tool_calls(id TEXT PRIMARY KEY,runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,taskKey TEXT NOT NULL,name TEXT NOT NULL,args TEXT NOT NULL,result TEXT,status TEXT NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY,competitor TEXT NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL,content TEXT NOT NULL,kind TEXT NOT NULL,dataset TEXT NOT NULL,observedAt TEXT NOT NULL,hash TEXT NOT NULL,metadata TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS evidence_fts USING fts5(id UNINDEXED,competitor,title,content,tokenize='trigram');
      CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,runId TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,conversationId TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,title TEXT NOT NULL,content TEXT NOT NULL,evidenceIds TEXT NOT NULL,dataset TEXT NOT NULL,createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS search_candidates(runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,url TEXT NOT NULL,title TEXT NOT NULL,snippet TEXT NOT NULL,query TEXT NOT NULL,discoveredAt TEXT NOT NULL,PRIMARY KEY(runId,url));
      CREATE TABLE IF NOT EXISTS run_evidence(runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,evidenceId TEXT NOT NULL REFERENCES evidence(id),PRIMARY KEY(runId,evidenceId));
      CREATE TABLE IF NOT EXISTS agents(id TEXT PRIMARY KEY,published TEXT NOT NULL,draft TEXT NOT NULL,draftRevision INTEGER NOT NULL DEFAULT 1,updatedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_versions(agentId TEXT NOT NULL REFERENCES agents(id),version INTEGER NOT NULL,spec TEXT NOT NULL,createdAt TEXT NOT NULL,PRIMARY KEY(agentId,version));
      CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,name TEXT NOT NULL,prompt TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,intervalMinutes INTEGER NOT NULL,threshold REAL NOT NULL,baseline TEXT NOT NULL,baselineDataset TEXT NOT NULL,nextFireAt TEXT NOT NULL,lastRunAt TEXT,lastRunId TEXT,createdAt TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS scheduled_fires(subscriptionId TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,scheduledFor TEXT NOT NULL,runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,PRIMARY KEY(subscriptionId,scheduledFor));
      CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,subscriptionId TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,title TEXT NOT NULL,content TEXT NOT NULL,fingerprint TEXT NOT NULL UNIQUE,readAt TEXT,createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS usage_records(id TEXT PRIMARY KEY,runId TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,agent TEXT NOT NULL,provider TEXT NOT NULL,inputTokens INTEGER NOT NULL,outputTokens INTEGER NOT NULL,createdAt TEXT NOT NULL);
      INSERT OR IGNORE INTO schema_migrations VALUES(1,datetime('now'));

    `);
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version=3').get()) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TEMP TABLE retired_conversations AS SELECT conversationId AS id FROM runs GROUP BY conversationId HAVING sum(provider!='demo')=0;
      DELETE FROM runs WHERE provider='demo';
      DELETE FROM conversations WHERE id IN (SELECT id FROM retired_conversations);
      DROP TABLE retired_conversations;
      DELETE FROM evidence_fts WHERE id IN (SELECT id FROM evidence WHERE kind='fixture');
      DELETE FROM evidence WHERE kind='fixture';
      DELETE FROM subscriptions WHERE baselineDataset IN ('baseline','updated');
      DELETE FROM settings WHERE key='dataset';
      INSERT INTO schema_migrations VALUES(3,datetime('now'));
      COMMIT;`);
  }
  const runColumns = db.prepare('PRAGMA table_info(runs)').all() as { name: string }[];
  if (!runColumns.some((column) => column.name === 'agentId'))
    db.exec("ALTER TABLE runs ADD COLUMN agentId TEXT NOT NULL DEFAULT 'root'");
  db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(5,datetime('now'))").run();
  // Preserve the evidence already read by real runs that may resume after upgrading.
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version=4').get()) {
    db.exec(`BEGIN IMMEDIATE;
      INSERT OR IGNORE INTO run_evidence(runId,evidenceId)
      SELECT t.runId,j.value FROM tool_calls t,json_tree(CASE WHEN json_valid(t.result) THEN t.result ELSE '{}' END,'$.data') j
      JOIN evidence e ON e.id=j.value AND e.kind IN ('upload','web')
      WHERE t.status='completed' AND json_valid(t.result) AND json_extract(CASE WHEN json_valid(t.result) THEN t.result ELSE '{}' END,'$.ok')=1
        AND t.name IN ('query_evidence','fetch_source','normalize_pricing','compare_snapshots')
        AND j.key IN ('id','evidenceId','oldEvidenceId','newEvidenceId');
      INSERT INTO schema_migrations VALUES(4,datetime('now'));
      COMMIT;`);
  }
}
