import type {
  AgentMode,
  AgentSpec,
  AgentSummary,
  Conversation,
  ConversationDetail,
  Dataset,
  Evidence,
  Message,
  Notification,
  ProviderMode,
  Run,
  RunEvent,
  Subscription,
} from '../contracts/index';
import { AppError, now, parse, uid } from './common';
import { Database } from './database';
import { decodeReport, decodeRun } from './records';
export class Store extends Database {
  setting(key: string, fallback: string) {
    return (
      this.get<{ value: string }>('SELECT value FROM settings WHERE key=?', key)?.value ?? fallback
    );
  }

  setSetting(key: string, value: string) {
    this.exec(
      'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      key,
      value
    );
  }

  conversations(search = '') {
    return this.all<Conversation>(
      `SELECT c.*, (SELECT count(*) FROM messages m WHERE m.conversationId=c.id) messageCount,
      (SELECT id FROM runs r WHERE r.conversationId=c.id AND r.status IN ('queued','running','waiting_children') LIMIT 1) activeRunId,
      (SELECT content FROM messages m WHERE m.conversationId=c.id ORDER BY m.createdAt DESC,m.rowid DESC LIMIT 1) preview
      FROM conversations c WHERE c.title LIKE ? OR EXISTS(SELECT 1 FROM messages m WHERE m.conversationId=c.id AND m.content LIKE ?) ORDER BY c.updatedAt DESC LIMIT 100`,
      `%${search}%`,
      `%${search}%`
    );
  }

  createConversation(title = '新的研究', mode: AgentMode = 'single') {
    const conversation = { id: uid('chat'), title, mode, createdAt: now(), updatedAt: now() };
    this.exec(
      'INSERT INTO conversations VALUES(?,?,?,?,?)',
      conversation.id,
      title,
      mode,
      conversation.createdAt,
      conversation.updatedAt
    );

    return conversation;
  }

  detail(id: string): ConversationDetail {
    const c = this.get<Conversation>('SELECT * FROM conversations WHERE id=?', id);
    if (!c) throw new AppError(404, '会话不存在', 'NOT_FOUND');

    return {
      ...c,
      messages: this.all<Message>(
        'SELECT * FROM messages WHERE conversationId=? ORDER BY createdAt,rowid',
        id
      ),
      runs: this.all<Record<string, unknown>>(
        'SELECT * FROM runs WHERE conversationId=? ORDER BY createdAt',
        id
      ).map((r) => decodeRun(r)),
      reports: this.all<Record<string, unknown>>(
        'SELECT * FROM reports WHERE conversationId=? ORDER BY createdAt',
        id
      ).map((r) => decodeReport(r)),
    };
  }

  run(id: string) {
    const row = this.get<Record<string, unknown>>('SELECT * FROM runs WHERE id=?', id);
    if (!row) throw new AppError(404, '任务不存在', 'NOT_FOUND');

    return decodeRun(row);
  }

  createRun(input: {
    conversationId?: string;
    prompt: string;
    mode: AgentMode;
    provider: ProviderMode;
    dataset: Dataset;
    subscriptionId?: string;
    snapshot?: Record<string, AgentSpec>;
  }) {
    return this.tx(() => {
      const c = input.conversationId
        ? this.detail(input.conversationId)
        : this.createConversation(input.prompt.slice(0, 32), input.mode);
      if (
        this.get(
          "SELECT id FROM runs WHERE conversationId=? AND status IN ('queued','running','waiting_children')",
          c.id
        )
      )
        throw new AppError(409, '当前会话已有任务正在运行', 'RUN_ACTIVE');
      const id = uid('run'),
        time = now();
      const snapshot =
        input.snapshot ||
        Object.fromEntries(
          this.agents().map((a) => [
            a.id,
            {
              id: a.id,
              name: a.name,
              description: a.description,
              systemPrompt: a.systemPrompt,
              tools: a.tools,
              maxSteps: a.maxSteps,
              version: a.version,
            },
          ])
        );
      this.exec(
        'INSERT INTO runs(id,conversationId,prompt,mode,provider,dataset,status,snapshot,subscriptionId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        id,
        c.id,
        input.prompt,
        input.mode,
        input.provider,
        input.dataset,
        'queued',
        JSON.stringify(snapshot),
        input.subscriptionId || null,
        time,
        time
      );
      this.exec(
        'INSERT INTO messages VALUES(?,?,?,?,?,?,?)',
        uid('msg'),
        c.id,
        id,
        'user',
        input.prompt,
        'completed',
        time
      );
      this.exec(
        'INSERT INTO messages VALUES(?,?,?,?,?,?,?)',
        `assistant_${id}`,
        c.id,
        id,
        'assistant',
        '',
        'queued',
        time
      );
      this.exec(
        "UPDATE conversations SET title=CASE WHEN title='新的研究' THEN ? ELSE title END,mode=?,updatedAt=? WHERE id=?",
        input.prompt.slice(0, 32),
        input.mode,
        time,
        c.id
      );
      this.event(id, 'run.queued', 'root', {
        mode: input.mode,
        provider: input.provider,
        dataset: input.dataset,
      });

      return this.run(id);
    });
  }

  event(runId: string, type: string, agent: string, data: Record<string, unknown>) {
    const event = this.tx(() => {
      const seq =
        (this.get<{ seq: number }>(
          'SELECT coalesce(max(seq),0) seq FROM run_events WHERE runId=?',
          runId
        )?.seq || 0) + 1;
      const e: RunEvent = { runId, seq, type, agent, data, createdAt: now() };
      this.exec(
        'INSERT INTO run_events VALUES(?,?,?,?,?,?)',
        runId,
        seq,
        type,
        agent,
        JSON.stringify(data),
        e.createdAt
      );

      return e;
    });
    // SSE readers always read the durable log; this event is only a wake-up hint.
    queueMicrotask(() => this.changes.emit(runId));

    return event;
  }

  events(id: string, after = 0): RunEvent[] {
    return this.all<Record<string, unknown>>(
      'SELECT * FROM run_events WHERE runId=? AND seq>? ORDER BY seq LIMIT 500',
      id,
      after
    ).map((r) => ({ ...r, data: parse(r.data, {}) }) as unknown as RunEvent);
  }

  checkpoint<T>(runId: string, taskKey: string): T | undefined {
    const row = this.get<{ state: string }>(
      'SELECT state FROM checkpoints WHERE runId=? AND taskKey=?',
      runId,
      taskKey
    );

    return row ? parse<T | undefined>(row.state, undefined) : undefined;
  }

  saveCheckpoint(runId: string, taskKey: string, state: unknown) {
    this.exec(
      'INSERT INTO checkpoints VALUES(?,?,?,?) ON CONFLICT(runId,taskKey) DO UPDATE SET state=excluded.state,updatedAt=excluded.updatedAt',
      runId,
      taskKey,
      JSON.stringify(state),
      now()
    );
  }

  finish(runId: string, status: Run['status'], answer: string, error: string | null = null) {
    return this.tx(() => {
      const r = this.run(runId),
        time = now();
      this.exec(
        'UPDATE runs SET status=?,answer=?,error=?,updatedAt=?,finishedAt=?,owner=NULL,leaseUntil=NULL WHERE id=?',
        status,
        answer,
        error,
        time,
        time,
        runId
      );
      this.exec(
        'UPDATE messages SET content=?,status=? WHERE id=?',
        answer,
        status,
        `assistant_${runId}`
      );
      this.exec('UPDATE conversations SET updatedAt=? WHERE id=?', time, r.conversationId);
      this.event(runId, `run.${status}`, 'root', { answer, error });
    });
  }

  agents(): AgentSummary[] {
    return this.all<Record<string, unknown>>('SELECT * FROM agents ORDER BY rowid').map((r) => ({
      ...parse<AgentSpec>(r.published, {} as AgentSpec),
      draft: parse<AgentSpec>(r.draft, {} as AgentSpec),
      draftRevision: Number(r.draftRevision),
      updatedAt: String(r.updatedAt),
    }));
  }

  seedAgent(spec: AgentSpec) {
    this.tx(() => {
      this.exec(
        'INSERT OR IGNORE INTO agents VALUES(?,?,?,?,?)',
        spec.id,
        JSON.stringify(spec),
        JSON.stringify(spec),
        1,
        now()
      );
      this.exec(
        'INSERT OR IGNORE INTO agent_versions VALUES(?,?,?,?)',
        spec.id,
        spec.version,
        JSON.stringify(spec),
        now()
      );
    });
  }

  saveAgent(id: string, prompt: string, revision: number, publish: boolean) {
    return this.tx(() => {
      const a = this.agents().find((a) => a.id === id);
      if (!a) throw new AppError(404, 'Agent 不存在');
      if (a.draftRevision !== revision)
        throw new AppError(409, '配置已更新，请刷新后重试', 'REVISION_CONFLICT');
      const draft = { ...a.draft, systemPrompt: prompt };
      if (publish) {
        const version =
          (this.get<{ version: number }>(
            'SELECT max(version) version FROM agent_versions WHERE agentId=?',
            id
          )?.version || 0) + 1;
        draft.version = version;
        this.exec(
          'INSERT INTO agent_versions VALUES(?,?,?,?)',
          id,
          version,
          JSON.stringify(draft),
          now()
        );
        this.exec(
          'UPDATE agents SET published=?,draft=?,draftRevision=draftRevision+1,updatedAt=? WHERE id=?',
          JSON.stringify(draft),
          JSON.stringify(draft),
          now(),
          id
        );
      } else
        this.exec(
          'UPDATE agents SET draft=?,draftRevision=draftRevision+1,updatedAt=? WHERE id=?',
          JSON.stringify(draft),
          now(),
          id
        );

      return this.agents().find((a) => a.id === id)!;
    });
  }

  evidence(dataset: Dataset, provider: ProviderMode = 'demo', competitor = '', query = '') {
    return this.all<Record<string, unknown>>(
      `SELECT * FROM evidence WHERE (dataset=? OR dataset='all') AND (?='demo' OR kind!='fixture') AND competitor LIKE ? AND (content LIKE ? OR title LIKE ?) ORDER BY observedAt DESC`,
      dataset,
      provider,
      `%${competitor}%`,
      `%${query}%`,
      `%${query}%`
    ).map((r) => ({ ...r, metadata: parse(r.metadata, {}) }) as unknown as Evidence);
  }

  putEvidence(e: Evidence) {
    this.tx(() => {
      this.exec(
        'INSERT OR IGNORE INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)',
        e.id,
        e.competitor,
        e.title,
        e.url,
        e.content,
        e.kind,
        e.dataset,
        e.observedAt,
        e.hash,
        JSON.stringify(e.metadata)
      );
      this.exec('DELETE FROM evidence_fts WHERE id=?', e.id);
      this.exec(
        'INSERT INTO evidence_fts(id,competitor,title,content) VALUES(?,?,?,?)',
        e.id,
        e.competitor,
        e.title,
        e.content
      );
    });
  }

  getEvidence(id: string) {
    const r = this.get<Record<string, unknown>>('SELECT * FROM evidence WHERE id=?', id);
    if (!r) throw new AppError(404, '证据不存在');

    return { ...r, metadata: parse(r.metadata, {}) } as unknown as Evidence;
  }

  reports() {
    return this.all<Record<string, unknown>>(
      'SELECT * FROM reports ORDER BY createdAt DESC LIMIT 100'
    ).map((r) => decodeReport(r));
  }

  putReport(run: Run, content: string, evidenceIds: string[]) {
    const id = `report_${run.id}`;
    this.exec(
      'INSERT INTO reports VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(runId) DO UPDATE SET content=excluded.content,evidenceIds=excluded.evidenceIds',
      id,
      run.id,
      run.conversationId,
      run.prompt.slice(0, 60),
      content,
      JSON.stringify(evidenceIds),
      run.dataset,
      now()
    );

    return id;
  }

  subscriptions() {
    return this.all<Record<string, unknown>>(
      'SELECT * FROM subscriptions ORDER BY createdAt DESC'
    ).map((r) => ({ ...r, baseline: parse(r.baseline, {}) }) as unknown as Subscription);
  }

  notifications() {
    return this.all<Notification>('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 100');
  }

  stats() {
    return {
      conversations: this.get<{ n: number }>('SELECT count(*) n FROM conversations')!.n,
      reports: this.get<{ n: number }>('SELECT count(*) n FROM reports')!.n,
      evidence: this.get<{ n: number }>('SELECT count(*) n FROM evidence')!.n,
    };
  }
}
